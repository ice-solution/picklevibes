/**
 * 大華門禁 HTTP 自動上傳（PictureHttpUpload）
 *
 * 設備請設定：
 *   Address = 你的 PickCourt API host（可達公網／場內）
 *   path    = /api/dahua/hook   或  /api/dahua/hook/<storeId或slug>
 *
 * 亦可加第二條上傳，與 MyPickleWorld 並存。
 */
const express = require('express');
const zlib = require('zlib');
const { handleDahuaUpload } = require('../services/dahuaWebhookService');

const router = express.Router();

function tryParseBody(rawBuf, contentEncoding) {
  let buf = rawBuf;
  const enc = String(contentEncoding || '').toLowerCase();
  if (enc.includes('deflate') || enc.includes('gzip')) {
    try {
      buf = enc.includes('gzip') ? zlib.gunzipSync(rawBuf) : zlib.inflateSync(rawBuf);
    } catch {
      try {
        buf = zlib.inflateRawSync(rawBuf);
      } catch {
        /* 部分韌體標 deflate 但實際為明文 */
        buf = rawBuf;
      }
    }
  }
  const text = buf.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** 大華 keepalive */
router.get(['/hook', '/hook/:storeKey', '/keepalive', '/keepalive/:storeKey'], (req, res) => {
  res.status(200).type('text').send('OK');
});

async function processHook(req, res) {
  const storeKey = req.params.storeKey || null;
  let body = req.body;

  // express.json 已解析；若失敗或空，再試 raw
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0 && req.rawBody)) {
    body = tryParseBody(req.rawBody, req.headers['content-encoding']) || body;
  }

  try {
    const result = await handleDahuaUpload({ body, storeIdOrSlug: storeKey });
    // 設備側只要 200；內容仿 PoC
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: result,
    });
  } catch (err) {
    console.error('❌ 大華 webhook 處理例外:', err);
    res.status(200).json({
      ok: true,
      Result: true,
      code: 0,
      pickcourt: { handled: true, opened: false, reason: 'exception', error: err.message },
    });
  }
}

router.post(['/hook', '/hook/:storeKey'], express.raw({ type: '*/*', limit: '2mb' }), (req, res, next) => {
  req.rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
  const parsed = tryParseBody(req.rawBody, req.headers['content-encoding']);
  req.body = parsed || {};
  processHook(req, res).catch(next);
});

module.exports = router;
