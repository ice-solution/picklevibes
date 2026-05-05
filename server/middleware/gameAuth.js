const jwt = require('jsonwebtoken');

/**
 * Game client JWT 驗證（與用戶 JWT 分開）
 * - Header: Authorization: Bearer <token>
 * - Secret: GAME_JWT_SECRET
 */
function gameAuth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: '缺少遊戲端令牌' });

    const secret = process.env.GAME_JWT_SECRET;
    if (!secret) return res.status(500).json({ message: '服務器未配置 GAME_JWT_SECRET' });

    const decoded = jwt.verify(token, secret);
    req.gameClient = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: '遊戲端令牌無效' });
  }
}

module.exports = { gameAuth };

