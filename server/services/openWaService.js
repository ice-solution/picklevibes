/**
 * OpenWA HTTP 發送客戶端（對齊 OpenWA v0.8.x REST API）
 *
 * UI 側欄唔會有「send-message」選單；請用：
 *   - 工作階段：建立／登入 session（記住 sessionId / name）
 *   - API 金鑰：建立 OPERATOR 或以上 key → 放 .env OPENWA_API_KEY
 *   - 訊息測試器：可手動試發送
 *   - Webhooks：入站用，夜間通知唔使填
 *
 * .env 例：
 *   OPENWA_ENABLED=1
 *   OPENWA_BASE_URL=http://127.0.0.1:2785
 *   OPENWA_API_KEY=owa_k1_xxxxx
 *   OPENWA_SESSION_ID=my-session
 *   OPENWA_AUTH_HEADER=X-API-Key
 *
 * 實際呼叫：
 *   POST {BASE}/api/sessions/{SESSION}/messages/send-text
 *   Header: X-API-Key: ...
 *   Body: { "chatId": "85291234567@c.us", "text": "..." }
 */
const axios = require('axios');

function isOpenWaConfigured() {
  if (process.env.OPENWA_ENABLED === '0' || process.env.OPENWA_ENABLED === 'false') {
    return false;
  }
  const base = String(process.env.OPENWA_BASE_URL || '').trim();
  const key = String(process.env.OPENWA_API_KEY || '').trim();
  const session = String(process.env.OPENWA_SESSION_ID || '').trim();
  return Boolean(base && key && session);
}

/** 轉成 OpenWA chatId：支援電話或已是 chatId（含 @c.us / @g.us） */
function toChatId(raw) {
  const input = String(raw || '').trim();
  if (!input) return '';

  // 已是 OpenWA chatId（個人 @c.us 或群組 @g.us 等）→ 原樣使用
  if (input.includes('@')) {
    return input;
  }

  let d = input.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('852') && d.length >= 11) {
    // ok
  } else if (d.length === 8) {
    d = `852${d}`;
  }
  return `${d}@c.us`;
}

function normalizePhoneForOpenWa(phone) {
  return toChatId(phone).replace(/@c\.us$/i, '');
}

function buildSendUrl() {
  const base = String(process.env.OPENWA_BASE_URL).replace(/\/$/, '');
  const session = encodeURIComponent(String(process.env.OPENWA_SESSION_ID).trim());
  // 若自訂完整 path（進階），可覆寫
  const customPath = String(process.env.OPENWA_SEND_PATH || '').trim();
  if (customPath.startsWith('http')) return customPath;
  if (customPath) {
    const p = customPath
      .replace('{sessionId}', String(process.env.OPENWA_SESSION_ID).trim())
      .replace('{SESSION}', String(process.env.OPENWA_SESSION_ID).trim());
    return `${base}${p.startsWith('/') ? p : `/${p}`}`;
  }
  return `${base}/api/sessions/${session}/messages/send-text`;
}

async function sendTextMessage(to, message) {
  if (!isOpenWaConfigured()) {
    const err = new Error(
      'OpenWA 未設定完整：請在 .env 設定 OPENWA_BASE_URL、OPENWA_API_KEY、OPENWA_SESSION_ID，並 OPENWA_ENABLED=1'
    );
    err.code = 'OPENWA_NOT_CONFIGURED';
    throw err;
  }

  const chatId = toChatId(to);
  if (!chatId) {
    const err = new Error('無效的通知電話號碼');
    err.code = 'INVALID_PHONE';
    throw err;
  }

  const url = buildSendUrl();
  const headers = { 'Content-Type': 'application/json' };
  const apiKey = String(process.env.OPENWA_API_KEY || '').trim();
  const authHeader = String(process.env.OPENWA_AUTH_HEADER || 'X-API-Key').trim();
  if (authHeader.toLowerCase() === 'authorization') {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers[authHeader] = apiKey;
  }

  const body = {
    chatId,
    text: String(message || ''),
  };

  const timeout = Number(process.env.OPENWA_TIMEOUT_MS) || 15000;
  const res = await axios.post(url, body, { headers, timeout });
  return {
    success: true,
    status: res.status,
    data: res.data,
    to: chatId,
  };
}

async function sendTextToMany(phones, message) {
  const list = [...new Set((phones || []).map((p) => String(p || '').trim()).filter(Boolean))];
  const results = [];
  for (const phone of list) {
    try {
      const r = await sendTextMessage(phone, message);
      results.push({ phone, ok: true, ...r });
    } catch (error) {
      console.error(`❌ OpenWA 發送失敗 (${phone}):`, error.response?.data || error.message);
      results.push({
        phone,
        ok: false,
        error: error.response?.data?.message || error.message,
        code: error.code,
        status: error.response?.status,
      });
    }
  }
  return results;
}

module.exports = {
  isOpenWaConfigured,
  normalizePhoneForOpenWa,
  toChatId,
  sendTextMessage,
  sendTextToMany,
};
