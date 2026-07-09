/**
 * n8n / WhatsApp bot 專用 API Key 認證
 * Header: X-Bot-Key: <BOT_API_KEY>
 */
function botAuth(req, res, next) {
  const expected = String(process.env.BOT_API_KEY || '').trim();
  if (!expected) {
    return res.status(503).json({
      success: false,
      message: 'Bot API 未啟用，請設定 BOT_API_KEY',
    });
  }

  const key =
    req.header('X-Bot-Key') ||
    req.header('x-bot-key') ||
    req.header('X-API-Key') ||
    '';

  if (!key || key !== expected) {
    return res.status(401).json({
      success: false,
      message: 'Bot API Key 無效',
    });
  }

  next();
}

module.exports = { botAuth };
