const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/bookings
// @desc    創建新預約
// @access  Private
router.post('/', [
  auth,
  body('court').isMongoId().withMessage('請提供有效的場地ID'),
  body('date').isISO8601().withMessage('請提供有效的日期格式'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的開始時間'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的結束時間'),
  body('players').isArray({ min: 1, max: 7 }).withMessage('玩家信息必須是1-7個對象的數組'),
  body('players.*.name').trim().isLength({ min: 1, max: 50 }).withMessage('玩家姓名必須在1-50個字符之間'),
  body('players.*.email').isEmail().withMessage('玩家電子郵件格式無效'),
  body('players.*.phone').matches(/^[0-9+\-\s()]+$/).withMessage('玩家電話號碼格式無效'),
  body('specialRequests').optional().trim().isLength({ max: 500 }).withMessage('特殊要求不能超過500個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { court, date, startTime, endTime, players, specialRequests } = req.body;

    // 檢查場地是否存在且可用
    const courtDoc = await Court.findById(court);
    if (!courtDoc) {
      return res.status(404).json({ message: '場地不存在' });
    }

    if (!courtDoc.isAvailable()) {
      return res.status(400).json({ message: '場地目前不可用' });
    }

    // 檢查場地是否在營業時間內開放
    const bookingDate = new Date(date);
    if (!courtDoc.isOpenAt(bookingDate)) {
      return res.status(400).json({ message: '場地在該時間段不開放' });
    }

    // 檢查時間衝突
    const hasConflict = await Booking.checkTimeConflict(court, date, startTime, endTime);
    if (hasConflict) {
      return res.status(400).json({ message: '該時間段已被預約' });
    }

    // 計算持續時間
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    const duration = endMinutes - startMinutes;

    if (duration <= 0) {
      return res.status(400).json({ message: '結束時間必須晚於開始時間' });
    }

    // 創建預約（初始狀態為 pending，等待支付）
    const booking = new Booking({
      user: req.user.id,
      court,
      date: bookingDate,
      startTime,
      endTime,
      duration,
      players,
      totalPlayers: players.length + 1, // 包含預約者本人
      specialRequests,
      status: 'pending', // 明確設置為待支付狀態
      payment: {
        status: 'pending',
        method: 'stripe'
      }
    });

    // 計算價格
    const isMember = req.user.membershipLevel !== 'basic';
    booking.calculatePrice(courtDoc, isMember);

    await booking.save();

    // 填充場地信息
    await booking.populate('court', 'name number type amenities');

    res.status(201).json({
      message: '預約創建成功',
      booking
    });
  } catch (error) {
    console.error('創建預約錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/bookings
// @desc    獲取用戶預約列表
// @access  Private
router.get('/', [auth], async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('court', 'name number type')
      .sort({ date: -1, startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取預約列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/bookings/:id
// @desc    獲取單個預約詳情
// @access  Private
router.get('/:id', [auth], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('court', 'name number type amenities pricing')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    // 檢查權限（用戶只能查看自己的預約，管理員可以查看所有）
    if (booking.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '無權限查看此預約' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('獲取預約詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    取消預約
// @access  Private
router.put('/:id/cancel', [
  auth,
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('取消原因不能超過200個字符')
], async (req, res) => {
  try {
    const { reason } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    // 檢查權限
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '無權限取消此預約' });
    }

    // 檢查是否可以取消
    if (!booking.canBeCancelled()) {
      return res.status(400).json({ 
        message: '預約無法取消，請至少提前2小時取消或聯繫客服' 
      });
    }

    // 更新預約狀態
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: booking.user.toString() === req.user.id ? 'user' : 'admin',
      reason
    };

    await booking.save();

    res.json({ 
      message: '預約取消成功',
      booking 
    });
  } catch (error) {
    console.error('取消預約錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    更新預約狀態（管理員）
// @access  Private (Admin)
router.put('/:id/status', [
  auth,
  adminAuth,
  body('status').isIn(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']).withMessage('無效的預約狀態')
], async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    res.json({
      message: '預約狀態更新成功',
      booking
    });
  } catch (error) {
    console.error('更新預約狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/bookings/admin/all
// @desc    獲取所有預約（管理員）
// @access  Private (Admin)
router.get('/admin/all', [
  auth,
  adminAuth
], async (req, res) => {
  try {
    const { 
      status, 
      court, 
      date, 
      page = 1, 
      limit = 20 
    } = req.query;
    
    let query = {};
    
    if (status) query.status = status;
    if (court) query.court = court;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('court', 'name number type')
      .sort({ date: -1, startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取所有預約錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/bookings/calendar/:courtId
// @desc    獲取場地日曆視圖
// @access  Public
router.get('/calendar/:courtId', [
  query('date').isISO8601().withMessage('請提供有效的日期格式')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { courtId } = req.params;
    const { date } = req.query;
    
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const bookings = await Booking.find({
      court: courtId,
      date: { $gte: startDate, $lt: endDate },
      status: { $in: ['confirmed', 'pending'] }
    }).select('startTime endTime status user');

    res.json({ bookings });
  } catch (error) {
    console.error('獲取場地日曆錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
