const express = require('express');
const { body, validationResult } = require('express-validator');
const CoachClass = require('../models/CoachClass');
const User = require('../models/User');
const Activity = require('../models/Activity');
const RegularActivity = require('../models/RegularActivity');
const { auth, adminAuth } = require('../middleware/auth');
const {
  getCoachCalendarEvents,
  getCoachAssignments,
  coachClassLocationLabel,
} = require('../services/coachScheduleService');
const coachClassNotifyService = require('../services/coachClassNotifyService');
const {
  cancelBookings,
  buildCoachClassPayload,
  createHoldBookings,
  shouldHoldCourtsForCoachClass,
  syncLinkedActivity,
  markClassPaid,
  totalPay,
  uniqueIds,
  resolveLinkedBookingIds,
  shouldManageHoldBookings,
} = require('../services/coachClassWriteService');
const { getHKCalendarYMD, hkYmdToBookingUtcMidnight } = require('../utils/bookingDateTime');

const router = express.Router();

function getClientBaseUrl() {
  return String(process.env.CLIENT_URL || process.env.PUBLIC_WEB_URL || 'https://pickcourt.hk').replace(
    /\/+$/,
    ''
  );
}

async function populateClass(id) {
  return CoachClass.findById(id)
    .populate('coaches', 'name email phone coachHourlyRate coachPaymentInfo')
    .populate('coach', 'name email phone coachHourlyRate coachPaymentInfo')
    .populate({
      path: 'courts',
      select: 'name number type store',
      populate: { path: 'store', select: 'name slug' },
    })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name slug' },
    })
    .populate('store', 'name slug')
    .populate('activity', 'title startDate endDate')
    .populate('regularActivity', 'title')
    .populate('createdBy', 'name email')
    .populate('paidBy', 'name email')
    .populate('bookings')
    .populate('booking')
    .populate('accountingTransaction');
}

// @route   GET /api/coach-classes/calendar
router.get('/calendar', auth, async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ message: '僅教練可存取此功能' });
    }
    const { start, end } = req.query;
    let rangeStart = null;
    let rangeEnd = null;
    if (start && end) {
      rangeStart = new Date(start);
      rangeEnd = new Date(end);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return res.status(400).json({ message: '日期範圍無效' });
      }
    }
    const events = await getCoachCalendarEvents(req.user.id, rangeStart, rangeEnd);
    res.json({ success: true, events });
  } catch (error) {
    console.error('coach-classes calendar:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/coach-classes/assignments
router.get('/assignments', auth, async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ message: '僅教練可存取此功能' });
    }
    const items = await getCoachAssignments(req.user.id);
    res.json({ success: true, items });
  } catch (error) {
    console.error('coach-classes assignments:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/coach-classes/link-options
router.get('/link-options', [auth, adminAuth], async (req, res) => {
  try {
    const [activities, regularActivities] = await Promise.all([
      Activity.find({ isActive: { $ne: false } })
        .select('title startDate endDate store location coaches')
        .sort({ startDate: -1 })
        .limit(200)
        .lean(),
      RegularActivity.find({ isActive: { $ne: false } })
        .select('title')
        .sort({ title: 1 })
        .limit(200)
        .lean(),
    ]);
    res.json({ activities, regularActivities });
  } catch (error) {
    console.error('coach-classes link-options:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/coach-classes/coaches
router.get('/coaches', [auth, adminAuth], async (req, res) => {
  try {
    const coaches = await User.find({ role: 'coach' })
      .select('name email phone isActive createdAt lastLogin coachHourlyRate coachPaymentInfo')
      .sort({ name: 1 })
      .lean();

    const now = new Date();
    // 香港日曆「今日」起計即將課堂（唔用 server setHours）
    const todayStart = hkYmdToBookingUtcMidnight(getHKCalendarYMD(now));

    const counts = await CoachClass.aggregate([
      {
        $match: {
          status: 'scheduled',
          sessionDate: { $gte: todayStart },
        },
      },
      { $unwind: { path: '$coaches', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          coachId: { $ifNull: ['$coaches', '$coach'] },
        },
      },
      { $match: { coachId: { $ne: null } } },
      { $group: { _id: '$coachId', upcoming: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.upcoming]));

    res.json({
      coaches: coaches.map((c) => ({
        ...c,
        upcomingClasses: countMap.get(String(c._id)) || 0,
        hasPhone: Boolean(String(c.phone || '').trim()),
        coachHourlyRate: Number(c.coachHourlyRate) || 0,
        coachPaymentInfo: c.coachPaymentInfo || '',
      })),
    });
  } catch (error) {
    console.error('coach-classes coaches:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PATCH /api/coach-classes/coaches/:userId
router.patch('/coaches/:userId', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || user.role !== 'coach') {
      return res.status(404).json({ message: '教練不存在' });
    }
    if (req.body.coachHourlyRate != null) {
      user.coachHourlyRate = Math.max(0, Number(req.body.coachHourlyRate) || 0);
    }
    if (req.body.coachPaymentInfo != null) {
      user.coachPaymentInfo = String(req.body.coachPaymentInfo).trim().slice(0, 500);
    }
    if (req.body.phone != null) {
      user.phone = String(req.body.phone).trim();
    }
    await user.save();
    res.json({
      message: '教練資料已更新',
      coach: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        coachHourlyRate: user.coachHourlyRate,
        coachPaymentInfo: user.coachPaymentInfo,
      },
    });
  } catch (error) {
    console.error('coach-classes coach patch:', error);
    res.status(400).json({ message: error.message || '更新失敗' });
  }
});

// @route   GET /api/coach-classes
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { coach, status, store, paymentStatus } = req.query;
    const q = {};
    if (coach) {
      q.$or = [{ coaches: coach }, { coach }];
    }
    if (status && ['scheduled', 'cancelled'].includes(status)) q.status = status;
    if (store) q.store = store;
    if (paymentStatus && ['unpaid', 'paid'].includes(paymentStatus)) {
      q.paymentStatus = paymentStatus;
    }

    const classes = await CoachClass.find(q)
      .populate('coaches', 'name email phone coachHourlyRate coachPaymentInfo')
      .populate('coach', 'name email phone')
      .populate({
        path: 'courts',
        select: 'name number type store',
        populate: { path: 'store', select: 'name slug' },
      })
      .populate({
        path: 'court',
        select: 'name number type store',
        populate: { path: 'store', select: 'name slug' },
      })
      .populate('store', 'name slug')
      .populate('activity', 'title')
      .populate('regularActivity', 'title')
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .sort({ sessionDate: -1, startTime: 1 })
      .limit(500)
      .lean();

    res.json({
      classes: classes.map((c) => ({
        ...c,
        locationLabel: coachClassLocationLabel(c),
        totalPay: totalPay(c.coachPayments),
      })),
    });
  } catch (error) {
    console.error('coach-classes list:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

const writeValidators = [
  auth,
  adminAuth,
  body('store').optional(),
  body('storeId').optional(),
  body('sessionDate').notEmpty().withMessage('請選擇日期'),
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('開始時間格式須為 HH:MM'),
  body('endTime')
    .matches(/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/)
    .withMessage('結束時間格式須為 HH:MM 或 24:00'),
  body('title').optional().trim().isLength({ max: 120 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
];

// @route   GET /api/coach-classes/by-booking/:bookingId
router.get('/by-booking/:bookingId', [auth, adminAuth], async (req, res) => {
  try {
    const bookingId = String(req.params.bookingId || '').trim();
    if (!bookingId || !/^[a-f\d]{24}$/i.test(bookingId)) {
      return res.status(400).json({ message: '預約 ID 無效' });
    }

    const coachClass = await CoachClass.findOne({
      status: { $ne: 'cancelled' },
      $or: [{ bookings: bookingId }, { booking: bookingId }],
    })
      .sort({ updatedAt: -1 })
      .select('_id');

    if (!coachClass) {
      return res.json({ coachClass: null });
    }

    const populated = await populateClass(coachClass._id);
    res.json({
      coachClass: {
        ...populated.toObject(),
        locationLabel: coachClassLocationLabel(populated),
        totalPay: totalPay(populated.coachPayments),
      },
    });
  } catch (error) {
    console.error('coach-classes by-booking:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/coach-classes
router.post('/', writeValidators, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }

    const payload = await buildCoachClassPayload(req.body);
    const linkedBookingIds = await resolveLinkedBookingIds(req.body);
    let bookingIds = [];
    let linkExistingBookings = false;

    if (linkedBookingIds) {
      const already = await CoachClass.findOne({
        status: { $ne: 'cancelled' },
        $or: [{ bookings: { $in: linkedBookingIds } }, { booking: { $in: linkedBookingIds } }],
      }).select('_id');
      if (already) {
        return res.status(400).json({
          message: '此預約已有派課，請改用編輯',
          coachClassId: already._id,
        });
      }
      bookingIds = linkedBookingIds;
      linkExistingBookings = true;
    } else if (shouldHoldCourtsForCoachClass(payload)) {
      bookingIds = await createHoldBookings({
        coachIds: payload.coachIds,
        courtIds: payload.courtIds,
        dateObj: payload.dateObj,
        startTime: payload.startTime,
        endTime: payload.endTime,
        title: payload.title,
        notes: payload.notes,
      });
    }

    const coachClass = await CoachClass.create({
      title: payload.title,
      store: payload.storeId,
      coaches: payload.coachIds,
      coach: payload.coachIds[0],
      coachPayments: payload.coachPayments,
      locationType: payload.locationType,
      courts: payload.courtIds,
      court: payload.courtIds[0] || null,
      customLocation: payload.locationType === 'custom' ? payload.customLocation : '',
      sessionDate: payload.dateObj,
      startTime: payload.startTime,
      endTime: payload.endTime,
      notes: payload.notes,
      activity: payload.activityId,
      regularActivity: payload.regularActivityId,
      bookings: bookingIds,
      booking: bookingIds[0] || null,
      linkExistingBookings,
      createdBy: req.user.id,
      status: 'scheduled',
      paymentStatus: 'unpaid',
    });

    try {
      await syncLinkedActivity(coachClass);
    } catch (syncErr) {
      console.error('同步活動教練失敗（課堂已建立）:', syncErr.message);
    }

    const populated = await populateClass(coachClass._id);
    let notify = { success: false };
    try {
      notify = await coachClassNotifyService.notifyCoachClassAssigned(populated);
    } catch (notifyErr) {
      console.error('教練課堂 OpenWA 通知失敗（課堂已建立）:', notifyErr.message);
      notify = { success: false, error: notifyErr.message };
    }

    res.status(201).json({
      message: linkExistingBookings
        ? '教練課堂已建立並連結既有預約'
        : bookingIds.length
          ? `教練課堂已建立，並已 hold ${bookingIds.length} 個場地`
          : payload.regularActivityId && payload.locationType === 'court'
            ? '恆常班課堂已建立（不 hold 場地）'
            : '教練課堂已建立',
      coachClass: populated,
      notify,
      hours: payload.hours,
      totalPay: totalPay(payload.coachPayments),
      location: coachClassLocationLabel(populated),
      dateLabel: coachClassNotifyService.formatDateLabel(populated.sessionDate),
      viewUrl: `${getClientBaseUrl()}/coach-courses?class=${populated._id}`,
    });
  } catch (error) {
    console.error('coach-classes create:', error);
    res.status(error.status || 400).json({ message: error.message || '建立失敗' });
  }
});

// @route   PUT /api/coach-classes/:id
router.put('/:id', writeValidators, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }

    const coachClass = await CoachClass.findById(req.params.id);
    if (!coachClass) {
      return res.status(404).json({ message: '教練課堂不存在' });
    }
    if (coachClass.status === 'cancelled') {
      return res.status(400).json({ message: '已取消的課堂不可編輯' });
    }
    if (coachClass.paymentStatus === 'paid') {
      return res.status(400).json({ message: '已付款課堂不可編輯，請先處理會計紀錄' });
    }

    const payload = await buildCoachClassPayload(req.body, { existing: coachClass });
    const linkedBookingIds = await resolveLinkedBookingIds(req.body);
    const oldBookingIds = uniqueIds([
      ...(coachClass.bookings || []),
      coachClass.booking,
    ]);

    let bookingIds = [];
    let linkExistingBookings = Boolean(coachClass.linkExistingBookings);

    if (linkedBookingIds) {
      // 明確傳入既有預約：保留連結、不取消客戶預約
      if (shouldManageHoldBookings(coachClass)) {
        await cancelBookings(oldBookingIds);
      }
      bookingIds = linkedBookingIds;
      linkExistingBookings = true;
    } else if (!shouldManageHoldBookings(coachClass)) {
      // 原本已連結既有預約：更新課堂欄位，保留原預約
      bookingIds = oldBookingIds;
      linkExistingBookings = true;
    } else {
      await cancelBookings(oldBookingIds);
      if (shouldHoldCourtsForCoachClass(payload)) {
        bookingIds = await createHoldBookings({
          coachIds: payload.coachIds,
          courtIds: payload.courtIds,
          dateObj: payload.dateObj,
          startTime: payload.startTime,
          endTime: payload.endTime,
          title: payload.title,
          notes: payload.notes,
        });
      }
      linkExistingBookings = false;
    }

    coachClass.title = payload.title;
    coachClass.store = payload.storeId;
    coachClass.coaches = payload.coachIds;
    coachClass.coach = payload.coachIds[0];
    coachClass.coachPayments = payload.coachPayments;
    coachClass.locationType = payload.locationType;
    coachClass.courts = payload.courtIds;
    coachClass.court = payload.courtIds[0] || null;
    coachClass.customLocation =
      payload.locationType === 'custom' ? payload.customLocation : '';
    coachClass.sessionDate = payload.dateObj;
    coachClass.startTime = payload.startTime;
    coachClass.endTime = payload.endTime;
    coachClass.notes = payload.notes;
    coachClass.activity = payload.activityId;
    coachClass.regularActivity = payload.regularActivityId;
    coachClass.bookings = bookingIds;
    coachClass.booking = bookingIds[0] || null;
    coachClass.linkExistingBookings = linkExistingBookings;
    coachClass.reminderSentAt = null;
    await coachClass.save();

    try {
      await syncLinkedActivity(coachClass);
    } catch (syncErr) {
      console.error('同步活動教練失敗（課堂已更新）:', syncErr.message);
    }

    const populated = await populateClass(coachClass._id);
    let notify = { success: false };
    try {
      notify = await coachClassNotifyService.notifyCoachClassAssigned(populated);
    } catch (notifyErr) {
      console.error('教練課堂更新通知失敗:', notifyErr.message);
      notify = { success: false, error: notifyErr.message };
    }

    res.json({
      message: '教練課堂已更新',
      coachClass: populated,
      notify,
      hours: payload.hours,
      totalPay: totalPay(payload.coachPayments),
      location: coachClassLocationLabel(populated),
      dateLabel: coachClassNotifyService.formatDateLabel(populated.sessionDate),
      viewUrl: `${getClientBaseUrl()}/coach-courses?class=${populated._id}`,
    });
  } catch (error) {
    console.error('coach-classes update:', error);
    res.status(error.status || 400).json({ message: error.message || '更新失敗' });
  }
});

// @route   POST /api/coach-classes/:id/resend-notify
// 管理員手動重發 OpenWA（不論是否已提醒過，都會再發一次給該堂所有教練）
router.post('/:id/resend-notify', [auth, adminAuth], async (req, res) => {
  try {
    const coachClass = await CoachClass.findById(req.params.id);
    if (!coachClass) {
      return res.status(404).json({ message: '教練課堂不存在' });
    }
    if (coachClass.status === 'cancelled') {
      return res.status(400).json({ message: '已取消課堂不可重發通知' });
    }

    const populated = await populateClass(coachClass._id);
    let notify = { success: false, sent: 0 };
    try {
      notify = await coachClassNotifyService.notifyCoachClassAssigned(populated);
    } catch (notifyErr) {
      console.error('教練課堂重發 OpenWA 失敗:', notifyErr.message);
      return res.status(502).json({
        message: notifyErr.message || 'OpenWA 發送失敗',
        notify: { success: false, error: notifyErr.message },
      });
    }

    if (!notify.success && notify.reason === 'openwa_not_configured') {
      return res.status(503).json({ message: 'OpenWA 尚未設定，無法發送', notify });
    }
    if (!notify.success && notify.sent === 0) {
      return res.status(400).json({
        message: notify.reason === 'no_coach' ? '此課堂沒有教練' : '未能發送（請檢查教練電話）',
        notify,
      });
    }

    res.json({
      message: `已重發通知（成功 ${notify.sent || 0} 則）`,
      notify,
      coachClass: populated,
    });
  } catch (error) {
    console.error('coach-classes resend-notify:', error);
    res.status(500).json({ message: error.message || '重發通知失敗' });
  }
});

// @route   POST /api/coach-classes/:id/mark-paid
router.post('/:id/mark-paid', [auth, adminAuth], async (req, res) => {
  try {
    const coachClass = await CoachClass.findById(req.params.id);
    if (!coachClass) {
      return res.status(404).json({ message: '教練課堂不存在' });
    }
    const result = await markClassPaid(coachClass, req.user.id || req.user._id);
    const populated = await populateClass(result.coachClass._id);
    res.json({
      message: '已標記付款並寫入會計支出（薪資）',
      coachClass: populated,
      accountingTransaction: result.accountingTransaction,
      totalPay: totalPay(populated.coachPayments),
    });
  } catch (error) {
    console.error('coach-classes mark-paid:', error);
    res.status(error.status || 400).json({ message: error.message || '標記付款失敗' });
  }
});

// @route   POST /api/coach-classes/:id/cancel
router.post('/:id/cancel', [auth, adminAuth], async (req, res) => {
  try {
    const coachClass = await CoachClass.findById(req.params.id);
    if (!coachClass) {
      return res.status(404).json({ message: '教練課堂不存在' });
    }
    if (coachClass.status === 'cancelled') {
      return res.status(400).json({ message: '課堂已取消' });
    }
    if (coachClass.paymentStatus === 'paid') {
      return res.status(400).json({ message: '已付款課堂不可取消，請先處理會計紀錄' });
    }

    coachClass.status = 'cancelled';
    await coachClass.save();

    if (shouldManageHoldBookings(coachClass)) {
      await cancelBookings([...(coachClass.bookings || []), coachClass.booking]);
    }

    res.json({ message: '教練課堂已取消', coachClass });
  } catch (error) {
    console.error('coach-classes cancel:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
