/**
 * WhatsApp Cloud API Webhook
 *
 * GET  — Meta verify（hub.verify_token / hub.challenge）
 * POST — delivery status + inbound messages（可轉發去 n8n）
 *
 * Env:
 *   WHATSAPP_APP_SECRET
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   WHATSAPP_N8N_FORWARD_URL   （可選：inbound 轉發去 n8n webhook）
 *   WHATSAPP_WEBHOOK_LOG_INBOUND=1
 */
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const router = express.Router();

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !String(signatureHeader).startsWith('sha256=')) return false;
  if (!appSecret) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = String(signatureHeader).slice('sha256='.length);
  return timingSafeEqualHex(expected, provided);
}

function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.rawBody !== 'undefined') {
    return Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(String(req.rawBody || ''));
  }
  return Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
}

function parseJsonBody(req) {
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString('utf8') || '{}');
    } catch {
      return null;
    }
  }
  if (req.body && typeof req.body === 'object') return req.body;
  return null;
}

// @route   GET /api/whatsapp/webhook
// @desc    Meta webhook verification
router.get('/', (req, res) => {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const expected = String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();

  if (mode === 'subscribe' && expected && token === expected) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  console.warn('⚠️ WhatsApp webhook verify failed', { mode, tokenMatch: token === expected });
  return res.sendStatus(403);
});

async function forwardInboundToN8n(payload, inboundMessages) {
  const url = String(process.env.WHATSAPP_N8N_FORWARD_URL || '').trim();
  if (!url || !inboundMessages.length) return { skipped: true };

  try {
    await axios.post(
      url,
      {
        source: 'picklevibes_whatsapp_webhook',
        receivedAt: new Date().toISOString(),
        messages: inboundMessages,
        raw: payload,
      },
      {
        timeout: Number(process.env.WHATSAPP_N8N_FORWARD_TIMEOUT_MS) || 10000,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return { forwarded: true, count: inboundMessages.length };
  } catch (err) {
    console.error('❌ WhatsApp → n8n 轉發失敗:', err.response?.data || err.message);
    return { forwarded: false, error: err.message };
  }
}

function extractInboundMessages(payload) {
  const out = [];
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field && change.field !== 'messages') continue;
      const value = change.value || {};
      const contacts = value.contacts || [];
      const contactName = contacts[0]?.profile?.name || null;
      for (const msg of value.messages || []) {
        out.push({
          wabaId: entry.id || null,
          phoneNumberId: value.metadata?.phone_number_id || null,
          displayPhone: value.metadata?.display_phone_number || null,
          contactName,
          from: msg.from,
          id: msg.id,
          timestamp: msg.timestamp,
          type: msg.type,
          text: msg.text?.body || null,
          button: msg.button || null,
          interactive: msg.interactive || null,
        });
      }
    }
  }
  return out;
}

function extractStatuses(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const st of value.statuses || []) {
        out.push({
          id: st.id,
          status: st.status,
          timestamp: st.timestamp,
          recipientId: st.recipient_id,
          errors: st.errors || [],
        });
      }
    }
  }
  return out;
}

// @route   POST /api/whatsapp/webhook
// @desc    Receive statuses + inbound; optionally forward inbound to n8n
router.post('/', async (req, res) => {
  // 先快速 200，避免 Meta 重試（轉發／log 喺之後做）
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  const signature = req.get('X-Hub-Signature-256') || req.get('x-hub-signature-256');
  const raw = getRawBody(req);

  if (appSecret) {
    if (!verifyMetaSignature(raw, signature, appSecret)) {
      console.warn('⚠️ WhatsApp webhook 簽名無效');
      return res.sendStatus(403);
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ WHATSAPP_APP_SECRET 未設定，production 拒絕 webhook');
    return res.sendStatus(503);
  }

  const payload = parseJsonBody(req);
  if (!payload) {
    return res.sendStatus(400);
  }

  res.sendStatus(200);

  try {
    const statuses = extractStatuses(payload);
    const inbound = extractInboundMessages(payload);
    const logInbound = process.env.WHATSAPP_WEBHOOK_LOG_INBOUND === '1';

    for (const st of statuses) {
      const errPart =
        st.status === 'failed' && st.errors?.length
          ? ` errors=${JSON.stringify(st.errors)}`
          : '';
      console.log(
        `📨 WA status ${st.status} id=${st.id} to=${st.recipientId}${errPart}`
      );
    }

    if (logInbound && inbound.length) {
      console.log(
        '📥 WA inbound:',
        inbound.map((m) => ({ id: m.id, from: m.from, type: m.type, text: m.text }))
      );
    }

    if (inbound.length) {
      await forwardInboundToN8n(payload, inbound);
    }
  } catch (err) {
    console.error('❌ WhatsApp webhook 處理錯誤:', err);
  }
});

module.exports = router;
