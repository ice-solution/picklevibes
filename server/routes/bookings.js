const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const UserBalance = require('../models/UserBalance');
const { auth, adminAuth } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');

const router = express.Router();

// 輔助函數：將 24:00 轉換為 00:00
function normalizeTime(time) {
  if (time === '24:00') {
    return '00:00';
  }
  return time;
}

// 輔助函數：將 24:00 轉換為下一天的 00:00
function normalizeDateTime(date, time) {
  const normalizedDate = new Date(date);
  
  if (time === '24:00') {
    // 如果是 24:00，則轉換為下一天的 00:00
    normalizedDate.setDate(normalizedDate.getDate() + 1);
    return { date: normalizedDate, time: '00:00' };
  }
  
  return { date: normalizedDate, time };
}

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
  body('specialRequests').optional().trim().isLength({ max: 500 }).withMessage('特殊要求不能超過500個字符'),
  body('includeSoloCourt').optional().isBoolean().withMessage('單人場租用選項必須是布爾值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    let { court, date, startTime, endTime, players, totalPlayers, specialRequests, includeSoloCourt = false, bypassRestrictions = false } = req.body;
    
    // 調試：記錄接收到的參數
    console.log('🔍 預約創建請求參數:', {
      court,
      date,
      startTime,
      endTime,
      players: players?.length,
      totalPlayers,
      specialRequests,
      includeSoloCourt
    });

    // 將 24:00 轉換為下一天的 00:00
    const normalizedEndTime = normalizeDateTime(date, endTime);
    const normalizedStartTime = { date: new Date(date), time: startTime };
    
    // 使用標準化後的時間
    endTime = normalizedEndTime.time;
    const endDate = normalizedEndTime.date;

    // 檢查場地是否存在且可用
    const courtDoc = await Court.findById(court);
    if (!courtDoc) {
      return res.status(404).json({ message: '場地不存在' });
    }

    // 如果不是管理員 bypass，檢查場地可用性
    if (!bypassRestrictions && !courtDoc.isAvailable()) {
      return res.status(400).json({ message: '場地目前不可用' });
    }

    // 如果不是管理員 bypass，檢查場地是否在營業時間內開放
    const bookingDate = new Date(date);
    if (!bypassRestrictions && !courtDoc.isOpenAt(bookingDate, startTime, endTime)) {
      return res.status(400).json({ message: '場地在該時間段不開放' });
    }

    // 如果不是管理員 bypass，檢查時間衝突
    if (!bypassRestrictions) {
      const hasConflict = await Booking.checkTimeConflict(court, date, startTime, endTime);
      if (hasConflict) {
        return res.status(400).json({ message: '該時間段已被預約' });
      }
    }

    // 計算持續時間
    const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
    let endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
    
    // 判斷是否跨天
    const isOvernight = endMinutes <= startMinutes;
    
    // 如果結束時間小於開始時間，表示跨天（例如 22:00 到 00:00）
    if (isOvernight) {
      endMinutes += 24 * 60; // 加上 24 小時
    }
    
    const duration = endMinutes - startMinutes;

    if (duration <= 0) {
      return res.status(400).json({ message: '結束時間必須晚於開始時間' });
    }

    // 如果不是管理員 bypass，檢查時長限制（最多2小時）
    if (!bypassRestrictions) {
      if (duration < 60) {
        return res.status(400).json({ message: '預約時長至少1小時' });
      }
      
      if (duration > 120) {
        return res.status(400).json({ message: '預約時長最多2小時' });
      }
    }

    // 計算結束日期（如果跨天，則為下一天）
    const calculatedEndDate = new Date(bookingDate);
    if (isOvernight) {
      calculatedEndDate.setDate(calculatedEndDate.getDate() + 1);
    }

    // 計算價格
    const isMember = req.user.membershipLevel !== 'basic';
    const isVip = req.user.membershipLevel === 'vip';
    
    // 創建預約對象來計算價格
    const tempBooking = new Booking({
      user: req.user.id,
      court,
      date: bookingDate,
      endDate: calculatedEndDate,
      startTime,
      endTime,
      duration,
      players,
      totalPlayers: totalPlayers, // 直接使用前端發送的 totalPlayers
      specialRequests
    });
    
    // 計算價格
    tempBooking.calculatePrice(courtDoc, isMember);
    
    // 計算實際需要扣除的積分（VIP會員8折）
    let pointsToDeduct = Math.round(tempBooking.pricing.totalPrice);
    
    // 如果包含單人場租用，添加100積分
    if (includeSoloCourt) {
      pointsToDeduct += 100;
    }
    
    if (isVip) {
      pointsToDeduct = Math.round(pointsToDeduct * 0.8); // VIP會員8折
    }
    
    // 檢查用戶餘額
    let userBalance = await UserBalance.findOne({ user: req.user.id });
    if (!userBalance) {
      userBalance = new UserBalance({ user: req.user.id });
    }
    
    // 如果不是管理員 bypass，檢查積分餘額
    if (!bypassRestrictions && userBalance.balance < pointsToDeduct) {
      return res.status(400).json({ 
        message: '積分餘額不足',
        required: pointsToDeduct,
        available: userBalance.balance,
        discount: isVip ? 'VIP會員8折' : '無折扣'
      });
    }
    
    // 如果不是管理員 bypass，扣除積分
    if (!bypassRestrictions) {
      await userBalance.deductBalance(
        pointsToDeduct, 
        `場地預約 - ${courtDoc.name} ${bookingDate.toDateString()} ${startTime}-${endTime}`,
        null // 稍後會更新為實際的預約ID
      );
    }
    
    // 創建預約數據對象
    const bookingData = {
      user: req.user.id,
      court,
      date: bookingDate,
      endDate: calculatedEndDate,
      startTime,
      endTime,
      duration,
      players,
      totalPlayers: totalPlayers, // 直接使用前端發送的 totalPlayers
      specialRequests,
      includeSoloCourt, // 添加單人場租用信息
      bypassRestrictions, // 記錄是否繞過了限制
      status: 'confirmed', // 直接確認
      payment: {
        status: 'paid',
        method: 'points',
        paidAt: new Date(),
        pointsDeducted: pointsToDeduct,
        originalPrice: tempBooking.pricing.totalPrice,
        discount: isVip ? 20 : 0 // VIP折扣百分比
      },
      pricing: {
        basePrice: tempBooking.pricing.basePrice,
        memberDiscount: tempBooking.pricing.memberDiscount,
        totalPrice: tempBooking.pricing.totalPrice,
        pointsDeducted: pointsToDeduct,
        vipDiscount: isVip ? 20 : 0,
        soloCourtFee: includeSoloCourt ? 100 : 0 // 單人場費用
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let booking;

    // 如果是管理員 bypass，直接插入數據庫繞過所有驗證
    if (bypassRestrictions) {
      const result = await Booking.collection.insertOne(bookingData);
      booking = await Booking.findById(result.insertedId);
    } else {
      // 正常流程，使用 Mongoose 驗證
      booking = new Booking(bookingData);
      await booking.save();
    }
    
    // 調試：記錄保存的預約信息
    console.log('🔍 預約保存成功:', {
      bookingId: booking._id,
      includeSoloCourt: booking.includeSoloCourt,
      soloCourtFee: booking.pricing.soloCourtFee,
      totalPointsDeducted: booking.pricing.pointsDeducted
    });
    
    // 如果包含單人場，創建單人場預約記錄
    let soloCourtBooking = null;
    if (includeSoloCourt) {
      console.log('🔍 創建單人場預約記錄...');
      
      // 找到單人場
      const soloCourt = await Court.findOne({ type: 'solo' });
      if (!soloCourt) {
        console.error('❌ 找不到單人場');
        return res.status(500).json({ message: '找不到單人場' });
      }
      
      // 創建單人場預約數據對象
      const soloCourtBookingData = {
        user: req.user.id,
        court: soloCourt._id,
        date: bookingDate,
        endDate: calculatedEndDate,
        startTime,
        endTime,
        duration,
        players: players, // 使用相同的玩家信息
        totalPlayers: totalPlayers, // 直接使用前端發送的 totalPlayers
        specialRequests: `單人場租用 - 與主場地同時段使用`,
        includeSoloCourt: false, // 單人場記錄本身不包含單人場
        bypassRestrictions, // 記錄是否繞過了限制
        status: 'confirmed',
        payment: {
          status: 'paid',
          method: 'points',
          paidAt: new Date(),
          pointsDeducted: 0, // 單人場費用已包含在主預約中
          originalPrice: 100,
          discount: 0
        },
        pricing: {
          basePrice: 100,
          memberDiscount: 0,
          totalPrice: 100,
          pointsDeducted: 0, // 費用已包含在主預約中
          vipDiscount: 0,
          soloCourtFee: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 如果是管理員 bypass，直接插入數據庫繞過所有驗證
      if (bypassRestrictions) {
        const soloResult = await Booking.collection.insertOne(soloCourtBookingData);
        soloCourtBooking = await Booking.findById(soloResult.insertedId);
      } else {
        // 正常流程，使用 Mongoose 驗證
        soloCourtBooking = new Booking(soloCourtBookingData);
        await soloCourtBooking.save();
      }
      console.log('🔍 單人場預約記錄創建成功:', {
        soloBookingId: soloCourtBooking._id,
        soloCourt: soloCourt.name,
        date: bookingDate,
        timeSlot: `${startTime}-${endTime}`
      });
    }
    
    // 更新用戶餘額記錄中的預約ID
    const latestTransaction = userBalance.transactions[userBalance.transactions.length - 1];
    latestTransaction.relatedBooking = booking._id;
    await userBalance.save();

    // 填充場地信息
    await booking.populate('court', 'name number type amenities');

    // 發送 WhatsApp 確認通知
    try {
      const phoneNumber = booking.players[0]?.phone || req.user.phone;
      if (phoneNumber && whatsappService.isValidPhoneNumber(phoneNumber)) {
        await whatsappService.sendBookingConfirmation(booking, phoneNumber);
        console.log('✅ WhatsApp 預約確認通知已發送');
      } else {
        console.log('⚠️ 無法發送 WhatsApp 通知：電話號碼無效或不存在');
      }
    } catch (whatsappError) {
      console.error('❌ WhatsApp 通知發送失敗:', whatsappError);
      // 不影響預約創建，只記錄錯誤
    }

    // 準備響應數據
    const responseData = {
      message: '預約創建成功',
      booking,
      pointsDeducted: pointsToDeduct,
      remainingBalance: userBalance.balance,
      discount: isVip ? 'VIP會員8折' : '無折扣'
    };

    // 如果創建了單人場預約，添加到響應中
    if (soloCourtBooking) {
      await soloCourtBooking.populate('court', 'name number type amenities');
      responseData.soloCourtBooking = soloCourtBooking;
      responseData.message = '預約創建成功（包含單人場）';
    }

    res.status(201).json(responseData);
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

    // 發送 WhatsApp 取消通知
    try {
      const phoneNumber = booking.players[0]?.phone || req.user.phone;
      if (phoneNumber && whatsappService.isValidPhoneNumber(phoneNumber)) {
        await whatsappService.sendBookingCancellation(booking, phoneNumber);
        console.log('✅ WhatsApp 預約取消通知已發送');
      } else {
        console.log('⚠️ 無法發送 WhatsApp 通知：電話號碼無效或不存在');
      }
    } catch (whatsappError) {
      console.error('❌ WhatsApp 通知發送失敗:', whatsappError);
      // 不影響預約取消，只記錄錯誤
    }

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

// @route   POST /api/bookings/:id/confirm
// @desc    確認預約 (預留功能，待開發)
// @access  Private
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: 在此處實現確認預約的業務邏輯
    // 例如：
    // - 驗證預約狀態
    // - 發送確認通知
    // - 更新預約狀態
    // - 記錄確認時間
    
    // 暫時返回成功訊息
    res.json({ 
      message: '確認預約功能開發中',
      bookingId: id
    });
    
  } catch (error) {
    console.error('確認預約錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
