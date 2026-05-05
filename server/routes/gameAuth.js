const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const GameClient = require('../models/GameClient');

const router = express.Router();

const gameLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分鐘
  max: 20,
  message: { message: '請求過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false
});

function issueGameJwt({ clientId, expiresInDays }) {
  const secret = process.env.GAME_JWT_SECRET;
  if (!secret) throw new Error('Missing GAME_JWT_SECRET');

  const cid = (clientId || 'game-client').toString();
  const days = expiresInDays ? Number(expiresInDays) : 30;
  const expiresInSec = Math.max(60, Math.min(365 * 24 * 3600, Math.floor(days * 24 * 3600)));
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  const token = jwt.sign(
    { iss: 'picklevibes', aud: 'game-client', sub: cid },
    secret,
    { expiresIn: expiresInSec }
  );

  return { token, expiresAt };
}

// @route   POST /api/game-auth/login
// @desc    遊戲端用 clientId + secret 取得 GAME JWT
// @access  Public（受 rate limit 保護）
router.post('/login', [
  gameLoginLimiter,
  body('clientId').isString().isLength({ min: 1, max: 64 }).withMessage('clientId 必須為 1-64 字'),
  body('clientSecret').isString().isLength({ min: 1, max: 256 }).withMessage('clientSecret 必須為字串'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('expiresInDays 必須為 1-365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const client = await GameClient.findOne({ clientId: req.body.clientId }).select('+secretHash');
    if (!client || client.isActive === false) {
      return res.status(401).json({ message: 'Game client 認證失敗' });
    }
    const ok = await bcrypt.compare(String(req.body.clientSecret), String(client.secretHash));
    if (!ok) return res.status(401).json({ message: 'Game client 認證失敗' });

    client.lastLoginAt = new Date();
    await client.save();

    const { token, expiresAt } = issueGameJwt({ clientId: client.clientId, expiresInDays: req.body.expiresInDays });
    res.json({ data: { token, expiresAt } });
  } catch (error) {
    console.error('game login 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/game-auth/token
// @desc    管理員簽發 GAME JWT（給遊戲端使用）
// @access  Private(Admin)
router.post('/token', [
  auth,
  adminAuth,
  body('clientId').optional().isString().isLength({ min: 1, max: 64 }).withMessage('clientId 必須為 1-64 字'),
  body('expiresInDays').optional().isInt({ min: 1, max: 365 }).withMessage('expiresInDays 必須為 1-365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }
    const { token, expiresAt } = issueGameJwt({ clientId: req.body.clientId, expiresInDays: req.body.expiresInDays });
    res.json({ data: { token, expiresAt } });
  } catch (error) {
    console.error('簽發 GAME JWT 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;

