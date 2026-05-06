const express = require('express');
const QRCode = require('qrcode');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const GameHall = require('../models/GameHall');
const GameSession = require('../models/GameSession');
const GameMatch = require('../models/GameMatch');
const GameLeaderboardEntry = require('../models/GameLeaderboardEntry');
const User = require('../models/User');

const { auth } = require('../middleware/auth');
const { gameAuth } = require('../middleware/gameAuth');
const { signQrPayload, verifyQrPayload } = require('../utils/gameQr');

const router = express.Router();

function randomSocketCode() {
  // 8碼可讀性較高，避免太短被撞
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function getClientBaseUrl(req) {
  const env = process.env.CLIENT_URL || '';
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/+$/, '');
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

function getApiBaseUrl(req) {
  const host = req.get('host');
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${host}`;
}

// @route   GET /api/games/:id/info
// @desc    遊戲端取得 game hall info + 生成 session + 回傳 QR 圖片 URL + socketCode
// @access  Private(Game JWT)
router.get('/:id/info', gameAuth, async (req, res) => {
  try {
    const gameHall = await GameHall.findById(req.params.id).lean();
    if (!gameHall || gameHall.isActive === false) return res.status(404).json({ message: '遊戲廳不存在' });

    const socketCode = randomSocketCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分鐘

    const session = await GameSession.create({
      gameHall: gameHall._id,
      socketCode,
      status: 'created',
      boundUser: null,
      expiresAt
    });

    const payload = String(session._id);
    const sig = signQrPayload(payload);
    const apiBase = getApiBaseUrl(req);
    const qrCodeImageUrl = `${apiBase}/api/games/sessions/${payload}/qrcode.png?sig=${sig}`;

    res.json({
      data: {
        gameHall: {
          _id: gameHall._id,
          name: gameHall.name,
          description: gameHall.description || '',
          seasonKey: gameHall.seasonKey || 'season-1'
        },
        session: {
          _id: session._id,
          socketCode,
          expiresAt
        },
        qr: {
          payload,
          sig,
          imageUrl: qrCodeImageUrl,
          // 讓遊戲端可直接用 payload 開網頁掃碼
          joinUrl: `${getClientBaseUrl(req)}/game/join/${payload}?sig=${sig}&code=${encodeURIComponent(socketCode)}`
        }
      }
    });
  } catch (error) {
    console.error('get game info 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/games/sessions/:sessionId/qrcode.png
// @desc    取得 session QR code 圖片（PNG）
// @access  Public（但需 sig）
router.get('/sessions/:sessionId/qrcode.png', async (req, res) => {
  try {
    const { sig } = req.query;
    const sessionId = String(req.params.sessionId);
    if (!verifyQrPayload(sessionId, sig)) return res.status(403).json({ message: 'QR 簽名無效' });

    // 只要 session 存在即可（避免被猜到 _id）
    const session = await GameSession.findById(sessionId).select('_id').lean();
    if (!session) return res.status(404).json({ message: 'Session 不存在' });

    const png = await QRCode.toBuffer(sessionId, { type: 'png', width: 280, margin: 1 });
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(png);
  } catch (error) {
    console.error('取得 QR 圖片錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/games/sessions/:sessionId/join
// @desc    用戶掃碼後綁定 session（需登入）
// @access  Private(User)
router.post('/sessions/:sessionId/join', [
  auth,
  body('sig').isString().withMessage('sig 必須為字串'),
  body('code').isString().withMessage('code 必須為字串'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const sessionId = String(req.params.sessionId);
    const { sig, code } = req.body;
    if (!verifyQrPayload(sessionId, sig)) return res.status(403).json({ message: 'QR 簽名無效' });

    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session 不存在' });
    if (session.expiresAt < new Date()) return res.status(400).json({ message: 'Session 已過期' });
    if (String(session.socketCode) !== String(code)) return res.status(400).json({ message: 'Socket code 不匹配' });

    session.boundUser = req.user.id;
    session.status = 'bound';
    await session.save();

    const boundUser = await User.findById(req.user.id).select('name').lean();
    const username = boundUser?.name || '';

    const io = req.app.get('io');
    // 通知遊戲端：有人登入成功並綁定 session
    if (io) {
      io.to(`gameHall:${session.gameHall.toString()}`).emit('session:bound', {
        sessionId: session._id,
        userId: req.user.id,
        username
      });

      io.to(`gameHall:${session.gameHall.toString()}`).emit('session:setting', {
        sessionId: session._id,
        settings: {
          displayName: true
        }
      });
    }

    res.json({ message: '已綁定 session', data: { sessionId: session._id } });
  } catch (error) {
    console.error('join session 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/games/sessions/:sessionId/start
// @desc    用戶在手機端按「開始遊戲」後通知遊戲端
// @access  Private(User)
router.post('/sessions/:sessionId/start', auth, async (req, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session 不存在' });
    if (session.expiresAt < new Date()) return res.status(400).json({ message: 'Session 已過期' });
    if (!session.boundUser) return res.status(400).json({ message: 'Session 尚未綁定用戶' });
    if (String(session.boundUser) !== String(req.user.id)) return res.status(403).json({ message: '無權限操作此 Session' });
    if (session.status !== 'bound' && session.status !== 'started') {
      return res.status(400).json({ message: 'Session 狀態不允許開始' });
    }

    // idempotent：重複按也可
    session.status = 'started';
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`gameHall:${session.gameHall.toString()}`).emit('session:started', {
        sessionId: String(session._id),
        userId: String(req.user.id)
      });
    }

    res.json({ message: '已通知開始遊戲', data: { sessionId: session._id } });
  } catch (error) {
    console.error('start session 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/games/sessions/:sessionId/result
// @desc    遊戲端提交結果（更新 leaderboard + 通知用戶端）
// @access  Private(Game JWT)
router.post('/sessions/:sessionId/result', [
  gameAuth,
  body('userId').isMongoId().withMessage('userId 必須為 MongoId'),
  body('scores').isNumeric().withMessage('scores 必須為數字'),
  body('hitRate').optional().isFloat().withMessage('hitRate 必須為 float'),
  body('maxCombo').optional().isInt().withMessage('maxCombo 必須為 number'),
  body('history').optional().custom((value) => {
    // history 可以係 object 或 array（由遊戲端決定格式）
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) return true;
    if (typeof value === 'object') return true;
    throw new Error('history 必須為 object 或 array');
  }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const sessionId = String(req.params.sessionId);
    const session = await GameSession.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session 不存在' });

    const gameHall = await GameHall.findById(session.gameHall).lean();
    if (!gameHall) return res.status(404).json({ message: '遊戲廳不存在' });

    const seasonKey = gameHall.seasonKey || 'season-1';
    const userId = req.body.userId;

    const match = await GameMatch.create({
      gameHall: gameHall._id,
      seasonKey,
      session: session._id,
      user: userId,
      scores: Number(req.body.scores),
      hitRate: req.body.hitRate === undefined || req.body.hitRate === null ? null : Number(req.body.hitRate),
      maxCombo: req.body.maxCombo === undefined || req.body.maxCombo === null ? null : Number(req.body.maxCombo),
      history: req.body.history ?? {}
    });

    await GameLeaderboardEntry.findOneAndUpdate(
      { gameHall: gameHall._id, seasonKey, user: userId },
      {
        $inc: { totalScore: Number(req.body.scores), matches: 1 },
        $set: { lastMatchAt: new Date() }
      },
      { upsert: true, new: true }
    );

    session.status = 'finished';
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('game:result', {
        gameHallId: String(gameHall._id),
        sessionId: String(session._id),
        matchId: String(match._id),
        scores: Number(req.body.scores)
      });
      io.to(`gameHall:${gameHall._id.toString()}`).emit('game:matchSaved', {
        sessionId: String(session._id),
        userId: String(userId),
        scores: Number(req.body.scores)
      });
    }

    res.json({ message: '已接收結果', data: { matchId: match._id } });
  } catch (error) {
    console.error('提交結果錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/games/:id/leaderboard
// @desc    取得該遊戲廳一期排行榜
// @access  Public（或給遊戲端）
router.get('/:id/leaderboard', async (req, res) => {
  try {
    const gameHall = await GameHall.findById(req.params.id).lean();
    if (!gameHall) return res.status(404).json({ message: '遊戲廳不存在' });

    const seasonKey = gameHall.seasonKey || 'season-1';
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));

    const entries = await GameLeaderboardEntry.find({ gameHall: gameHall._id, seasonKey })
      .sort({ totalScore: -1, matches: -1, updatedAt: 1 })
      .limit(limit)
      .populate('user', 'name')
      .lean();

    res.json({
      data: {
        gameHall: { _id: gameHall._id, name: gameHall.name, seasonKey },
        leaderboard: entries.map((e) => ({
          userId: e.user?._id || e.user,
          name: e.user?.name || '',
          totalScore: e.totalScore || 0,
          matches: e.matches || 0,
          lastMatchAt: e.lastMatchAt || null
        }))
      }
    });
  } catch (error) {
    console.error('取得排行榜錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;

