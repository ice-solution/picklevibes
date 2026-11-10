const http = require('http');
const https = require('https');
const {
  getPickleVibesApiConfig,
  isPickleVibesRemoteEnabled,
} = require('../config/picklevibesApi');
const { PickleVibesApiError } = require('./picklevibesAvailabilityClient');

const PICKCOURT_BOOKING_REMARK = 'PickCourt 預約';

function withPickCourtRemark(specialRequests) {
  const base = String(specialRequests || '').trim();
  if (!base) return PICKCOURT_BOOKING_REMARK;
  if (base.includes('PickCourt')) return base.slice(0, 500);
  const combined = `${PICKCOURT_BOOKING_REMARK}；${base}`;
  return combined.slice(0, 500);
}

/**
 * 用 Node http/https（唔用 fetch），避免 Cloudflare hairpin／undici 卡住令 origin 502。
 */
function httpJsonRequest(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const payload = body == null ? null : Buffer.from(String(body), 'utf8');
    const req = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          ...headers,
          ...(payload ? { 'Content-Length': payload.length } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: res.statusCode || 0,
            text,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`PickleVibes 預約逾時 (${timeoutMs}ms)`));
    });
    req.on('error', (err) => reject(err));

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * 透過 PickleVibes Bot API 占場。
 * externalSettlement=true：唔扣 PickleVibes 積分（由 PickCourt 先扣平台／店鋪數）。
 */
async function createPickleVibesBotBooking({
  phone,
  court,
  date,
  startTime,
  endTime,
  totalPlayers,
  specialRequests,
  includeSoloCourt = false,
  redeemCodeId,
  externalSettlement = true,
  externalNote = 'PickCourt 平台已結算',
  settledPoints,
}) {
  // 呢行一定要出現喺 pm2 log；冇就代表跑緊舊檔／錯目錄
  console.log('🔍 PickleVibes bot booking ENTER', {
    pid: process.pid,
    nodeEnv: process.env.NODE_ENV || null,
    cwd: process.cwd(),
  });

  const config = getPickleVibesApiConfig();
  if (!isPickleVibesRemoteEnabled()) {
    throw new PickleVibesApiError('PICKLEVIBES_API_BASE_URL 未設定');
  }
  if (!config.botApiKey) {
    throw new PickleVibesApiError('PICKLEVIBES_BOT_API_KEY 未設定');
  }

  const body = {
    phone: String(phone || '').trim(),
    court: String(court),
    date,
    startTime,
    endTime,
    totalPlayers: Number(totalPlayers) || 1,
    specialRequests: withPickCourtRemark(specialRequests),
    includeSoloCourt: Boolean(includeSoloCourt),
    externalSettlement: Boolean(externalSettlement),
  };
  if (externalSettlement && externalNote) {
    body.externalNote = String(externalNote).trim().slice(0, 200);
  }
  if (externalSettlement && settledPoints != null && settledPoints !== '') {
    body.settledPoints = Math.max(0, Math.round(Number(settledPoints)));
  }
  if (redeemCodeId && !externalSettlement) {
    body.redeemCodeId = redeemCodeId;
  }

  const url = new URL(`${config.baseUrl}/bot/booking`);
  const startedAt = Date.now();
  const payload = JSON.stringify(body);

  console.log('🔍 PickleVibes bot booking request', {
    url: url.toString(),
    source: config.baseUrlSource,
    usingInternalUrl: Boolean(config.usingInternalUrl),
    timeoutMs: config.requestTimeoutMs,
    court: body.court,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    externalSettlement: body.externalSettlement,
    settledPoints: body.settledPoints,
  });

  try {
    const response = await httpJsonRequest(url, {
      method: 'POST',
      timeoutMs: config.requestTimeoutMs,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Bot-Key': config.botApiKey,
      },
      body: payload,
    });

    console.log('🔍 PickleVibes bot booking response', {
      status: response.status,
      ms: Date.now() - startedAt,
      bodyPreview: String(response.text || '').slice(0, 200),
    });

    let parsed = null;
    if (response.text) {
      try {
        parsed = JSON.parse(response.text);
      } catch {
        parsed = { message: response.text };
      }
    }

    if (response.status < 200 || response.status >= 300 || parsed?.success === false) {
      const message =
        parsed?.message ||
        parsed?.error ||
        `PickleVibes 預約失敗 (${response.status})`;
      const err = new PickleVibesApiError(message, {
        status: response.status,
        code: parsed?.code,
        path: url.pathname,
      });
      err.details = parsed?.details;
      throw err;
    }

    return parsed?.data || parsed;
  } catch (error) {
    console.error('❌ PickleVibes bot booking failed', {
      ms: Date.now() - startedAt,
      name: error?.name,
      message: error?.message,
      code: error?.code,
      url: url.toString(),
    });
    if (error instanceof PickleVibesApiError) throw error;
    const msg = error?.message || 'PickleVibes 預約請求失敗';
    const timedOut = /逾時|timeout/i.test(msg);
    throw new PickleVibesApiError(
      timedOut ? `PickleVibes 預約逾時 (${config.requestTimeoutMs}ms)` : msg,
      { path: url.pathname, status: timedOut ? 504 : undefined }
    );
  }
}

module.exports = {
  PICKCOURT_BOOKING_REMARK,
  withPickCourtRemark,
  createPickleVibesBotBooking,
};
