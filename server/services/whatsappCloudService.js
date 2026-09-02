/**
 * WhatsApp Business Cloud API（Meta Graph API）
 *
 * .env:
 *   WHATSAPP_CLOUD_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   WHATSAPP_API_VERSION=v21.0
 */
const axios = require('axios');

function isWhatsAppCloudConfigured() {
  if (process.env.WHATSAPP_CLOUD_ENABLED === '0' || process.env.WHATSAPP_CLOUD_ENABLED === 'false') {
    return false;
  }
  const token = String(process.env.WHATSAPP_CLOUD_TOKEN || '').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  return Boolean(token && phoneNumberId);
}

/** E.164 digits only（API 不帶 +） */
function normalizePhoneE164(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';

  if (input.includes('@')) {
    return input.split('@')[0].replace(/\D/g, '');
  }

  let d = input.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('852') && d.length >= 11) return d;
  if (d.length === 8) return `852${d}`;
  return d;
}

function isValidPhoneNumber(phone) {
  const e164 = normalizePhoneE164(phone);
  return e164.length >= 10 && e164.length <= 15;
}

function buildGraphUrl(path) {
  const version = String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID).trim();
  const base = `https://graph.facebook.com/${version}/${phoneNumberId}`;
  return path ? `${base}${path.startsWith('/') ? path : `/${path}`}` : base;
}

function toBodyParameters(values) {
  return (values || []).map((text) => ({
    type: 'text',
    text: text == null ? '' : String(text),
  }));
}

/**
 * @param {object} opts
 * @param {string} opts.to - phone or chat id
 * @param {string} opts.templateName
 * @param {string} [opts.languageCode]
 * @param {string[]} [opts.bodyParameters]
 */
async function sendTemplateMessage({ to, templateName, languageCode = 'zh_HK', bodyParameters = [] }) {
  if (!isWhatsAppCloudConfigured()) {
    const err = new Error(
      'WhatsApp Cloud API 未設定：請設定 WHATSAPP_CLOUD_TOKEN 及 WHATSAPP_PHONE_NUMBER_ID'
    );
    err.code = 'WHATSAPP_CLOUD_NOT_CONFIGURED';
    throw err;
  }

  const recipient = normalizePhoneE164(to);
  if (!recipient) {
    const err = new Error('無效的通知電話號碼');
    err.code = 'INVALID_PHONE';
    throw err;
  }

  const url = buildGraphUrl('/messages');
  const token = String(process.env.WHATSAPP_CLOUD_TOKEN).trim();
  const timeout = Number(process.env.WHATSAPP_CLOUD_TIMEOUT_MS) || 15000;

  const payload = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: String(templateName).trim(),
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: toBodyParameters(bodyParameters),
        },
      ],
    },
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout,
  });

  return {
    success: true,
    provider: 'whatsapp_cloud',
    to: recipient,
    templateName,
    messageId: res.data?.messages?.[0]?.id || null,
    data: res.data,
  };
}

async function sendTemplateToMany(phones, options) {
  const list = [...new Set((phones || []).map((p) => String(p || '').trim()).filter(Boolean))];
  const results = [];
  for (const phone of list) {
    try {
      const r = await sendTemplateMessage({ ...options, to: phone });
      results.push({ phone, ok: true, ...r });
    } catch (error) {
      console.error(`❌ WhatsApp Cloud 發送失敗 (${phone}):`, error.response?.data || error.message);
      results.push({
        phone,
        ok: false,
        error: error.response?.data?.error?.message || error.message,
        code: error.code,
        status: error.response?.status,
      });
    }
  }
  return results;
}

module.exports = {
  isWhatsAppCloudConfigured,
  isValidPhoneNumber,
  normalizePhoneE164,
  sendTemplateMessage,
  sendTemplateToMany,
};
