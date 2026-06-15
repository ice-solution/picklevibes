/**
 * 外部 Open API 金鑰驗證
 * Header: X-API-Key: <key>  或  Authorization: Bearer <key>
 * Env: BOOKING_OPEN_API_KEYS（逗號分隔）或 BOOKING_OPEN_API_KEY
 */
function getAllowedKeys() {
  const raw =
    process.env.BOOKING_OPEN_API_KEYS || process.env.BOOKING_OPEN_API_KEY || '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

function openApiAuth(req, res, next) {
  const allowed = getAllowedKeys();

  if (allowed.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(503).json({
      message: 'Open API 尚未設定 BOOKING_OPEN_API_KEY',
    });
  }

  const headerKey = req.header('X-API-Key');
  const auth = req.header('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const key = headerKey || bearer;

  if (!key || !allowed.includes(key)) {
    return res.status(401).json({ message: '無效的 API Key' });
  }

  next();
}

module.exports = { openApiAuth, getAllowedKeys };
