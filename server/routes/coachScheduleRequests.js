const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const CoachScheduleRequest = require('../models/CoachScheduleRequest');
const { auth, adminAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');
const { createAdminBypassBooking } = require('../services/adminBypassBooking');

const router = express.Router();

function getAdminPanelUrl() {
  const base = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/admin?tab=coach-requests`;
}

function formatDateLabelHK(d) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// @route   GET /api/coach-schedule-requests/my
// @desc    教練自己的申請列表
// @access  Private (coach)
router.get('/my', auth, async (req, res) => {
  try {
    if (req.user.role !== 'coach') {
      return res.status(403).json({ message: '僅教練可查看' });
    }
    const requests = await CoachScheduleRequest.find({ coach: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ requests });
  } catch (error) {
    console.error('coach-schedule-requests my:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/coach-schedule-requests
// @desc    管理員列表
// @access  Private (admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const status = req.query.status;
    const q = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      q.status = status;
    }
    const requests = await CoachScheduleRequest.find(q)
      .populate('coach', 'name email phone')
      .populate('court', 'name number type')
      .populate('booking')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json({ requests });
  } catch (error) {
    console.error('coach-schedule-requests list:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/coach-schedule-requests
// @desc    教練提交要請（發信至 EMAIL_USER）
// @access  Private (coach)
router.post(
  '/',
  [
    auth,
    body('requestDate').notEmpty().withMessage('請選擇日期'),
    body('startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('開始時間格式須為 HH:MM'),
    body('endTime')
      .matches(/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/)
      .withMessage('結束時間格式須為 HH:MM 或 24:00'),
    body('message').optional().trim().isLength({ max: 2000 }).withMessage('訊息過長')
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'coach') {
        return res.status(403).json({ message: '僅教練可提交要請' });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { requestDate, startTime, endTime, message } = req.body;
      const requestDateObj = new Date(requestDate);
      if (Number.isNaN(requestDateObj.getTime())) {
        return res.status(400).json({ message: '日期無效' });
      }

      const coachUser = await User.findById(req.user.id).select('name email phone');
      if (!coachUser) {
        return res.status(404).json({ message: '找不到用戶' });
      }

      const doc = await CoachScheduleRequest.create({
        coach: req.user.id,
        requestDate: requestDateObj,
        startTime,
        endTime,
        message: message || '',
        status: 'pending'
      });

      const dateLabel = formatDateLabelHK(requestDateObj);
      const timeRange = `${startTime} - ${endTime}`;
      const adminUrl = getAdminPanelUrl();

      await emailService.sendCoachScheduleRequestEmail({
        coachName: coachUser.name || '教練',
        dateLabel,
        timeRange,
        message: message || '',
        adminPanelUrl: adminUrl
      });

      res.status(201).json({
        message: '已送出，管理員將收到電郵通知',
        request: doc,
        redirectUrl: adminUrl
      });
    } catch (error) {
      console.error('coach-schedule-requests create:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

// @route   POST /api/coach-schedule-requests/:id/approve
// @desc    批核並寫入預約日曆
// @access  Private (admin)
router.post(
  '/:id/approve',
  [
    auth,
    adminAuth,
    body('court').isMongoId().withMessage('請選擇場地')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const reqDoc = await CoachScheduleRequest.findById(req.params.id).populate('coach');
      if (!reqDoc) {
        return res.status(404).json({ message: '申請不存在' });
      }
      if (reqDoc.status !== 'pending') {
        return res.status(400).json({ message: '此申請已處理' });
      }

      const { court } = req.body;
      const specialRequests = [
        '教練學校要請（已批核）',
        reqDoc.message ? `備註：${reqDoc.message}` : ''
      ]
        .filter(Boolean)
        .join('｜');

      const booking = await createAdminBypassBooking({
        userId: reqDoc.coach._id,
        courtId: court,
        dateInput: reqDoc.requestDate,
        startTime: reqDoc.startTime,
        endTime: reqDoc.endTime,
        specialRequests
      });

      reqDoc.status = 'approved';
      reqDoc.court = court;
      reqDoc.booking = booking._id;
      reqDoc.processedBy = req.user.id;
      reqDoc.processedAt = new Date();
      await reqDoc.save();

      const populated = await CoachScheduleRequest.findById(reqDoc._id)
        .populate('coach', 'name email phone')
        .populate('court', 'name number type')
        .populate('booking');

      res.json({
        message: '已批核並建立預約',
        request: populated,
        booking
      });
    } catch (error) {
      console.error('coach-schedule-requests approve:', error);
      const msg = error.message || '批核失敗';
      res.status(400).json({ message: msg });
    }
  }
);

// @route   POST /api/coach-schedule-requests/:id/reject
// @access  Private (admin)
router.post(
  '/:id/reject',
  [auth, adminAuth, body('reason').optional().trim().isLength({ max: 500 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const reqDoc = await CoachScheduleRequest.findById(req.params.id);
      if (!reqDoc) {
        return res.status(404).json({ message: '申請不存在' });
      }
      if (reqDoc.status !== 'pending') {
        return res.status(400).json({ message: '此申請已處理' });
      }

      reqDoc.status = 'rejected';
      reqDoc.rejectionReason = req.body.reason || '';
      reqDoc.processedBy = req.user.id;
      reqDoc.processedAt = new Date();
      await reqDoc.save();

      res.json({ message: '已拒絕', request: reqDoc });
    } catch (error) {
      console.error('coach-schedule-requests reject:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

module.exports = router;
