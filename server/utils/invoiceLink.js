const crypto = require('crypto');

const DEFAULT_TTL_SEC = 90 * 24 * 60 * 60; // 90 days

function getSecret() {
  return process.env.JWT_SECRET || process.env.INVOICE_LINK_SECRET || 'picklevibes-invoice';
}

/**
 * API 對外 origin（不含 /api），供郵件內下載連結使用。
 * 勿用 CLIENT_URL（前端），否則連結會指錯 host。
 */
function getApiOrigin() {
  const candidates = [
    process.env.SERVER_PUBLIC_URL,
    process.env.SERVER_URL,
    process.env.API_BASE_URL,
    process.env.REACT_APP_SERVER_URL,
    process.env.REACT_APP_API_URL,
  ];

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string' || !raw.trim()) continue;
    let url = raw.trim().replace(/\/$/, '');
    url = url.replace(/\/api$/i, '');
    if (url) return url;
  }

  const port = process.env.PORT || 5001;
  return `http://localhost:${port}`;
}

function signPayload(payload, ttlSec = DEFAULT_TTL_SEC) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const body = Buffer.from(JSON.stringify({ ...payload, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'invalid_token' };
  }
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'bad_signature' };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'bad_payload' };
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: 'expired' };
  }
  return { ok: true, payload };
}

function buildRechargeInvoiceUrl(rechargeId) {
  const id = String(rechargeId);
  const token = signPayload({ typ: 'recharge', id });
  return `${getApiOrigin()}/api/invoices/recharge/${id}.pdf?token=${encodeURIComponent(token)}`;
}

function buildBookingInvoiceUrl(bookingId) {
  const id = String(bookingId);
  const token = signPayload({ typ: 'booking', id });
  return `${getApiOrigin()}/api/invoices/booking/${id}.pdf?token=${encodeURIComponent(token)}`;
}

module.exports = {
  getApiOrigin,
  signPayload,
  verifyToken,
  buildRechargeInvoiceUrl,
  buildBookingInvoiceUrl,
};
