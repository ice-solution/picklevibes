const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { isAdminPanelUser } = require('../utils/adminAccess');
const fullVenueService = require('../services/fullVenueService');
const User = require('../models/User');
const { normalizeBookingDateInput } = require('../utils/bookingDateTime');
const {
  sendBookingNotification,
  applyTempAuthToBooking,
} = require('../services/bookingNotificationService');
const Court = require('../models/Court');
const Store = require('../models/Store');
const { isFullVenueEnabledForStore } = require('../utils/storeFeatures');

// 創建包場預約
router.post('/create', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, duration, players, totalPlayers, notes, userId, bypassRestrictions, storeId } = req.body;
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
    const resolvedStoreId = storeId || req.body.store;
    if (!resolvedStoreId) {
      return res.status(400).json({ success: false, message: '請選擇店鋪' });
    }

    const storeDoc = await Store.findById(resolvedStoreId).select('slug name');
    if (!storeDoc) {
      return res.status(404).json({ success: false, message: '店鋪不存在' });
    }
    if (!isFullVenueEnabledForStore(storeDoc)) {
      return res.status(400).json({
        success: false,
        message: `${storeDoc.name} 暫不開放包場預約`
      });
    }

    const result = await fullVenueService.createFullVenueBooking({
      date: normalizeBookingDateInput(date),
      startTime,
      endTime,
      duration: parseInt(duration),
      players,
      totalPlayers: parseInt(totalPlayers),
      notes
    }, user, {
      pointsDeduction: req.body.pointsDeduction || 0,
      bypassRestrictions: bypassRestrictions,
      storeId: resolvedStoreId,
      includeInactive: isAdminPanelUser(req.user),
    });

    try {
      const firstBooking = result.bookings[0];
      const courtDoc = await Court.findById(firstBooking.court);
      const notifyResult = await sendBookingNotification({
        booking: firstBooking,
        courtDoc,
        userFallback: user,
        emailOverrides: { courtName: '包場預約 - 所有場地' },
      });
      if (notifyResult.mode === 'hik' && notifyResult.accessControlResult) {
        const Booking = require('../models/Booking');
        const b = await Booking.findById(firstBooking._id);
        await applyTempAuthToBooking(b, notifyResult.accessControlResult);
      }
      console.log('📧 包場預約通知已發送');
    } catch (emailError) {
      console.error('❌ 包場預約通知發送失敗:', emailError);
    }

    const { scheduleTuyaCourtsSync } = require('../services/tuyaSchedulerService');
    scheduleTuyaCourtsSync(
      (result.bookings || []).map((b) => b.court),
      'full_venue_created'
    );

    res.json({
      success: true,
      data: result,
      message: result.message
    });

  } catch (error) {
    console.error('創建包場預約失敗:', error);
    const status = error.statusCode === 409 ? 409 : 500;
    res.status(status).json({
      success: false,
      message: error.message || '創建包場預約失敗',
      conflicts: error.conflicts || []
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
    const { date, startTime, endTime, storeId } = req.body;
    const resolvedStoreId = storeId || req.body.store;

    if (!resolvedStoreId) {
      return res.status(400).json({ success: false, message: '請選擇店鋪' });
    }

    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: '請提供日期、開始時間和結束時間'
      });
    }

    const storeDoc = await Store.findById(resolvedStoreId).select('slug name');
    if (!storeDoc) {
      return res.status(404).json({ success: false, message: '店鋪不存在' });
    }
    if (!isFullVenueEnabledForStore(storeDoc)) {
      return res.status(400).json({
        success: false,
        message: `${storeDoc.name} 暫不開放包場預約`
      });
    }

    const conflictCheck = await fullVenueService.checkTimeConflicts(
      normalizeBookingDateInput(date),
      startTime,
      endTime,
      resolvedStoreId,
      { includeInactive: isAdminPanelUser(req.user) }
    );

    res.json({
      success: true,
      data: {
        available: !conflictCheck.hasConflict,
        conflicts: conflictCheck.conflicts || []
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
