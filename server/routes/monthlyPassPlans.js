const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const MonthlyPassPlan = require('../models/MonthlyPassPlan');
const UserEntitlement = require('../models/UserEntitlement');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');
const {
  isValidHhMm,
  ensureDefaultPlans,
  grantOrExtendEntitlement,
  getActiveEntitlementsForUser,
} = require('../services/monthlyPassService');

const router = express.Router();

// 確保預設兩種方案存在
router.use(async (req, res, next) => {
  try {
    await ensureDefaultPlans();
  } catch (e) {
    console.warn('ensureDefaultPlans:', e.message);
  }
  next();
});

// @route   GET /api/monthly-pass-plans
// @desc    啟用中的月卡方案（公開／賣卡下拉）
router.get('/', async (req, res) => {
  try {
    const plans = await MonthlyPassPlan.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    res.json({ plans });
  } catch (error) {
    console.error('list monthly pass plans:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/monthly-pass-plans/admin
router.get('/admin', [auth, adminAuth], async (req, res) => {
  try {
    const plans = await MonthlyPassPlan.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate('createdBy', 'name email')
      .lean();
    res.json({ plans });
  } catch (error) {
    console.error('admin list monthly pass plans:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/monthly-pass-plans/me
// @desc    當前登入用戶嘅月卡權益
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const entitlements = await UserEntitlement.find({ user: userId })
      .populate('plan', 'name type durationDays offPeakStart offPeakEnd description')
      .sort({ planType: 1 })
      .lean();
    const now = new Date();
    const items = entitlements.map((e) => ({
      planType: e.planType,
      name: e.plan?.name || (e.planType === 'reclub_unlimited' ? '任打 Reclub 月卡' : '非繁忙時間月卡'),
      description: e.plan?.description || '',
      expiresAt: e.expiresAt,
      isActive: new Date(e.expiresAt) > now,
      offPeakStart: e.planType === 'off_peak' ? e.plan?.offPeakStart || '10:00' : null,
      offPeakEnd: e.planType === 'off_peak' ? e.plan?.offPeakEnd || '16:00' : null,
    }));
    res.json({
      entitlements: items,
      active: items.filter((i) => i.isActive),
    });
  } catch (error) {
    console.error('my monthly pass entitlements:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/monthly-pass-plans/users/:userId/entitlements
router.get('/users/:userId/entitlements', [auth, adminAuth], async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: '無效用戶 ID' });
    }
    const entitlements = await UserEntitlement.find({ user: req.params.userId })
      .populate('plan', 'name type durationDays offPeakStart offPeakEnd')
      .sort({ planType: 1 })
      .lean();
    const active = await getActiveEntitlementsForUser(req.params.userId);
    res.json({
      entitlements,
      activePlanTypes: active.map((e) => e.planType),
    });
  } catch (error) {
    console.error('list user entitlements:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PUT /api/monthly-pass-plans/users/:userId/entitlements
// @desc    Admin 手動發放／延長／設定到期
router.put(
  '/users/:userId/entitlements',
  [
    auth,
    adminAuth,
    body('planType').isIn(['reclub_unlimited', 'off_peak']).withMessage('無效月卡類型'),
    body('durationDays').optional().isInt({ min: 1, max: 3660 }),
    body('expiresAt').optional().isISO8601(),
    body('note').optional().trim().isLength({ max: 200 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      if (!mongoose.isValidObjectId(req.params.userId)) {
        return res.status(400).json({ message: '無效用戶 ID' });
      }
      const user = await User.findById(req.params.userId);
      if (!user) return res.status(404).json({ message: '用戶不存在' });

      const planType = req.body.planType;
      const plan = await MonthlyPassPlan.findOne({ type: planType });
      const adminId = req.user.id || req.user._id;
      const note = String(req.body.note || '管理員手動調整').trim();

      if (req.body.expiresAt) {
        const expiresAt = new Date(req.body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          return res.status(400).json({ message: '到期日無效' });
        }
        let ent = await UserEntitlement.findOne({ user: user._id, planType });
        if (!ent) {
          ent = new UserEntitlement({
            user: user._id,
            planType,
            plan: plan?._id || null,
            expiresAt,
            note,
            adjustedBy: adminId,
          });
        } else {
          ent.expiresAt = expiresAt;
          ent.note = note;
          ent.adjustedBy = adminId;
          if (plan) ent.plan = plan._id;
        }
        await ent.save();
        return res.json({ message: '已設定月卡到期日', entitlement: ent });
      }

      const durationDays =
        req.body.durationDays != null
          ? Number(req.body.durationDays)
          : plan?.durationDays || 30;

      const result = await grantOrExtendEntitlement({
        userId: user._id,
        planType,
        durationDays,
        planId: plan?._id || null,
        note,
        adjustedBy: adminId,
      });

      res.json({
        message: '已發放／延長月卡',
        entitlement: result.entitlement,
      });
    } catch (error) {
      console.error('put user entitlement:', error);
      res.status(500).json({ message: error.message || '服務器錯誤' });
    }
  }
);

// @route   PATCH /api/monthly-pass-plans/:id
router.patch(
  '/:id',
  [
    auth,
    adminAuth,
    body('name').optional().trim().isLength({ min: 1, max: 80 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('price').optional().isFloat({ min: 0 }),
    body('durationDays').optional().isInt({ min: 1, max: 3660 }),
    body('offPeakStart').optional().trim(),
    body('offPeakEnd').optional().trim(),
    body('isActive').optional().isBoolean(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: '無效 ID' });
      }
      const plan = await MonthlyPassPlan.findById(req.params.id);
      if (!plan) return res.status(404).json({ message: '月卡方案不存在' });

      if (req.body.name != null) plan.name = String(req.body.name).trim();
      if (req.body.description != null) {
        plan.description = String(req.body.description).trim();
      }
      if (req.body.price != null) plan.price = Number(req.body.price);
      if (req.body.durationDays != null) {
        plan.durationDays = Number(req.body.durationDays);
      }
      if (req.body.sortOrder != null) plan.sortOrder = Number(req.body.sortOrder);
      if (typeof req.body.isActive === 'boolean') plan.isActive = req.body.isActive;

      if (plan.type === 'off_peak') {
        if (req.body.offPeakStart != null) {
          const v = String(req.body.offPeakStart).trim();
          if (!isValidHhMm(v)) {
            return res.status(400).json({ message: '非繁忙開始時間格式須為 HH:mm' });
          }
          plan.offPeakStart = v;
        }
        if (req.body.offPeakEnd != null) {
          const v = String(req.body.offPeakEnd).trim();
          if (!isValidHhMm(v)) {
            return res.status(400).json({ message: '非繁忙結束時間格式須為 HH:mm' });
          }
          plan.offPeakEnd = v;
        }
      }

      await plan.save();
      res.json({ plan, message: '已更新月卡方案' });
    } catch (error) {
      console.error('update monthly pass plan:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

module.exports = router;
