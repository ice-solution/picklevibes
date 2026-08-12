/**
 * 大華門禁 HTTP 自動上傳（PictureHttpUpload）
 *
 * 設備請設定：
 *   Address = 你的 PickCourt API host（可達公網／場內）
 *   path    = /api/dahua/hook   或  /api/dahua/hook/<storeId或slug>
 *   Port 443 + HTTPS（唔好用 80，會 redirect 掉 POST body）
 *
 * 注意：ASI 常標 Content-Encoding: deflate 卻送明文；唔經 body-parser inflate，自行讀 raw。
 */
const express = require('express');
const zlib = require('zlib');
const { handleDahuaUpload } = require('../services/dahuaWebhookService');
const DahuaWebhookLog = require('../models/DahuaWebhookLog');

const router = express.Router();

const recentHooks = [];
const RECENT_MAX = 30;

function rememberHook(entry) {
  recentHooks.unshift(entry);
  if (recentHooks.length > RECENT_MAX) recentHooks.pop();
  // 持久化，方便場測後查「機有冇打到」
  DahuaWebhookLog.create(entry).catch((err) => {
    console.warn('⚠️ DahuaWebhookLog 寫入失敗:', err.message);
  });
}

function tryParseBody(rawBuf, contentEncoding) {
  if (!rawBuf) return null;
  const buf0 = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf);
  if (!buf0.length) return null;

  const enc = String(contentEncoding || '').toLowerCase();
  const getters = [() => buf0];

  if (enc.includes('gzip')) {
    getters.unshift(() => zlib.gunzipSync(buf0));
  }
  if (enc.includes('deflate')) {
    getters.unshift(() => zlib.inflateSync(buf0));
    getters.unshift(() => zlib.inflateRawSync(buf0));
  }

  const head = buf0.toString('utf8', 0, Math.min(buf0.length, 32)).trimStart();
  if (head.startsWith('{') || head.startsWith('[')) {
    getters.length = 0;
    getters.push(() => buf0);
    if (enc.includes('gzip')) getters.push(() => zlib.gunzipSync(buf0));
    if (enc.includes('deflate')) {
      getters.push(() => zlib.inflateSync(buf0));
      getters.push(() => zlib.inflateRawSync(buf0));
    }
  }

  for (const getBuf of getters) {
    try {
      const buf = getBuf();
      const text = buf.toString('utf8').replace(/^\uFEFF/, '').trim();
      if (!text) continue;
      return JSON.parse(text);
    } catch {
      /* try next */
    }
  }
  return null;
}

function buildLogBase(req, extra = {}) {
  return {
    at: new Date(),
    remote: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
    encoding: req.headers['content-encoding'] || null,
    contentType: req.headers['content-type'] || null,
    storeKey: req.params.storeKey || null,
    ...extra,
  };
}

router.get(['/hook', '/hook/:storeKey', '/keepalive', '/keepalive/:storeKey'], (req, res) => {
  res.status(200).type('text').send('OK');
});

router.get('/debug/recent', async (req, res) => {
  const expected = process.env.DAHUA_DEBUG_SECRET || process.env.JWT_SECRET || '';
  const got = String(req.query.secret || req.headers['x-dahua-debug'] || '');
  if (!expected || got !== expected) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  try {
    const fromDb = await DahuaWebhookLog.find().sort({ at: -1 }).limit(30).lean();
    res.json({ ok: true, memory: recentHooks, db: fromDb });
  } catch (err) {
    res.json({ ok: true, memory: recentHooks, dbError: err.message });
  }
});

async function processHook(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const data = body.Data || {};

  try {
    const result = await handleDahuaUpload({
      body,
      storeIdOrSlug: req.params.storeKey || null,
    });
    rememberHook(
      buildLogBase(req, {
        code: body.Code || null,
        method: data.Method ?? null,
        qr: data.QRCode || data.QRCodeEx || null,
        sn: data.SN || null,
        uuid: data.TransmissionUuid || null,
        result,
      })
    );
    console.log('📥 大華 webhook', {
      code: body.Code,
      method: data.Method,
      qr: (data.QRCode || data.QRCodeEx || '').toString().slice(0, 48),
      result,
    });
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: result,
    });
  } catch (err) {
    console.error('❌ 大華 webhook 處理例外:', err);
    rememberHook(buildLogBase(req, { result: { reason: 'exception', error: err.message } }));
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: { handled: true, opened: false, reason: 'exception', error: err.message },
    });
  }
}

function readRawBody(req, res, next) {
  const chunks = [];
  let size = 0;
  const limit = 2 * 1024 * 1024;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > limit) {
      res.status(200).json({
        ok: true,
        Result: true,
        code: 0,
        pickcourt: { handled: true, opened: false, reason: 'body_too_large' },
      });
      req.destroy();
    } else {
      chunks.push(chunk);
    }
  });
  req.on('end', () => {
    try {
      req.rawBody = Buffer.concat(chunks);
      const parsed = tryParseBody(req.rawBody, req.headers['content-encoding']);
      req.body = parsed || {};
      if (!parsed) {
        console.warn('⚠️ 大華 webhook：無法解析 body', {
          encoding: req.headers['content-encoding'] || null,
          len: req.rawBody.length,
          head: req.rawBody.toString('utf8', 0, 80),
        });
        rememberHook(
          buildLogBase(req, {
            parseFailed: true,
            head: req.rawBody.toString('utf8', 0, 200),
            result: { reason: 'parse_failed' },
          })
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  });
  req.on('error', next);
}

router.post(['/hook', '/hook/:storeKey'], readRawBody, (req, res) => {
  processHook(req, res).catch((err) => {
    console.error('❌ 大華 webhook processHook:', err);
    if (!res.headersSent) {
      res.status(200).json({
        ok: true,
        Result: true,
        code: 0,
        pickcourt: { handled: true, opened: false, reason: 'exception', error: err.message },
      });
    }
  });
});

module.exports = router;
module.exports.tryParseBody = tryParseBody;
