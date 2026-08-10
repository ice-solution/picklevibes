const express = require('express');
const { body, validationResult } = require('express-validator');
const StorePlatformFee = require('../models/StorePlatformFee');
const { auth, platformAdminAuth } = require('../middleware/auth');
const { sumFeesForStore } = require('../services/platformFeeService');
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

// GET /api/platform-fees/store-booking-stats — 須在 /:id 之前
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
router.get('/', [auth, platformAdminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 50, settled, type, from, to, store } = req.query;
    const q = { voided: { $ne: true } };
    if (store) q.store = store;
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

    const [rows, total, summary] = await Promise.all([
      StorePlatformFee.find(q)
        .populate('store', 'name slug platformFeePercent')
        .populate('settledBy', 'name email')
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
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
    ]);

    res.json({
      fees: rows,
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
