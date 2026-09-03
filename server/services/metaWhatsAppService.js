const QRCode = require('qrcode');

const GRAPH_BASE = 'https://graph.facebook.com';

/**
 * PickCourt 共用一個 Meta WhatsApp 號，幫全部店鋪發送預約／進場通知。
 *
 * Env:
 *   META_WA_ENABLED=1
 *   META_WA_TOKEN=...
 *   META_WA_PHONE_NUMBER_ID=...
 *   META_WA_API_VERSION=v21.0
 *   META_WA_TEMPLATE_BOOKING=pickcourt_booking_confirm
 *   META_WA_TEMPLATE_ACCESS=pickcourt_access_code
 *   META_WA_TEMPLATE_LANG=zh_HK
 */
class MetaWhatsAppService {
  constructor() {
    this.enabled = process.env.META_WA_ENABLED === '1' || process.env.META_WA_ENABLED === 'true';
    this.token = process.env.META_WA_TOKEN || '';
    /** 必須係 Phone Number ID；若誤填 WABA ID 會在首次發送時自動解析 */
    this.phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || '';
    this.wabaId = process.env.META_WA_WABA_ID || '';
    this.apiVersion = process.env.META_WA_API_VERSION || 'v21.0';
    this.templateBooking = process.env.META_WA_TEMPLATE_BOOKING || 'pickcourt_booking_confirm';
    this.templateAccess = process.env.META_WA_TEMPLATE_ACCESS || 'pickcourt_access_code';
    this.templateCancel = process.env.META_WA_TEMPLATE_CANCEL || 'pickcourt_booking_cancel';
    this.templateLang = process.env.META_WA_TEMPLATE_LANG || 'zh_HK';
    this._phoneResolved = false;
  }

  isConfigured() {
    return Boolean(this.enabled && this.token && this.phoneNumberId);
  }

  /**
   * 若 META_WA_PHONE_NUMBER_ID 誤填成 WABA ID，自動改用帳戶下第一個電話號碼 ID。
   */
  async resolvePhoneNumberId() {
    if (this._phoneResolved || !this.phoneNumberId || !this.token) {
      return this.phoneNumberId;
    }

    try {
      const url = `${GRAPH_BASE}/${this.apiVersion}/${this.phoneNumberId}?fields=display_phone_number,verified_name`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const data = await res.json().catch(() => ({}));

      // 真 Phone Number：會有 display_phone_number
      if (data?.display_phone_number) {
        this._phoneResolved = true;
        return this.phoneNumberId;
      }

      // 可能係 WABA（有 message_template_namespace）——列出旗下電話
      const listUrl = `${GRAPH_BASE}/${this.apiVersion}/${this.phoneNumberId}/phone_numbers?fields=id,display_phone_number,verified_name`;
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const listData = await listRes.json().catch(() => ({}));
      const phones = listData?.data || [];
      if (phones.length >= 1 && phones[0].id) {
        console.warn(
          `⚠️ META_WA_PHONE_NUMBER_ID 似係 WABA ID。已自動改用 Phone Number ID ${phones[0].id}（${phones[0].display_phone_number || ''}）。請把 .env 改成正確 Phone Number ID。`
        );
        this.wabaId = this.wabaId || this.phoneNumberId;
        this.phoneNumberId = String(phones[0].id);
        this._phoneResolved = true;
        return this.phoneNumberId;
      }

      const errMsg =
        data?.error?.message ||
        listData?.error?.message ||
        '無法確認 META_WA_PHONE_NUMBER_ID（請填 Phone Number ID，唔好填 WABA ID）';
      throw new Error(errMsg);
    } catch (err) {
      console.error('❌ Meta WhatsApp 解析 Phone Number ID 失敗:', err.message);
      throw err;
    }
  }

  /** 正規化為 WhatsApp 國際號碼（無 +）：香港預設 852 */
  normalizePhone(phone) {
    if (!phone) return null;
    let p = String(phone).trim().replace(/^whatsapp:/i, '').replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) p = p.slice(1);
    if (p.startsWith('00')) p = p.slice(2);
    // 本地 8 位手機
    if (/^[456789]\d{7}$/.test(p)) p = `852${p}`;
    // 0 開頭本地
    if (/^0\d{8}$/.test(p)) p = `852${p.slice(1)}`;
    if (!/^\d{8,15}$/.test(p)) return null;
    return p;
  }

  isValidPhoneNumber(phone) {
    return Boolean(this.normalizePhone(phone));
  }

  formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date || '');
    return d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  formatTimeRange(startTime, endTime) {
    return `${startTime || ''}–${endTime || ''}`.replace(/^–|–$/g, '') || '—';
  }

  bodyParams(texts) {
    return {
      type: 'body',
      parameters: texts.map((t) => ({
        type: 'text',
        text: String(t ?? '').trim() || '—',
      })),
    };
  }

  async graphPost(path, body, isFormData = false) {
    const url = `${GRAPH_BASE}/${this.apiVersion}${path}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
    };
    let payload = body;
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(url, { method: 'POST', headers, body: payload });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || res.statusText || 'Meta API error';
      const err = new Error(msg);
      err.code = data?.error?.code;
      err.details = data?.error;
      throw err;
    }
    return data;
  }

  /**
   * 上傳 PNG buffer 為 WhatsApp media，回傳 media id
   */
  async uploadImagePng(buffer) {
    await this.resolvePhoneNumberId();
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'image/png');
    // Node 18+：用 File 較穩陣（Meta 要 filename + mime）
    const file =
      typeof File !== 'undefined'
        ? new File([buffer], 'qrcode.png', { type: 'image/png' })
        : new Blob([buffer], { type: 'image/png' });
    form.append('file', file, 'qrcode.png');

    return this.graphPost(`/${this.phoneNumberId}/media`, form, true);
  }

  /**
   * qrCodeData：HIK base64 圖 / data URL / 或可編碼字串
   */
  async resolveQrPngBuffer(qrCodeData, fallbackPayload) {
    if (qrCodeData) {
      let raw = String(qrCodeData).trim();
      if (raw.startsWith('data:image')) {
        raw = raw.replace(/^data:image\/\w+;base64,/, '');
      }
      // 像 base64 圖片（夠長且無空白）
      if (raw.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(raw)) {
        return Buffer.from(raw.replace(/\s/g, ''), 'base64');
      }
      // 否則當 payload 產生 QR
      return QRCode.toBuffer(raw, { type: 'png', width: 400, margin: 2 });
    }
    if (fallbackPayload) {
      return QRCode.toBuffer(String(fallbackPayload), { type: 'png', width: 400, margin: 2 });
    }
    return null;
  }

  async sendTemplate({ to, templateName, components }) {
    if (!this.isConfigured()) {
      return { success: false, skipped: true, reason: 'not_configured' };
    }
    const phone = this.normalizePhone(to);
    if (!phone) {
      return { success: false, skipped: true, reason: 'invalid_phone' };
    }

    await this.resolvePhoneNumberId();

    const data = await this.graphPost(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: this.templateLang },
        components: components || [],
      },
    });

    return {
      success: true,
      messageId: data?.messages?.[0]?.id || null,
      to: phone,
      raw: data,
    };
  }

  /**
   * 無門禁：只發預約內容
   * Template pickcourt_booking_confirm:
   *   {{1}} 店名 {{2}} 日期 {{3}} 時段 {{4}} 場地 {{5}} 地址
   */
  async sendBookingConfirmation({ phone, storeName, date, startTime, endTime, courtName, storeAddress }) {
    return this.sendTemplate({
      to: phone,
      templateName: this.templateBooking,
      components: [
        this.bodyParams([
          storeName || 'PickCourt',
          this.formatDate(date),
          this.formatTimeRange(startTime, endTime),
          courtName || '場地',
          storeAddress || '—',
        ]),
      ],
    });
  }

  /**
   * 有門禁：QR（header image）+ 密碼等
   * Template pickcourt_access_code:
   *   HEADER: IMAGE
   *   BODY: {{1}} 店名 {{2}} 日期 {{3}} 時段 {{4}} 場地 {{5}} 密碼
   */
  async sendAccessNotification({
    phone,
    storeName,
    date,
    startTime,
    endTime,
    courtName,
    password,
    qrCodeData,
    qrPayload,
  }) {
    const components = [];

    try {
      const png = await this.resolveQrPngBuffer(qrCodeData, qrPayload || password);
      if (png) {
        const uploaded = await this.uploadImagePng(png);
        if (uploaded?.id) {
          components.push({
            type: 'header',
            parameters: [
              {
                type: 'image',
                image: { id: uploaded.id },
              },
            ],
          });
        }
      }
    } catch (mediaErr) {
      console.error('⚠️ Meta WhatsApp QR 上傳失敗，改發純文字模板:', mediaErr.message);
    }

    components.push(
      this.bodyParams([
        storeName || 'PickCourt',
        this.formatDate(date),
        this.formatTimeRange(startTime, endTime),
        courtName || '場地',
        password || '—',
      ])
    );

    return this.sendTemplate({
      to: phone,
      templateName: this.templateAccess,
      components,
    });
  }

  /**
   * 預約取消
   * Template pickcourt_booking_cancel:
   *   {{1}} 店名 {{2}} 日期 {{3}} 時段 {{4}} 場地
   */
  async sendBookingCancellation({ phone, storeName, date, startTime, endTime, courtName }) {
    return this.sendTemplate({
      to: phone,
      templateName: this.templateCancel,
      components: [
        this.bodyParams([
          storeName || 'PickCourt',
          this.formatDate(date),
          this.formatTimeRange(startTime, endTime),
          courtName || '場地',
        ]),
      ],
    });
  }

  /**
   * 依是否有門禁自動選擇模板
   */
  async notifyBooking({
    phone,
    withAccess,
    storeName,
    date,
    startTime,
    endTime,
    courtName,
    storeAddress,
    password,
    qrCodeData,
    qrPayload,
  }) {
    if (!this.isConfigured()) {
      return { success: false, skipped: true, reason: 'not_configured' };
    }
    if (!this.isValidPhoneNumber(phone)) {
      return { success: false, skipped: true, reason: 'invalid_phone' };
    }

    if (withAccess) {
      return this.sendAccessNotification({
        phone,
        storeName,
        date,
        startTime,
        endTime,
        courtName,
        password,
        qrCodeData,
        qrPayload,
      });
    }

    return this.sendBookingConfirmation({
      phone,
      storeName,
      date,
      startTime,
      endTime,
      courtName,
      storeAddress,
    });
  }
}

module.exports = new MetaWhatsAppService();
