const express = require('express');
const { body, validationResult } = require('express-validator');
const CoachClass = require('../models/CoachClass');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Court = require('../models/Court');
const { auth, adminAuth } = require('../middleware/auth');
const { createAdminBypassBooking } = require('../services/adminBypassBooking');
const { getCoachCalendarEvents, getCoachAssignments, coachClassLocationLabel } = require('../services/coachScheduleService');
const emailService = require('../services/emailService');

const router = express.Router();

function getClientBaseUrl() {
  return (process.env.CLIENT_URL || process.env.PUBLIC_WEB_URL || 'https://picklevibes.hk').replace(/\/+$/, '');
}

function formatSessionDateLabel(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

// @route   GET /api/coach-classes/calendar
// @desc    教練合併課表（活動 + 教練課堂 + 已批核要請）
// @access  Private (coach)
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
// @desc    教練全部指派項目（列表用）
// @access  Private (coach)
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

// @route   GET /api/coach-classes
// @desc    管理員列出教練課堂
// @access  Private (admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { coach, status } = req.query;
    const q = {};
    if (coach) q.coach = coach;
    if (status && ['scheduled', 'cancelled'].includes(status)) q.status = status;

    const classes = await CoachClass.find(q)
      .populate('coach', 'name email phone')
      .populate({
        path: 'court',
        select: 'name number type store',
        populate: { path: 'store', select: 'name slug' },
      })
      .populate('createdBy', 'name email')
      .populate('booking')
      .sort({ sessionDate: -1, startTime: 1 })
      .limit(500)
      .lean();

    res.json({ classes });
  } catch (error) {
    console.error('coach-classes list:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/coach-classes
// @desc    管理員直接建立教練課堂（場地 + 教練 + 時間）
// @access  Private (admin)
router.post(
  '/',
  [
    auth,
    adminAuth,
    body('coach').notEmpty().withMessage('請選擇教練'),
    body('locationType').optional().isIn(['court', 'custom']).withMessage('地點類型無效'),
    body('court').optional(),
    body('customLocation').optional().trim().isLength({ max: 200 }),
    body('sessionDate').notEmpty().withMessage('請選擇日期'),
    body('startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('開始時間格式須為 HH:MM'),
    body('endTime')
      .matches(/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/)
      .withMessage('結束時間格式須為 HH:MM 或 24:00'),
    body('title').optional().trim().isLength({ max: 120 }),
    body('notes').optional().trim().isLength({ max: 2000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
      }

      const {
        coach,
        court,
        sessionDate,
        startTime,
        endTime,
        title,
        notes,
        locationType = 'court',
        customLocation,
      } = req.body;

      const coachUser = await User.findById(coach).select('role name');
      if (!coachUser || coachUser.role !== 'coach') {
        return res.status(400).json({ message: '請選擇有效的教練帳戶' });
      }

      const resolvedLocationType = locationType === 'custom' ? 'custom' : 'court';
      const trimmedCustomLocation = String(customLocation || '').trim();

      if (resolvedLocationType === 'court' && !court) {
        return res.status(400).json({ message: '請選擇場地' });
      }
      if (resolvedLocationType === 'custom' && !trimmedCustomLocation) {
        return res.status(400).json({ message: '請填寫地點' });
      }

      let courtDoc = null;
      if (resolvedLocationType === 'court') {
        courtDoc = await Court.findById(court);
        if (!courtDoc) {
          return res.status(400).json({ message: '場地不存在' });
        }
      }

      const dateObj = new Date(sessionDate);
      if (Number.isNaN(dateObj.getTime())) {
        return res.status(400).json({ message: '日期無效' });
      }

      let booking = null;
      if (resolvedLocationType === 'court' && courtDoc) {
        booking = await createAdminBypassBooking({
          userId: coach,
          courtId: court,
          dateInput: dateObj,
          startTime,
          endTime,
          specialRequests: `教練課堂${title && title !== '教練課堂' ? ` - ${title}` : ''}${notes ? `｜${notes}` : ''}`,
        });
      }

      const coachClass = await CoachClass.create({
        title: title?.trim() || '教練課堂',
        coach,
        locationType: resolvedLocationType,
        court: resolvedLocationType === 'court' ? court : null,
        customLocation: resolvedLocationType === 'custom' ? trimmedCustomLocation : '',
        sessionDate: dateObj,
        startTime,
        endTime,
        notes: notes?.trim() || '',
        booking: booking?._id || null,
        createdBy: req.user.id,
        status: 'scheduled',
      });

      const populated = await CoachClass.findById(coachClass._id)
        .populate('coach', 'name email phone')
        .populate({
          path: 'court',
          select: 'name number type store',
          populate: { path: 'store', select: 'name slug' },
        })
        .populate('createdBy', 'name email')
        .populate('booking');

      const classId = String(populated._id);
      const baseUrl = getClientBaseUrl();
      try {
        await emailService.sendCoachClassAssignedEmail({
          coachEmail: populated.coach?.email,
          coachName: populated.coach?.name,
          title: populated.title,
          dateLabel: formatSessionDateLabel(populated.sessionDate),
          timeRange: `${populated.startTime} – ${populated.endTime}`,
          location: coachClassLocationLabel(populated),
          notes: populated.notes || '',
          viewUrl: `${baseUrl}/coach-courses?class=${classId}`,
          calendarUrl: `${baseUrl}/coach-calendar?class=${classId}`,
        });
      } catch (mailErr) {
        console.error('教練課堂郵件通知失敗（課堂已建立）:', mailErr);
      }

      res.status(201).json({
        message:
          resolvedLocationType === 'court'
            ? '教練課堂已建立，並已為教練建立場地預約'
            : '教練課堂已建立',
        coachClass: populated,
      });
    } catch (error) {
      console.error('coach-classes create:', error);
      res.status(400).json({ message: error.message || '建立失敗' });
    }
  }
);

// @route   POST /api/coach-classes/:id/cancel
// @desc    管理員取消教練課堂
// @access  Private (admin)
router.post('/:id/cancel', [auth, adminAuth], async (req, res) => {
  try {
    const coachClass = await CoachClass.findById(req.params.id);
    if (!coachClass) {
      return res.status(404).json({ message: '教練課堂不存在' });
    }
    if (coachClass.status === 'cancelled') {
      return res.status(400).json({ message: '課堂已取消' });
    }

    coachClass.status = 'cancelled';
    await coachClass.save();

    if (coachClass.booking) {
      await Booking.findByIdAndUpdate(coachClass.booking, {
        status: 'cancelled',
        updatedAt: new Date(),
      });
    }

    res.json({ message: '教練課堂已取消', coachClass });
  } catch (error) {
    console.error('coach-classes cancel:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
