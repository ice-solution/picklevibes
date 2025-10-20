const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const fullVenueService = require('../services/fullVenueService');
const User = require('../models/User');
const accessControlService = require('../services/accessControlService');

// 創建包場預約
router.post('/create', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, duration, players, totalPlayers, notes, userId, bypassRestrictions } = req.body;
    // 如果是管理員創建，使用指定的userId，否則使用當前用戶
    const targetUserId = userId || req.user.id;

    // 驗證必填字段
    if (!date || !startTime || !endTime || !duration || !players || !totalPlayers) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填字段'
      });
    }

    // 獲取用戶信息
    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用戶不存在'
      });
    }

    // 創建包場預約
    const result = await fullVenueService.createFullVenueBooking({
      date: new Date(date),
      startTime,
      endTime,
      duration: parseInt(duration),
      players,
      totalPlayers: parseInt(totalPlayers),
      notes
    }, user, {
      pointsDeduction: req.body.pointsDeduction || 0,
      bypassRestrictions: bypassRestrictions
    });

    // 發送QR碼郵件（使用第一個預約記錄）
    try {
      const visitorData = {
        name: players[0]?.name || user.name,
        email: players[0]?.email || user.email,
        phone: players[0]?.phone || user.phone
      };
      
      const firstBooking = result.bookings[0];
      const bookingData = {
        id: firstBooking._id,
        date: firstBooking.date,
        startTime: firstBooking.startTime,
        endTime: firstBooking.endTime,
        courtName: '包場預約 - 所有場地',
        totalPrice: result.totalPrice
      };

      await accessControlService.processAccessControl(visitorData, bookingData);
      console.log('📧 包場QR碼郵件發送成功');
    } catch (emailError) {
      console.error('❌ 包場QR碼郵件發送失敗:', emailError);
      // 不影響預約創建，只記錄錯誤
    }

    res.json({
      success: true,
      data: result,
      message: result.message
    });

  } catch (error) {
    console.error('創建包場預約失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '創建包場預約失敗'
    });
  }
});

// 獲取包場預約列表
router.get('/list', auth, async (req, res) => {
  try {
    const { status, date } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (date) filters.date = date;

    const bookings = await fullVenueService.getFullVenueBookings(filters);

    res.json({
      success: true,
      data: bookings,
      count: bookings.length
    });

  } catch (error) {
    console.error('獲取包場預約列表失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '獲取包場預約列表失敗'
    });
  }
});

// 獲取包場預約詳情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const details = await fullVenueService.getFullVenueBookingDetails(id);

    res.json({
      success: true,
      data: details
    });

  } catch (error) {
    console.error('獲取包場預約詳情失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '獲取包場預約詳情失敗'
    });
  }
});

// 取消包場預約
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await fullVenueService.cancelFullVenueBooking(id);

    res.json({
      success: true,
      data: result,
      message: result.message
    });

  } catch (error) {
    console.error('取消包場預約失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '取消包場預約失敗'
    });
  }
});

// 檢查包場時間可用性
router.post('/check-availability', auth, async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: '請提供日期、開始時間和結束時間'
      });
    }

    const conflictCheck = await fullVenueService.checkTimeConflicts(
      new Date(date),
      startTime,
      endTime
    );

    res.json({
      success: true,
      data: {
        available: !conflictCheck.hasConflict,
        conflicts: conflictCheck.conflictDetails
      }
    });

  } catch (error) {
    console.error('檢查包場可用性失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '檢查包場可用性失敗'
    });
  }
});

module.exports = router;
