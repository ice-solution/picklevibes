const express = require('express');
const { body, validationResult } = require('express-validator');
const StorePlatformFee = require('../models/StorePlatformFee');
const Store = require('../models/Store');
const { auth, adminAuth, platformAdminAuth } = require('../middleware/auth');
const { sumFeesForStore } = require('../services/platformFeeService');
const { resolveFinanceStoreFilter } = require('../utils/resolveFinanceStoreFilter');
const Booking = require('../models/Booking');

const router = express.Router();

function parseDateBound(value, endOfDay) {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

// GET /api/platform-fees/store-booking-stats — 須在 /:id 之前（僅平台）
router.get('/store-booking-stats', [auth, platformAdminAuth], async (req, res) => {
  try {
    const fromD = parseDateBound(req.query.from, false);
    const toD = parseDateBound(req.query.to, true);
    const match = {
      status: { $nin: ['cancelled'] },
    };
    if (req.query.store) match.store = req.query.store;
    if (fromD || toD) {
      match.date = {};
      if (fromD) match.date.$gte = fromD;
      if (toD) match.date.$lte = toD;
    }

    const stats = await Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$store',
          bookingCount: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ['$duration', 60] } },
          totalPoints: {
            $sum: {
              $ifNull: ['$payment.pointsDeducted', { $ifNull: ['$pricing.pointsDeducted', 0] }],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'stores',
          localField: '_id',
          foreignField: '_id',
          as: 'store',
        },
      },
      { $unwind: { path: '$store', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          storeId: '$_id',
          storeName: '$store.name',
          storeSlug: '$store.slug',
          platformFeePercent: { $ifNull: ['$store.platformFeePercent', 0] },
          bookingCount: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] },
          totalMinutes: 1,
          totalPoints: 1,
        },
      },
      { $sort: { bookingCount: -1 } },
    ]);

    const stores = await Promise.all(
      stats.map(async (s) => {
        if (!s.storeId) return { ...s, feeSummary: null };
        const feeSummary = await sumFeesForStore(s.storeId, {
          from: fromD || undefined,
          to: toD || undefined,
        });
        return {
          ...s,
          feeSummary: {
            grossAmount: feeSummary.grossAmount,
            feeAmount: feeSummary.feeAmount,
            netAmount: feeSummary.netAmount,
            count: feeSummary.count,
          },
        };
      })
    );

    res.json({ stores, from: req.query.from || null, to: req.query.to || null });
  } catch (error) {
    console.error('店鋪預約統計錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// GET /api/platform-fees
// 平台 admin：可查全部／指定店；店鋪 staff：只讀本店
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const storeFilter = resolveFinanceStoreFilter(req);
    if (!storeFilter.ok) {
      return res.status(storeFilter.status).json({ message: storeFilter.message });
    }

    const isPlatformAdmin = Boolean(req.tenantAccess?.isPlatformAdmin);
    // 店鋪員工必須鎖店；平台可選店或全部
    if (!isPlatformAdmin && !storeFilter.storeId) {
      return res.status(400).json({ message: '請指定店鋪' });
    }

    const { page = 1, limit = 50, settled, type, from, to } = req.query;
    const q = { voided: { $ne: true } };
    if (storeFilter.storeId) q.store = storeFilter.storeId;
    if (settled === 'true') q.settled = true;
    if (settled === 'false') q.settled = false;
    if (type === 'store_recharge' || type === 'booking_points') q.type = type;

    const fromD = parseDateBound(from, false);
    const toD = parseDateBound(to, true);
    if (fromD || toD) {
      q.occurredAt = {};
      if (fromD) q.occurredAt.$gte = fromD;
      if (toD) q.occurredAt.$lte = toD;
    }

    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * lim;

    let feeQuery = StorePlatformFee.find(q)
      .populate('store', 'name slug platformFeePercent')
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(lim);
    if (isPlatformAdmin) {
      feeQuery = feeQuery.populate('settledBy', 'name email');
    }

    const [rows, total, summary, storeMeta] = await Promise.all([
      feeQuery.lean(),
      StorePlatformFee.countDocuments(q),
      StorePlatformFee.aggregate([
        { $match: q },
        {
          $group: {
            _id: null,
            grossAmount: { $sum: '$grossAmount' },
            feeAmount: { $sum: '$feeAmount' },
            netAmount: { $sum: '$netAmount' },
            unsettledFee: {
              $sum: { $cond: [{ $eq: ['$settled', false] }, '$feeAmount', 0] },
            },
          },
        },
      ]),
      storeFilter.storeId
        ? Store.findById(storeFilter.storeId).select('name slug platformFeePercent').lean()
        : Promise.resolve(null),
    ]);

    const fees = rows;

    res.json({
      fees,
      pagination: {
        current: parseInt(page, 10) || 1,
        pages: Math.ceil(total / lim) || 1,
        total,
      },
      summary: summary[0] || {
        grossAmount: 0,
        feeAmount: 0,
        netAmount: 0,
        unsettledFee: 0,
      },
      store: storeMeta
        ? {
            _id: storeMeta._id,
            name: storeMeta.name,
            slug: storeMeta.slug,
            platformFeePercent: Number(storeMeta.platformFeePercent) || 0,
          }
        : null,
      canSettle: isPlatformAdmin,
    });
  } catch (error) {
    console.error('列出抽成錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// PATCH /api/platform-fees/:id/settled
router.patch(
  '/:id/settled',
  [auth, platformAdminAuth, body('settled').isBoolean().withMessage('settled 必須為 boolean')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
      }
      const fee = await StorePlatformFee.findById(req.params.id);
      if (!fee || fee.voided) {
        return res.status(404).json({ message: '抽成紀錄不存在' });
      }
      const settled = Boolean(req.body.settled);
      fee.settled = settled;
      fee.settledAt = settled ? new Date() : null;
      fee.settledBy = settled ? req.user.id : null;
      if (req.body.note != null) fee.note = String(req.body.note);
      await fee.save();
      await fee.populate('store', 'name slug');
      await fee.populate('settledBy', 'name email');
      res.json({ message: settled ? '已標記找數' : '已取消找數標記', fee });
    } catch (error) {
      console.error('更新找數狀態錯誤:', error);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

module.exports = router;
