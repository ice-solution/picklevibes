const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth, adminAuth } = require('../middleware/auth');
const GameHall = require('../models/GameHall');
const Store = require('../models/Store');
const { assertSaasTenantStore } = require('../utils/allianceStore');

const router = express.Router();

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function validateAllianceStoreId(storeId) {
  if (!storeId) return null;
  if (!mongoose.isValidObjectId(storeId)) {
    const err = new Error('無效的店鋪 ID');
    err.status = 400;
    throw err;
  }
  const store = await Store.findById(storeId);
  assertSaasTenantStore(store);
  return store._id;
}

// @route   GET /api/game-halls
// @desc    管理員取得 GameHall 列表（支援 q 搜尋）
// @access  Private(Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { q = '', page = 1, limit = 50, storeId = '' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    const query = {};
    if (storeId && mongoose.isValidObjectId(storeId)) {
      query.store = storeId;
    }
    const s = String(q || '').trim();
    if (s) {
      const safe = escapeRegex(s);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { seasonKey: { $regex: safe, $options: 'i' } },
      ];
    }

    const total = await GameHall.countDocuments(query);
    const items = await GameHall.find(query)
      .populate('store', 'name slug district allianceEnabled')
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
  body('storeId').notEmpty().withMessage('請選擇加盟店鋪'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const storeId = await validateAllianceStoreId(req.body.storeId);

    const hall = await GameHall.create({
      store: storeId,
      name: req.body.name,
      description: req.body.description || '',
      seasonKey: req.body.seasonKey || 'season-1',
      isActive: req.body.isActive !== undefined ? !!req.body.isActive : true,
    });

    await hall.populate('store', 'name slug district');
    res.status(201).json({ message: 'GameHall 已建立', data: { item: hall } });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
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
  body('storeId').optional().notEmpty().withMessage('店鋪不能為空'),
  body('description').optional().isString().isLength({ max: 500 }).withMessage('描述最多 500 字'),
  body('seasonKey').optional().isString().isLength({ min: 1, max: 64 }).withMessage('seasonKey 必須為 1-64 字'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

    const patch = {
      ...(req.body.name !== undefined ? { name: req.body.name } : {}),
      ...(req.body.description !== undefined ? { description: req.body.description } : {}),
      ...(req.body.seasonKey !== undefined ? { seasonKey: req.body.seasonKey } : {}),
      ...(req.body.isActive !== undefined ? { isActive: !!req.body.isActive } : {}),
    };
    if (req.body.storeId !== undefined) {
      patch.store = await validateAllianceStoreId(req.body.storeId);
    }

    const item = await GameHall.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate('store', 'name slug district');
    if (!item) return res.status(404).json({ message: 'GameHall 不存在' });
    res.json({ message: 'GameHall 已更新', data: { item } });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
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
