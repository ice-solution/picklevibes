/**
 * 大華門禁正式流程（無 DSS）：
 * 1) 預約成功 → 產簽名 QR（客人掃機）+ 限時密碼（選填 CGI 寫入機）
 * 2) 機 PictureHttpUpload → webhook → 驗時段 → CGI openDoor
 */
const crypto = require('crypto');
const QRCode = require('qrcode');
const emailService = require('./emailService');
const dahuaCgi = require('./dahuaCgiClient');
const { resolveHKYmd, bookingRangeUtcMs } = require('../utils/bookingDateTime');

const TOKEN_PREFIX = 'PC1';

function qrSigningSecret(config) {
  return (
    config?.qrSecret ||
    process.env.DAHUA_QR_SECRET ||
    process.env.JWT_SECRET ||
    'pickcourt-dahua-dev'
  );
}

function signToken(bookingId, secret) {
  return crypto.createHmac('sha256', secret).update(String(bookingId)).digest('hex').slice(0, 12);
}

/** 產生／驗證 QR 內容：PC1.<bookingId>.<hmac12> */
function buildAccessToken(bookingId, config) {
  const id = String(bookingId);
  const sig = signToken(id, qrSigningSecret(config));
  return `${TOKEN_PREFIX}.${id}.${sig}`;
}

function parseAccessToken(raw, config) {
  const text = String(raw || '').trim();
  const parts = text.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const bookingId = parts[1];
  const sig = parts[2];
  if (!/^[a-f0-9]{24}$/i.test(bookingId)) return null;
  const expected = signToken(bookingId, qrSigningSecret(config));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { bookingId, token: text };
}

function deriveDeviceUserId(bookingId) {
  const hex = String(bookingId).replace(/[^a-f0-9]/gi, '').slice(-8) || '1';
  const n = parseInt(hex, 16) % 900000;
  return String(100000 + n);
}

function buildTimeWindowMs(bookingData, preMin, postMin) {
  const ymd = resolveHKYmd(bookingData.date);
  const { startMs, endMs } = bookingRangeUtcMs(ymd, bookingData.startTime, bookingData.endTime);
  const pre = Math.max(0, Number(preMin) || 15) * 60 * 1000;
  const post = Math.max(0, Number(postMin) || 15) * 60 * 1000;
  return {
    windowStartMs: startMs - pre,
    windowEndMs: endMs + post,
    startMs,
    endMs,
  };
}

function buildTimeWindowIso(bookingData, preMin, postMin) {
  const { windowStartMs, windowEndMs } = buildTimeWindowMs(bookingData, preMin, postMin);
  return {
    startISO: new Date(windowStartMs).toISOString(),
    endISO: new Date(windowEndMs).toISOString(),
    windowStartMs,
    windowEndMs,
  };
}

class DahuaAccessControlService {
  cgiConfigFromStoreConfig(config) {
    return {
      host: config.deviceHost,
      port: config.httpPort || 80,
      https: Boolean(config.useHttps),
      user: config.deviceUser || 'admin',
      password: config.devicePassword,
      doorChannel: config.doorChannel ?? 1,
      doorIndex: config.doorIndex ?? 0,
    };
  }

  async createVisitorPass(visitorData, bookingData, config) {
    if (!bookingData?.bookingId) {
      throw new Error('大華門禁缺少 bookingId');
    }
    if (!config?.deviceHost || !config?.devicePassword) {
      throw new Error('大華門禁未設定設備 IP／密碼（店鋪後台）');
    }

    const pre = config.preBufferMinutes ?? 15;
    const post = config.postBufferMinutes ?? 15;
    const { startISO, endISO, windowStartMs, windowEndMs } = buildTimeWindowIso(
      bookingData,
      pre,
      post
    );

    const accessToken = buildAccessToken(bookingData.bookingId, config);
    const password = String(Math.floor(100000 + Math.random() * 900000));
    const deviceUserId = deriveDeviceUserId(bookingData.bookingId);

    let enroll = null;
    if (config.enrollPassword !== false) {
      try {
        enroll = await dahuaCgi.enrollPasswordUser(this.cgiConfigFromStoreConfig(config), {
          userId: deviceUserId,
          password,
          cardName: `PC-${String(bookingData.bookingId).slice(-6)}`,
          startMs: windowStartMs,
          endMs: windowEndMs,
        });
        if (!enroll.ok) {
          console.warn('⚠️ 大華 CGI 寫入限時密碼失敗（仍會發 QR）:', enroll.status, enroll.body);
        } else {
          console.log('✅ 大華限時密碼已寫入設備', { deviceUserId, startISO, endISO });
        }
      } catch (err) {
        console.warn('⚠️ 大華 CGI 寫入限時密碼例外（仍會發 QR）:', err.message);
        enroll = { ok: false, error: err.message };
      }
    }

    const qrPngDataUrl = await QRCode.toDataURL(accessToken, { width: 280, margin: 2 });
    const qrBase64 = qrPngDataUrl.replace(/^data:image\/png;base64,/, '');

    return {
      password,
      code: qrBase64,
      accessToken,
      qrPayload: accessToken,
      deviceUserId,
      enrollOk: Boolean(enroll?.ok),
      startTime: startISO,
      endTime: endISO,
    };
  }

  async processAccessControl(visitorData, bookingData, config) {
    const tempAuth = await this.createVisitorPass(visitorData, bookingData, config);
    await emailService.sendAccessEmail(visitorData, bookingData, tempAuth.code, tempAuth.password, {
      deviceUserId: tempAuth.deviceUserId,
    });

    return {
      success: true,
      tempAuth,
      message: '大華門禁流程處理成功',
      qrCodeData: tempAuth.code,
      qrPayload: tempAuth.accessToken,
      password: tempAuth.password,
    };
  }

  async openDoorForConfig(config) {
    return dahuaCgi.openDoor(this.cgiConfigFromStoreConfig(config));
  }
}

const service = new DahuaAccessControlService();

module.exports = service;
module.exports.buildAccessToken = buildAccessToken;
module.exports.parseAccessToken = parseAccessToken;
module.exports.buildTimeWindowMs = buildTimeWindowMs;
module.exports.TOKEN_PREFIX = TOKEN_PREFIX;
