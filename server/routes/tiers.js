const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Tier = require('../models/Tier');
const Config = require('../models/Config');
const UserBalance = require('../models/UserBalance');

const router = express.Router();

function calcAnnualSpentFromTransactions(transactions, now = new Date()) {
  if (!Array.isArray(transactions) || transactions.length === 0) return 0;
  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  let spent = 0;
  let refunded = 0;
  for (const tx of transactions) {
    const createdAt = tx?.createdAt ? new Date(tx.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    if (createdAt < oneYearAgo) continue;

    if (tx.type === 'spend') {
      // spend 交易 amount 會是負數
      const amt = Number(tx.amount) || 0;
      spent += Math.abs(amt);
    } else if (tx.type === 'refund') {
      const amt = Number(tx.amount) || 0;
      refunded += Math.abs(amt);
    }
  }
  return Math.max(0, Math.round(spent - refunded));
}

async function getActiveTiersSorted() {
  return Tier.find({ isActive: true })
    .sort({ sortOrder: 1, minAnnualSpent: 1, createdAt: 1 })
    .lean();
}

function computeTierProgress(tiers, annualSpent) {
  const sorted = Array.isArray(tiers) ? tiers.slice().sort((a, b) => (a.minAnnualSpent ?? 0) - (b.minAnnualSpent ?? 0)) : [];

  let currentTier = null;
  for (const t of sorted) {
    if ((t.minAnnualSpent ?? 0) <= annualSpent) currentTier = t;
  }
  const nextTier = sorted.find((t) => (t.minAnnualSpent ?? 0) > annualSpent) || null;

  const remaining = nextTier ? Math.max(0, (nextTier.minAnnualSpent ?? 0) - annualSpent) : 0;
  const progressPct = nextTier && (nextTier.minAnnualSpent ?? 0) > 0
    ? Math.min(100, Math.round((annualSpent / nextTier.minAnnualSpent) * 100))
    : 100;

  return {
    annualSpent,
    currentTier,
    nextTier,
    remaining,
    progressPct,
  };
}

// @route   GET /api/tiers/enabled
// @desc    取得 tier 功能是否開啟
// @access  Public
router.get('/enabled', async (req, res) => {
  try {
    const enabled = await Config.getTierEnabled();
    res.json({ data: { enabled } });
  } catch (error) {
    console.error('取得 tier enabled 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/tiers
// @desc    取得 tiers 列表（前台：僅 active；後台：全部）
// @access  Public / Private(Admin)
router.get('/', async (req, res) => {
  try {
    const tiers = await getActiveTiersSorted();
    res.json({ data: { tiers } });
  } catch (error) {
    console.error('取得 tiers 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/tiers/progress
// @desc    取得登入用戶 tier 進度（一年內消費）
// @access  Private
router.get('/progress', auth, async (req, res) => {
  try {
    const enabled = await Config.getTierEnabled();
    if (!enabled) {
      return res.json({ data: { enabled: false } });
    }

    const tiers = await getActiveTiersSorted();
    const balance = await UserBalance.findOne({ user: req.user.id }).select('transactions').lean();
    const annualSpent = calcAnnualSpentFromTransactions(balance?.transactions || []);
    const progress = computeTierProgress(tiers, annualSpent);

    res.json({ data: { enabled: true, ...progress } });
  } catch (error) {
    console.error('取得 tier progress 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// ===== Admin CRUD =====

// @route   GET /api/tiers/admin
// @desc    管理員取得 tiers（含 inactive）
// @access  Private(Admin)
router.get('/admin', [auth, adminAuth], async (req, res) => {
  try {
    const tiers = await Tier.find({}).sort({ sortOrder: 1, minAnnualSpent: 1, createdAt: 1 }).lean();
    const enabled = await Config.getTierEnabled();
    res.json({ data: { enabled, tiers } });
  } catch (error) {
    console.error('管理員取得 tiers 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/tiers
// @desc    建立 tier
// @access  Private(Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('tier 名字必須為 1-50 字'),
  body('minAnnualSpent').isFloat({ min: 0 }).withMessage('額度必須為非負數'),
  body('color').optional().isString().isLength({ min: 1, max: 32 }).withMessage('顏色格式不正確'),
  body('benefits').optional().isArray().withMessage('福利內容必須是陣列'),
  body('benefits.*').optional().isString().withMessage('福利內容必須為文字'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須為非負整數'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const tier = await Tier.create({
      name: req.body.name,
      minAnnualSpent: req.body.minAnnualSpent,
      color: req.body.color,
      benefits: req.body.benefits,
      sortOrder: req.body.sortOrder ?? 0,
      isActive: req.body.isActive ?? true
    });
    res.status(201).json({ message: 'Tier 已建立', data: { tier } });
  } catch (error) {
    console.error('建立 tier 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/tiers/:id
// @desc    更新 tier
// @access  Private(Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('tier 名字必須為 1-50 字'),
  body('minAnnualSpent').optional().isFloat({ min: 0 }).withMessage('額度必須為非負數'),
  body('color').optional().isString().isLength({ min: 1, max: 32 }).withMessage('顏色格式不正確'),
  body('benefits').optional().isArray().withMessage('福利內容必須是陣列'),
  body('benefits.*').optional().isString().withMessage('福利內容必須為文字'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須為非負整數'),
  body('isActive').optional().isBoolean().withMessage('isActive 必須為 true/false'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const tier = await Tier.findByIdAndUpdate(
      req.params.id,
      {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.minAnnualSpent !== undefined ? { minAnnualSpent: req.body.minAnnualSpent } : {}),
        ...(req.body.color !== undefined ? { color: req.body.color } : {}),
        ...(req.body.benefits !== undefined ? { benefits: req.body.benefits } : {}),
        ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
        ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
      },
      { new: true }
    );

    if (!tier) return res.status(404).json({ message: 'Tier 不存在' });
    res.json({ message: 'Tier 已更新', data: { tier } });
  } catch (error) {
    console.error('更新 tier 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/tiers/:id
// @desc    刪除 tier
// @access  Private(Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const tier = await Tier.findByIdAndDelete(req.params.id);
    if (!tier) return res.status(404).json({ message: 'Tier 不存在' });
    res.json({ message: 'Tier 已刪除' });
  } catch (error) {
    console.error('刪除 tier 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;

