const Store = require('../models/Store');

/**
 * 外部 Open API 金鑰驗證（店鋪級）
 * Header: X-API-Key: <key>  或  Authorization: Bearer <key>
 *
 * 成功後設定 req.openApiAuth = { store, legacy? }
 * - store：金鑰所屬且已啟用 Open API 的店鋪
 * - legacy：舊版 .env 金鑰（過渡用，可存取所有 openApiEnabled 店鋪）
 */
function getLegacyEnvKeys() {
  const raw =
    process.env.BOOKING_OPEN_API_KEYS || process.env.BOOKING_OPEN_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function extractApiKey(req) {
  const headerKey = req.header('X-API-Key');
  const auth = req.header('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  return headerKey || bearer || '';
}

async function openApiAuth(req, res, next) {
  const key = extractApiKey(req);

  if (key) {
    const store = await Store.findOne({
      openApiEnabled: true,
      openApiKey: key,
      isActive: true,
    })
      .select('_id name slug openApiEnabled')
      .lean();

    if (store) {
      req.openApiAuth = { store };
      return next();
    }

    const legacyKeys = getLegacyEnvKeys();
    if (legacyKeys.includes(key)) {
      req.openApiAuth = { store: null, legacy: true };
      return next();
    }

    return res.status(401).json({ message: '無效的 API Key' });
  }

  if (process.env.NODE_ENV === 'development') {
    const hasStoreKeys = await Store.exists({
      openApiEnabled: true,
      openApiKey: { $nin: [null, ''] },
    });
    if (!hasStoreKeys && getLegacyEnvKeys().length === 0) {
      req.openApiAuth = { store: null, devBypass: true };
      return next();
    }
  }

  return res.status(401).json({ message: '無效的 API Key' });
}

module.exports = { openApiAuth, getLegacyEnvKeys, extractApiKey };
