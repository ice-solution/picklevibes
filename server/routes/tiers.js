const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const { requireManagerOrPlatformAdmin } = require('../middleware/tenantAccess');
const Tier = require('../models/Tier');
const Config = require('../models/Config');
const UserBalance = require('../models/UserBalance');
const User = require('../models/User');
const TierRewardFulfillment = require('../models/TierRewardFulfillment');
const RedeemCode = require('../models/RedeemCode');
const {
  getAnniversaryWindow,
  calcSpentInWindow,
  fulfillmentKey,
} = require('../services/tierAnniversaryService');
const { ensurePocketEntry } = require('../services/redeemPocketService');
const emailService = require('../services/emailService');

const router = express.Router();

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

function serializeTierBrief(t) {
  if (!t) return null;
  return {
    _id: t._id,
    name: t.name,
    minAnnualSpent: t.minAnnualSpent,
    color: t.color,
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
// @desc    取得登入用戶 tier 進度（註冊周年窗口內消費）
// @access  Private
router.get('/progress', auth, async (req, res) => {
  try {
    const enabled = await Config.getTierEnabled();
    if (!enabled) {
      return res.json({ data: { enabled: false } });
    }

    const tiers = await getActiveTiersSorted();
    const user = await User.findById(req.user.id).select('createdAt').lean();
    const balance = await UserBalance.findOne({ user: req.user.id }).select('transactions').lean();
    const now = new Date();
    const window = getAnniversaryWindow(user?.createdAt || now, now);
    const annualSpent = calcSpentInWindow(balance?.transactions || [], window.start, window.end);
    const progress = computeTierProgress(tiers, annualSpent);

    res.json({
      data: {
        enabled: true,
        ...progress,
        windowStart: window.start,
        windowEnd: window.end,
        yearIndex: window.yearIndex,
      },
    });
  } catch (error) {
    console.error('取得 tier progress 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/tiers/long-term-supporters
// @desc    列出本周年窗口已達檔位但尚未派發獎勵的用戶
// @access  Private(Admin)
router.get('/long-term-supporters', [auth, adminAuth, requireManagerOrPlatformAdmin], async (req, res) => {
  try {
    const tiers = await getActiveTiersSorted();
    if (!tiers.length) {
      return res.json({
        data: {
          items: [],
          tiers: [],
          message: '請先於 Tier 管理設定檔位門檻',
        },
      });
    }

    const now = new Date();
    const users = await User.find({ isActive: { $ne: false } })
      .select('name email phone createdAt')
      .lean();

    const userIds = users.map((u) => u._id);
    const balances = await UserBalance.find({ user: { $in: userIds } })
      .select('user transactions')
      .lean();
    const balanceByUser = new Map(balances.map((b) => [String(b.user), b]));

    // 載入這些用戶的所有 fulfillment（後續以 windowStart 比對）
    const fulfillments = await TierRewardFulfillment.find({ user: { $in: userIds } })
      .select('user tier windowStart')
      .lean();
    const fulfilledSet = new Set(
      fulfillments.map((f) => fulfillmentKey(f.user, f.tier, f.windowStart))
    );

    const items = [];
    for (const user of users) {
      const window = getAnniversaryWindow(user.createdAt, now);
      const balance = balanceByUser.get(String(user._id));
      const annualSpent = calcSpentInWindow(balance?.transactions || [], window.start, window.end);
      if (annualSpent <= 0) continue;

      const reachedTiers = tiers.filter((t) => (t.minAnnualSpent ?? 0) <= annualSpent);
      if (!reachedTiers.length) continue;

      const unmetTiers = reachedTiers.filter(
        (t) => !fulfilledSet.has(fulfillmentKey(user._id, t._id, window.start))
      );
      if (!unmetTiers.length) continue;

      items.push({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
        },
        createdAt: user.createdAt,
        windowStart: window.start,
        windowEnd: window.end,
        yearIndex: window.yearIndex,
        annualSpent,
        reachedTiers: reachedTiers.map(serializeTierBrief),
        unmetTiers: unmetTiers.map(serializeTierBrief),
      });
    }

    items.sort((a, b) => b.annualSpent - a.annualSpent);

    res.json({
      data: {
        items,
        tiers: tiers.map(serializeTierBrief),
      },
    });
  } catch (error) {
    console.error('取得長期支持用戶列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/tiers/long-term-supporters/fulfill
// @desc    派發長期支持獎勵（口袋 + 記錄 + 可選郵件）
// @access  Private(Admin)
router.post('/long-term-supporters/fulfill', [
  auth,
  adminAuth,
  requireManagerOrPlatformAdmin,
  body('redeemCodeId').notEmpty().withMessage('請選擇兌換碼'),
  body('sendEmail').optional().isBoolean(),
  body('items').optional().isArray(),
  body('items.*.userId').optional().notEmpty(),
  body('items.*.tierId').optional().notEmpty(),
  body('userIds').optional().isArray(),
  body('tierId').optional().notEmpty(),
  body('note').optional().isString(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const sendEmail = req.body.sendEmail !== false;
    const note = String(req.body.note || '').trim();
    const redeemCode = await RedeemCode.findById(req.body.redeemCodeId);
    if (!redeemCode) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }
    if (!redeemCode.isActive) {
      return res.status(400).json({ message: '兌換碼已停用' });
    }

    const tiers = await getActiveTiersSorted();
    const tierById = new Map(tiers.map((t) => [String(t._id), t]));

    /** @type {{ userId: string, tierId: string }[]} */
    let workItems = [];
    if (Array.isArray(req.body.items) && req.body.items.length) {
      workItems = req.body.items
        .map((it) => ({ userId: String(it.userId), tierId: String(it.tierId) }))
        .filter((it) => it.userId && it.tierId);
    } else if (Array.isArray(req.body.userIds) && req.body.userIds.length && req.body.tierId) {
      const tierId = String(req.body.tierId);
      workItems = req.body.userIds.map((uid) => ({ userId: String(uid), tierId }));
    }

    if (!workItems.length) {
      return res.status(400).json({ message: '請至少選擇一位用戶與檔位' });
    }

    // 去重
    const seen = new Set();
    workItems = workItems.filter((it) => {
      const k = `${it.userId}:${it.tierId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const now = new Date();
    const results = [];
    let fulfilled = 0;
    let skipped = 0;
    let emailsSent = 0;
    let emailErrors = 0;

    for (const item of workItems) {
      const tier = tierById.get(item.tierId);
      if (!tier) {
        results.push({ userId: item.userId, tierId: item.tierId, ok: false, reason: '檔位不存在或未啟用' });
        skipped += 1;
        continue;
      }

      const user = await User.findById(item.userId).select('name email phone createdAt isActive').lean();
      if (!user || user.isActive === false) {
        results.push({ userId: item.userId, tierId: item.tierId, ok: false, reason: '用戶不存在或已停用' });
        skipped += 1;
        continue;
      }

      const window = getAnniversaryWindow(user.createdAt, now);
      const balance = await UserBalance.findOne({ user: user._id }).select('transactions').lean();
      const annualSpent = calcSpentInWindow(balance?.transactions || [], window.start, window.end);

      if (annualSpent < (tier.minAnnualSpent ?? 0)) {
        results.push({
          userId: item.userId,
          tierId: item.tierId,
          ok: false,
          reason: `本年度消費 ${annualSpent} 未達檔位門檻 ${tier.minAnnualSpent}`,
        });
        skipped += 1;
        continue;
      }

      const existing = await TierRewardFulfillment.findOne({
        user: user._id,
        tier: tier._id,
        windowStart: window.start,
      }).lean();
      if (existing) {
        results.push({ userId: item.userId, tierId: item.tierId, ok: false, reason: '此窗口已派發過此檔位' });
        skipped += 1;
        continue;
      }

      const { pocket, created: pocketCreated } = await ensurePocketEntry({
        userId: user._id,
        redeemCodeId: redeemCode._id,
        source: 'admin_assign',
        assignedBy: req.user.id,
        note: note || `長期支持獎勵：${tier.name}`,
      });

      let emailSent = false;
      let emailError = null;
      if (sendEmail && user.email) {
        try {
          await emailService.sendLongTermSupporterRewardEmail({
            name: user.name,
            email: user.email,
            tierName: tier.name,
            redeemCodeName: redeemCode.name,
            redeemCodeCode: redeemCode.code,
            annualSpent,
            windowStart: window.start,
            windowEnd: window.end,
          });
          emailSent = true;
          emailsSent += 1;
        } catch (err) {
          emailError = err.message || '郵件發送失敗';
          emailErrors += 1;
          console.error('長期支持獎勵郵件失敗:', err);
        }
      }

      try {
        await TierRewardFulfillment.create({
          user: user._id,
          tier: tier._id,
          windowStart: window.start,
          windowEnd: window.end,
          yearIndex: window.yearIndex,
          annualSpentAtFulfillment: annualSpent,
          redeemCode: redeemCode._id,
          pocket: pocket._id,
          emailSent,
          fulfilledBy: req.user.id,
          fulfilledAt: new Date(),
          note: note || `長期支持獎勵：${tier.name}`,
        });
      } catch (err) {
        if (err && err.code === 11000) {
          results.push({ userId: item.userId, tierId: item.tierId, ok: false, reason: '此窗口已派發過此檔位' });
          skipped += 1;
          continue;
        }
        throw err;
      }

      fulfilled += 1;
      results.push({
        userId: item.userId,
        tierId: item.tierId,
        ok: true,
        pocketCreated,
        emailSent,
        emailError,
        tierName: tier.name,
        userName: user.name,
      });
    }

    res.json({
      message: `已派發 ${fulfilled} 筆，略過 ${skipped} 筆`,
      data: {
        fulfilled,
        skipped,
        emailsSent,
        emailErrors,
        redeemCode: {
          _id: redeemCode._id,
          code: redeemCode.code,
          name: redeemCode.name,
        },
        results,
      },
    });
  } catch (error) {
    console.error('派發長期支持獎勵錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// ===== Admin CRUD =====

// @route   GET /api/tiers/admin
// @desc    管理員取得 tiers（含 inactive）
// @access  Private(Admin)
router.get('/admin', [auth, adminAuth, requireManagerOrPlatformAdmin], async (req, res) => {
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
router.delete('/:id', [auth, adminAuth, requireManagerOrPlatformAdmin], async (req, res) => {
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
