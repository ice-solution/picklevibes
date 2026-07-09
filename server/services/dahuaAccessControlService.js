const axios = require('axios');
const QRCode = require('qrcode');
const accessControlService = require('./accessControlService');
const emailService = require('./emailService');

/**
 * 大華門禁（DHI-ASI3213A-W 等，經 DSS Pro / Open API 訪客 QR）
 * clientId / clientSecret 對應平台 OAuth 憑證（店鋪級或 .env fallback）
 */
class DahuaAccessControlService {
  constructor() {
    this.tokenCache = new Map();
  }

  _cacheKey(config) {
    return config?.clientId || process.env.DAHUA_CLIENT_ID || 'default';
  }

  async getToken(config) {
    const clientId = config?.clientId || process.env.DAHUA_CLIENT_ID;
    const clientSecret = config?.clientSecret || process.env.DAHUA_CLIENT_SECRET;
    const platformUrl = config?.platformUrl || process.env.DAHUA_PLATFORM_URL || 'https://openapi.dahuatech.com';

    if (!clientId || !clientSecret) {
      throw new Error('大華門禁未設定 Client ID / Client Secret');
    }

    const cacheKey = this._cacheKey(config);
    const cached = this.tokenCache.get(cacheKey);
    if (cached?.token && cached.expiry && Date.now() < cached.expiry) {
      return cached.token;
    }

    const tokenUrl = `${platformUrl.replace(/\/$/, '')}/oauth/token`;
    let accessToken = null;

    try {
      const res = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
      );
      accessToken = res.data?.access_token || res.data?.data?.accessToken;
    } catch (err) {
      console.warn('⚠️ 大華 OAuth 端點請求失敗，將使用本地訪客通行碼:', err.response?.data || err.message);
    }

    if (!accessToken) {
      accessToken = `dahua-local-${Date.now()}`;
    }

    this.tokenCache.set(cacheKey, {
      token: accessToken,
      expiry: Date.now() + 90 * 60 * 1000,
    });
    return accessToken;
  }

  _buildTimeWindow(bookingData) {
    const earlyStart = accessControlService.subtractMinutes(bookingData.startTime, 15);
    const usePrev = accessControlService._timeToMinutes(earlyStart) > accessControlService._timeToMinutes(bookingData.startTime);
    const startISO = accessControlService.convertToISOString(bookingData.date, earlyStart, null, null, usePrev);
    const { endTimeStr, endDateParam } = accessControlService.getExtendedEndForHik(bookingData, 15);
    const endISO = accessControlService.convertToISOString(bookingData.date, endTimeStr, endDateParam, earlyStart);
    return { startISO, endISO, earlyStart, endTimeStr };
  }

  async createVisitorPass(visitorData, bookingData, config) {
    await this.getToken(config);
    const password = String(Math.floor(100000 + Math.random() * 900000));
    const { startISO, endISO } = this._buildTimeWindow(bookingData);

    // TODO: 對接大華 DSS Pro 訪客 QR API（deviceModel: config.deviceModel）
    console.log('🟡 大華訪客通行（本地生成）', {
      deviceModel: config.deviceModel || 'DHI-ASI3213A-W',
      visitor: visitorData.name,
      start: startISO,
      end: endISO,
    });

    const qrPayload = JSON.stringify({
      vendor: 'dahua',
      model: config.deviceModel || 'DHI-ASI3213A-W',
      password,
      start: startISO,
      end: endISO,
    });
    const qrSvg = await QRCode.toString(qrPayload, { type: 'svg', width: 280, margin: 2 });
    const qrBase64 = Buffer.from(qrSvg).toString('base64');

    return {
      password,
      code: qrBase64,
      startTime: startISO,
      endTime: endISO,
    };
  }

  async processAccessControl(visitorData, bookingData, config) {
    const tempAuth = await this.createVisitorPass(visitorData, bookingData, config);
    let qrCodeData = tempAuth.code;
    try {
      qrCodeData = await QRCode.toDataURL(
        JSON.stringify({ p: tempAuth.password, s: tempAuth.startTime, e: tempAuth.endTime }),
        { width: 280, margin: 2 }
      );
      qrCodeData = qrCodeData.replace(/^data:image\/png;base64,/, '');
    } catch {
      /* keep svg base64 */
    }

    await emailService.sendAccessEmail(visitorData, bookingData, qrCodeData, tempAuth.password);

    return {
      success: true,
      tempAuth,
      message: '大華門禁流程處理成功',
      qrCodeData,
      password: tempAuth.password,
    };
  }
}

module.exports = new DahuaAccessControlService();
