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
}) {
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
  if (redeemCodeId && !externalSettlement) {
    body.redeemCodeId = redeemCodeId;
  }

  const url = new URL(`${config.baseUrl}/bot/booking`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Bot-Key': config.botApiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok || payload?.success === false) {
      const message =
        payload?.message ||
        payload?.error ||
        `PickleVibes 預約失敗 (${response.status})`;
      const err = new PickleVibesApiError(message, {
        status: response.status,
        code: payload?.code,
        path: url.pathname,
      });
      err.details = payload?.details;
      throw err;
    }

    return payload?.data || payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new PickleVibesApiError(`PickleVibes 預約逾時 (${config.requestTimeoutMs}ms)`, {
        path: url.pathname,
      });
    }
    if (error instanceof PickleVibesApiError) throw error;
    throw new PickleVibesApiError(error.message || 'PickleVibes 預約請求失敗');
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  PICKCOURT_BOOKING_REMARK,
  withPickCourtRemark,
  createPickleVibesBotBooking,
};
