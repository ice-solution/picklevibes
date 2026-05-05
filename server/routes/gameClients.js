const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const GameClient = require('../models/GameClient');

const router = express.Router();

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function generateSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

// @route   GET /api/game-clients
// @desc    管理員取得 game clients
// @access  Private(Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { q = '' } = req.query;
    const query = {};
    const s = String(q || '').trim();
    if (s) {
      const safe = escapeRegex(s);
      query.$or = [
        { clientId: { $regex: safe, $options: 'i' } },
        { name: { $regex: safe, $options: 'i' } }
      ];
    }
    const items = await GameClient.find(query).sort({ createdAt: -1 }).lean();
    res.json({ data: { items } });
  } catch (error) {
    console.error('取得 game clients 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/game-clients
// @desc    建立 game client（回傳一次性 secret）
// @access  Private(Admin)
router.post('/', [
  auth,
  adminAuth,
  body('clientId').trim().isLength({ min: 3, max: 64 }).withMessage('clientId 必須為 3-64 字'),
  body('name').optional().isString().isLength({ max: 80 }).withMessage('name 最多 80 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const secret = generateSecret();
    const secretHash = await bcrypt.hash(secret, 12);

    const item = await GameClient.create({
      clientId: req.body.clientId,
      name: req.body.name || '',
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
      secretHash
    });

    res.status(201).json({ message: 'Game client 已建立', data: { item, clientSecret: secret } });
  } catch (error) {
    if (error?.code === 11000) return res.status(400).json({ message: 'clientId 已存在' });
    console.error('建立 game client 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PUT /api/game-clients/:id
// @desc    更新 game client（不包含 secret）
// @access  Private(Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().isString().isLength({ max: 80 }).withMessage('name 最多 80 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const item = await GameClient.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {})
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Game client 不存在' });
    res.json({ message: '已更新', data: { item } });
  } catch (error) {
    console.error('更新 game client 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/game-clients/:id/reset-secret
// @desc    重置 secret（回傳一次性新 secret）
// @access  Private(Admin)
router.post('/:id/reset-secret', [auth, adminAuth], async (req, res) => {
  try {
    const item = await GameClient.findById(req.params.id).select('+secretHash');
    if (!item) return res.status(404).json({ message: 'Game client 不存在' });

    const secret = generateSecret();
    item.secretHash = await bcrypt.hash(secret, 12);
    await item.save();

    res.json({ message: 'Secret 已重置', data: { clientSecret: secret } });
  } catch (error) {
    console.error('重置 secret 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   DELETE /api/game-clients/:id
// @desc    刪除 game client
// @access  Private(Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const item = await GameClient.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Game client 不存在' });
    res.json({ message: '已刪除' });
  } catch (error) {
    console.error('刪除 game client 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;

