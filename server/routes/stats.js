const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Court = require('../models/Court');
const RedeemUsage = require('../models/RedeemUsage');
const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');

const router = express.Router();

const HK_TZ = 'Asia/Hong_Kong';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** @returns {string} YYYY-MM-DD in Hong Kong */
function formatHkYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function addDaysToYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function hkStartOfDayInstant(ymd) {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function hkEndOfDayInstant(ymd) {
  return new Date(`${ymd}T23:59:59.999+08:00`);
}

function hkCurrentHourWindow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const h = pad2(Number(parts.hour));
  const hourStart = new Date(`${ymd}T${h}:00:00+08:00`);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  return { hourStart, hourEnd, ymd, hour: Number(parts.hour) };
}

function normalizeHm(t) {
  if (!t) return '00:00';
  const s = String(t).trim();
  const [a, b] = s.split(':');
  return `${pad2(Number(a))}:${pad2(Number(b || 0))}`;
}

/** 預約在香港時間下的 [start, end) 絕對時間 */
function bookingIntervalMs(booking) {
  const startYmd = booking.date.toLocaleString('en-CA', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const st = normalizeHm(booking.startTime);
  const bStart = new Date(`${startYmd}T${st}:00+08:00`);
  const durMin = Math.max(1, Number(booking.duration) || 60);
  const bEnd = new Date(bStart.getTime() + durMin * 60 * 1000);
  return { bStart, bEnd };
}

function intervalsOverlap(a0, a1, b0, b1) {
  return a1 > b0 && a0 < b1;
}

async function rentalHoursForHkDay(ymd) {
  const s = hkStartOfDayInstant(ymd);
  const e = hkEndOfDayInstant(ymd);
  const agg = await Booking.aggregate([
    {
      $match: {
        status: { $in: ['confirmed', 'completed'] },
        date: { $gte: s, $lte: e }
      }
    },
    { $group: { _id: null, minutes: { $sum: '$duration' } } }
  ]);
  const minutes = agg[0]?.minutes || 0;
  return Math.round((minutes / 60) * 100) / 100;
}

async function rechargePointsForHkDay(ymd) {
  const s = hkStartOfDayInstant(ymd);
  const e = hkEndOfDayInstant(ymd);
  const agg = await Recharge.aggregate([
    { $match: { status: 'completed' } },
    {
      $addFields: {
        eff: { $ifNull: ['$payment.paidAt', '$updatedAt'] }
      }
    },
    { $match: { eff: { $gte: s, $lte: e } } },
    { $group: { _id: null, pts: { $sum: '$points' } } }
  ]);
  return agg[0]?.pts || 0;
}

async function spentPointsForHkDay(ymd) {
  const s = hkStartOfDayInstant(ymd);
  const e = hkEndOfDayInstant(ymd);
  const agg = await UserBalance.aggregate([
    { $unwind: '$transactions' },
    {
      $match: {
        'transactions.type': 'spend',
        'transactions.createdAt': { $gte: s, $lte: e }
      }
    },
    {
      $group: {
        _id: null,
        spent: { $sum: { $abs: '$transactions.amount' } }
      }
    }
  ]);
  return Math.round((agg[0]?.spent || 0) * 100) / 100;
}

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

// @route   GET /api/stats/dashboard-live
// @desc    場地即時概況（香港時間本小時）：在線/離線、本小時使用中（在線場地）、空閒在線
// @access  Private (Admin)
router.get('/dashboard-live', [auth, adminAuth], async (req, res) => {
  try {
    const courts = await Court.find({}).select('isActive maintenance');
    let courtsOnline = 0;
    for (const c of courts) {
      if (typeof c.isAvailable === 'function' && c.isAvailable()) courtsOnline += 1;
    }
    const totalCourts = courts.length;
    const courtsOffline = totalCourts - courtsOnline;

    const courtById = new Map(courts.map((c) => [String(c._id), c]));
    const { hourStart, hourEnd } = hkCurrentHourWindow();
    const spanStart = new Date(hourStart.getTime() - 36 * 60 * 60 * 1000);
    const spanEnd = new Date(hourEnd.getTime() + 36 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'completed'] },
      $or: [
        { date: { $gte: spanStart, $lte: spanEnd } },
        { endDate: { $gte: spanStart, $lte: spanEnd } },
        { $and: [{ date: { $lte: spanEnd } }, { endDate: { $gte: spanStart } }] }
      ]
    }).select('court date startTime endTime duration endDate');

    const courtIdsInUseOnline = new Set();
    for (const b of bookings) {
      const c = courtById.get(String(b.court));
      if (!c || !c.isAvailable()) continue;
      const { bStart, bEnd } = bookingIntervalMs(b);
      if (intervalsOverlap(bStart.getTime(), bEnd.getTime(), hourStart.getTime(), hourEnd.getTime())) {
        courtIdsInUseOnline.add(String(b.court));
      }
    }
    const courtsInUseThisHour = courtIdsInUseOnline.size;
    const courtsIdleOnline = Math.max(0, courtsOnline - courtsInUseThisHour);

    res.json({
      success: true,
      timezone: HK_TZ,
      data: {
        courtsOnline,
        courtsOffline,
        courtsInUseThisHour,
        courtsIdleOnline,
        totalCourts,
        hourWindow: { start: hourStart.toISOString(), end: hourEnd.toISOString() }
      }
    });
  } catch (error) {
    console.error('dashboard-live 錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/dashboard-kpis
// @desc    今日 vs 昨日：總出租小時、充值積分、消費積分（香港日曆日）
// @access  Private (Admin)
router.get('/dashboard-kpis', [auth, adminAuth], async (req, res) => {
  try {
    const today = formatHkYmd();
    const yesterday = addDaysToYmd(today, -1);
    const [tRental, tRecharge, tSpent, yRental, yRecharge, ySpent] = await Promise.all([
      rentalHoursForHkDay(today),
      rechargePointsForHkDay(today),
      spentPointsForHkDay(today),
      rentalHoursForHkDay(yesterday),
      rechargePointsForHkDay(yesterday),
      spentPointsForHkDay(yesterday)
    ]);

    res.json({
      success: true,
      timezone: HK_TZ,
      data: {
        todayYmd: today,
        yesterdayYmd: yesterday,
        today: {
          rentalHours: tRental,
          rechargePoints: tRecharge,
          spentPoints: tSpent
        },
        yesterday: {
          rentalHours: yRental,
          rechargePoints: yRecharge,
          spentPoints: ySpent
        }
      }
    });
  } catch (error) {
    console.error('dashboard-kpis 錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stats/dashboard-series
// @desc    按香港日曆日序列：出租小時、充值積分、消費積分（預設最近 7 日含今天）
// @access  Private (Admin)
router.get('/dashboard-series', [auth, adminAuth], async (req, res) => {
  try {
    const days = Math.min(90, Math.max(2, parseInt(req.query.days, 10) || 7));
    const toYmd = req.query.to ? String(req.query.to).slice(0, 10) : formatHkYmd();
    const fromYmd = req.query.from
      ? String(req.query.from).slice(0, 10)
      : addDaysToYmd(toYmd, -(days - 1));

    const start = hkStartOfDayInstant(fromYmd);
    const end = hkEndOfDayInstant(toYmd);

    const [rentalAgg, rechargeAgg, spendAgg] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            status: { $in: ['confirmed', 'completed'] },
            date: { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: HK_TZ } },
            minutes: { $sum: '$duration' }
          }
        },
        {
          $project: {
            _id: 1,
            hours: { $round: [{ $divide: ['$minutes', 60] }, 2] }
          }
        }
      ]),
      Recharge.aggregate([
        { $match: { status: 'completed' } },
        { $addFields: { eff: { $ifNull: ['$payment.paidAt', '$updatedAt'] } } },
        { $match: { eff: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { date: '$eff', format: '%Y-%m-%d', timezone: HK_TZ } },
            rechargePoints: { $sum: '$points' }
          }
        }
      ]),
      UserBalance.aggregate([
        { $unwind: '$transactions' },
        {
          $match: {
            'transactions.type': 'spend',
            'transactions.createdAt': { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: {
                date: '$transactions.createdAt',
                format: '%Y-%m-%d',
                timezone: HK_TZ
              }
            },
            spentPoints: { $sum: { $abs: '$transactions.amount' } }
          }
        },
        {
          $project: {
            _id: 1,
            spentPoints: { $round: ['$spentPoints', 2] }
          }
        }
      ])
    ]);

    const rentalMap = Object.fromEntries(rentalAgg.map((r) => [r._id, r.hours || 0]));
    const rechargeMap = Object.fromEntries(rechargeAgg.map((r) => [r._id, r.rechargePoints || 0]));
    const spendMap = Object.fromEntries(spendAgg.map((r) => [r._id, r.spentPoints || 0]));

    const series = [];
    for (let d = fromYmd; d <= toYmd; d = addDaysToYmd(d, 1)) {
      series.push({
        date: d,
        rentalHours: rentalMap[d] || 0,
        rechargePoints: rechargeMap[d] || 0,
        spentPoints: spendMap[d] || 0
      });
    }

    res.json({
      success: true,
      timezone: HK_TZ,
      data: { fromYmd, toYmd, series }
    });
  } catch (error) {
    console.error('dashboard-series 錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試' });
  }
});

module.exports = router;


