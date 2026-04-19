const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const Booking = require('../models/Booking');
const User = require('../models/User');
const RedeemUsage = require('../models/RedeemUsage');
const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');

const router = express.Router();

// 工具函數：取得某年某月的起止時間
function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// 工具函數：時間字串轉分鐘（支援 24:00）
function timeToMinutes(time) {
  if (time === '24:00') return 24 * 60;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

// 工具函數：香港時間月份區間（start inclusive, end exclusive）
function getHongKongMonthRange(year, month) {
  const mm = String(month).padStart(2, '0');
  const start = new Date(`${year}-${mm}-01T00:00:00+08:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMm = String(nextMonth).padStart(2, '0');
  const endExclusive = new Date(`${nextYear}-${nextMm}-01T00:00:00+08:00`);
  return { start, endExclusive };
}

// 三個時段（以分鐘表示，當天 0:00 起算）
const BOOKING_TIME_BUCKETS = [
  { key: 'night', label: '00:00-06:00', start: 0, end: 6 * 60 },
  { key: 'day', label: '07:00-15:00', start: 7 * 60, end: 15 * 60 },
  { key: 'evening', label: '16:00-24:00', start: 16 * 60, end: 24 * 60 }
];

// @route   GET /api/stats/bookings-time-buckets
// @desc    指定月份（香港時間）按三個時段統計 booking 數量（以 startTime 分桶）
// @access  Private (Admin)
router.get('/bookings-time-buckets', [auth, adminAuth], async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = Math.min(12, Math.max(1, parseInt(req.query.month, 10) || (new Date().getMonth() + 1)));
    const includeCancelled = String(req.query.includeCancelled || '').toLowerCase() === 'true';

    const { start, endExclusive } = getHongKongMonthRange(year, month);

    const statusQuery = includeCancelled
      ? {}
      : { status: { $ne: 'cancelled' } };

    // 與 /bookings/admin/all 的 dateFrom/dateTo 邏輯一致：包含跨天預約
    const query = {
      ...statusQuery,
      $or: [
        { date: { $gte: start, $lt: endExclusive } },
        { endDate: { $gte: start, $lt: endExclusive } },
        { $and: [{ date: { $lt: endExclusive } }, { endDate: { $gte: start } }] }
      ]
    };

    const bookings = await Booking.find(query).select('date startTime status endDate');

    const counts = BOOKING_TIME_BUCKETS.reduce((acc, r) => {
      acc[r.key] = { label: r.label, count: 0 };
      return acc;
    }, {});

    for (const b of bookings) {
      const startMin = timeToMinutes(b.startTime);
      const bucket = BOOKING_TIME_BUCKETS.find((r) => startMin >= r.start && startMin < r.end);
      if (bucket) {
        counts[bucket.key].count += 1;
      }
    }

    res.json({
      success: true,
      timezone: 'Asia/Hong_Kong',
      year,
      month,
      range: {
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString()
      },
      totalBookings: bookings.length,
      buckets: counts
    });
  } catch (error) {
    console.error('獲取 booking 時段統計錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/court-usage
// @desc    每月場地使用量（按三個時段）與每日平均使用小時
// @access  Private (Admin)
router.get('/court-usage', [auth, adminAuth], async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    // 只統計已確認/已完成的預約
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const bookings = await Booking.find({
      date: { $gte: yearStart, $lte: yearEnd },
      status: { $in: ['confirmed', 'completed'] }
    }).select('date startTime endTime duration');

    const ranges = BOOKING_TIME_BUCKETS;

    const result = [];

    for (let month = 1; month <= 12; month++) {
      const { start, end } = getMonthRange(year, month);
      const daysInMonth = end.getDate();

      const monthBookings = bookings.filter(
        (b) => b.date >= start && b.date <= end
      );

      const totals = {
        night: 0,
        day: 0,
        evening: 0
      };

      for (const b of monthBookings) {
        let startMin = timeToMinutes(b.startTime);
        let endMin = timeToMinutes(b.endTime);

        // 處理跨天（結束時間早於或等於開始時間，視為隔天）
        if (endMin <= startMin) {
          endMin += 24 * 60;
        }

        for (const r of ranges) {
          const rangeStart = r.start;
          const rangeEnd = r.end;

          // 計算與當日範圍的重叠分鐘
          const overlap = Math.max(
            0,
            Math.min(endMin, rangeEnd) - Math.max(startMin, rangeStart)
          );

          if (overlap > 0) {
            totals[r.key] += overlap;
          }
        }
      }

      const monthData = {
        year,
        month,
        ranges: {}
      };

      for (const r of ranges) {
        const hours = totals[r.key] / 60;
        monthData.ranges[r.key] = {
          label: r.label,
          hours: parseFloat(hours.toFixed(2)),
          averageDailyHours: parseFloat((hours / daysInMonth).toFixed(2))
        };
      }

      result.push(monthData);
    }

    res.json({
      success: true,
      year,
      data: result
    });
  } catch (error) {
    console.error('獲取場地使用統計錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/monthly-users
// @desc    每月註冊用戶人數
// @access  Private (Admin)
router.get('/monthly-users', [auth, adminAuth], async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const users = await User.find({
      createdAt: { $gte: yearStart, $lte: yearEnd }
    }).select('createdAt');

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      year,
      month: i + 1,
      count: 0
    }));

    for (const u of users) {
      const m = u.createdAt.getMonth(); // 0-11
      monthly[m].count += 1;
    }

    res.json({
      success: true,
      year,
      data: monthly
    });
  } catch (error) {
    console.error('獲取每月註冊用戶統計錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/coupon-usage
// @desc    每月優惠券使用次數
// @access  Private (Admin)
router.get('/coupon-usage', [auth, adminAuth], async (req, res) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const usages = await RedeemUsage.find({
      usedAt: { $gte: yearStart, $lte: yearEnd }
    }).select('usedAt orderType');

    const monthly = Array.from({ length: 12 }, (_, i) => ({
      year,
      month: i + 1,
      total: 0,
      byType: {
        booking: 0,
        recharge: 0
      }
    }));

    for (const u of usages) {
      const m = u.usedAt.getMonth(); // 0-11
      monthly[m].total += 1;
      if (u.orderType === 'booking' || u.orderType === 'recharge') {
        monthly[m].byType[u.orderType] += 1;
      }
    }

    res.json({
      success: true,
      year,
      data: monthly
    });
  } catch (error) {
    console.error('獲取優惠券使用統計錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/admin-summary
// @desc    管理員首頁概要數據
// @access  Private (Admin)
router.get('/admin-summary', [auth, adminAuth], async (req, res) => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);

    const [
      completedUntilToday,
      totalBookings,
      totalRechargeAgg,
      monthlyBookings
    ] = await Promise.all([
      Booking.countDocuments({
        status: 'completed',
        date: { $lte: today }
      }),
      Booking.countDocuments({}),
      Recharge.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      Booking.countDocuments({
        date: { $gte: monthStart, $lte: today }
      })
    ]);

    const totalRecharge =
      totalRechargeAgg.length > 0 ? totalRechargeAgg[0].totalAmount : 0;

    res.json({
      success: true,
      data: {
        completedBookingsUntilToday: completedUntilToday,
        totalBookings,
        totalRechargeAmount: totalRecharge,
        currentMonthBookings: monthlyBookings
      }
    });
  } catch (error) {
    console.error('獲取管理員概要統計錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

module.exports = router;


