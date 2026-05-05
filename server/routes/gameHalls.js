const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const GameHall = require('../models/GameHall');

const router = express.Router();

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route   GET /api/game-halls
// @desc    管理員取得 GameHall 列表（支援 q 搜尋）
// @access  Private(Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { q = '', page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    const query = {};
    const s = String(q || '').trim();
    if (s) {
      const safe = escapeRegex(s);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { seasonKey: { $regex: safe, $options: 'i' } }
      ];
    }

    const total = await GameHall.countDocuments(query);
    const items = await GameHall.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json({ data: { items, pagination: { current: pageNum, pages: Math.ceil(total / limitNum), total } } });
  } catch (error) {
    console.error('取得 GameHall 列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/game-halls
// @desc    建立 GameHall
// @access  Private(Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().isLength({ min: 1, max: 80 }).withMessage('名稱必須為 1-80 字'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const hall = await GameHall.create({
      name: req.body.name,
      description: req.body.description || '',
      seasonKey: req.body.seasonKey || 'season-1',
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true
    });

    res.status(201).json({ message: 'GameHall 已建立', data: { item: hall } });
  } catch (error) {
    console.error('建立 GameHall 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/game-halls/:id
// @desc    更新 GameHall
// @access  Private(Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().isLength({ min: 1, max: 80 }).withMessage('名稱必須為 1-80 字'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const item = await GameHall.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description } : {}),
        ...(req.body.seasonKey !== undefined ? { seasonKey: req.body.seasonKey } : {}),
        ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
      },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'GameHall 不存在' });
    res.json({ message: 'GameHall 已更新', data: { item } });
  } catch (error) {
    console.error('更新 GameHall 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/game-halls/:id
// @desc    刪除 GameHall
// @access  Private(Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const item = await GameHall.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'GameHall 不存在' });
    res.json({ message: 'GameHall 已刪除' });
  } catch (error) {
    console.error('刪除 GameHall 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;

