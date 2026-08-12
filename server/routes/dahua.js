/**
 * 大華門禁 HTTP 自動上傳（PictureHttpUpload）
 *
 * 設備請設定：
 *   Address = 你的 PickCourt API host（可達公網／場內）
 *   path    = /api/dahua/hook   或  /api/dahua/hook/<storeId或slug>
 *
 * 亦可加第二條上傳，與 MyPickleWorld 並存。
 *
 * 注意：ASI 系列常帶 Content-Encoding: deflate，但 body 實際係明文 JSON。
 * 必須先試 raw JSON，失敗先再試解壓（唔好優先 inflateRaw）。
 */
const express = require('express');
const zlib = require('zlib');
const { handleDahuaUpload } = require('../services/dahuaWebhookService');

const router = express.Router();

/** 最近幾次推送（診斷用，唔含敏感 store 密碼） */
const recentHooks = [];
const RECENT_MAX = 30;

function rememberHook(entry) {
  recentHooks.unshift(entry);
  if (recentHooks.length > RECENT_MAX) recentHooks.pop();
}

function tryParseBody(rawBuf, contentEncoding) {
  if (!rawBuf) return null;
  const buf0 = Buffer.isBuffer(rawBuf) ? rawBuf : Buffer.from(rawBuf);
  if (!buf0.length) return null;

  const enc = String(contentEncoding || '').toLowerCase();
  const getters = [() => buf0];

  // 標示壓縮時先試解壓，但 raw 仍然保留作 fallback（韌體常標 deflate 卻送明文）
  if (enc.includes('gzip')) {
    getters.unshift(() => zlib.gunzipSync(buf0));
  }
  if (enc.includes('deflate')) {
    getters.unshift(() => zlib.inflateSync(buf0));
    getters.unshift(() => zlib.inflateRawSync(buf0));
  }

  // 關鍵：若看起來已係 JSON，優先用原文（避免 inflateRaw 把明文「解」成垃圾卻唔 throw）
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

/** 大華 keepalive／連線測試 */
router.get(['/hook', '/hook/:storeKey', '/keepalive', '/keepalive/:storeKey'], (req, res) => {
  res.status(200).type('text').send('OK');
});

/** 診斷：最近 webhook（可選 ?secret=DAHUA_DEBUG_SECRET） */
router.get('/debug/recent', (req, res) => {
  const expected = process.env.DAHUA_DEBUG_SECRET || process.env.JWT_SECRET || '';
  const got = String(req.query.secret || req.headers['x-dahua-debug'] || '');
  if (!expected || got !== expected) {
    return res.status(401).json({ ok: false, message: 'unauthorized' });
  }
  res.json({ ok: true, count: recentHooks.length, recent: recentHooks });
});

async function processHook(req, res) {
  const storeKey = req.params.storeKey || null;
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  try {
    const result = await handleDahuaUpload({ body, storeIdOrSlug: storeKey });
    rememberHook({
      at: new Date().toISOString(),
      storeKey,
      encoding: req.headers['content-encoding'] || null,
      code: body.Code || null,
      method: body.Data?.Method ?? null,
      qr: body.Data?.QRCode || body.Data?.QRCodeEx || null,
      sn: body.Data?.SN || null,
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
    rememberHook({
      at: new Date().toISOString(),
      storeKey,
      error: err.message,
    });
    // 仍回 200，避免設備狂重試；內容標明失敗
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: { handled: true, opened: false, reason: 'exception', error: err.message },
    });
  }
}

router.post(['/hook', '/hook/:storeKey'], express.raw({ type: '*/*', limit: '2mb' }), (req, res) => {
  try {
    req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    const parsed = tryParseBody(req.rawBody, req.headers['content-encoding']);
    req.body = parsed || {};
    if (!parsed) {
      console.warn('⚠️ 大華 webhook：無法解析 body', {
        encoding: req.headers['content-encoding'] || null,
        len: req.rawBody.length,
        head: req.rawBody.toString('utf8', 0, 80),
      });
      rememberHook({
        at: new Date().toISOString(),
        storeKey: req.params.storeKey || null,
        encoding: req.headers['content-encoding'] || null,
        parseFailed: true,
        head: req.rawBody.toString('utf8', 0, 120),
      });
    }
    processHook(req, res);
  } catch (err) {
    console.error('❌ 大華 webhook 前置解析例外:', err);
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: { handled: true, opened: false, reason: 'parse_exception', error: err.message },
    });
  }
});

module.exports = router;
module.exports.tryParseBody = tryParseBody;
