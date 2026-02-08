const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const { auth, adminAuth } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const accessControlService = require('../services/accessControlService');
const Config = require('../models/Config');

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
  // 結束時間允許 00:00-23:59，另外特別允許 24:00 作為結束時間（代表隔天 00:00）
  body('endTime').matches(/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/).withMessage('請提供有效的結束時間'),
  body('players').isArray({ min: 1, max: 7 }).withMessage('玩家信息必須是1-7個對象的數組'),
  body('players.*.name').trim().isLength({ min: 1, max: 50 }).withMessage('玩家姓名必須在1-50個字符之間'),
  body('players.*.email').isEmail().withMessage('玩家電子郵件格式無效'),
  body('players.*.phone').matches(/^[0-9]+$/).withMessage('玩家電話號碼只能包含數字'),
  body('specialRequests').optional().trim().isLength({ max: 500 }).withMessage('特殊要求不能超過500個字符'),
  body('includeSoloCourt').optional().isBoolean().withMessage('單人場租用選項必須是布爾值'),
  body('customPoints').optional().isInt({ min: 0 }).withMessage('自訂積分必須是非負整數'),
  body('isCustomPoints').optional().isBoolean().withMessage('自訂積分選項必須是布爾值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    let { user, court, date, startTime, endTime, players, totalPlayers, specialRequests, includeSoloCourt = false, redeemCodeId, customPoints, isCustomPoints = false } = req.body;
    
    // 只有管理員才能 bypass 限制
    const bypassRestrictions = req.user.role === 'admin' && req.body.bypassRestrictions === true;
    
    // 如果沒有指定用戶（普通用戶創建），使用當前登錄用戶
    // 如果指定了用戶（管理員創建），使用指定的用戶
    const bookingUserId = user || req.user.id;
    
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

    // 如果不是管理員 bypass，檢查預約日期是否在該角色可預約天數內
    if (!bypassRestrictions) {
      const bookingUserDoc = await User.findById(bookingUserId).select('role');
      const role = bookingUserDoc?.role || 'user';
      const bookingConfig = await Config.getBookingConfig();
      const maxDays = bookingConfig.maxAdvanceDaysByRole[role] ?? 7;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDateOnly = new Date(bookingDate);
      bookingDateOnly.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((bookingDateOnly - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        return res.status(400).json({ message: '不可預約過去的日期' });
      }
      if (diffDays > maxDays) {
        return res.status(400).json({ message: `您的身份最多可預約 ${maxDays} 天內的場地，請選擇較近的日期` });
      }
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
    
    // 處理 24:00 的情況（應該視為隔天的 00:00）
    if (endTime === '24:00') {
      endMinutes = 24 * 60; // 1440 分鐘
    }
    
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
    // 獲取預約用戶的會員級別（如果是管理員創建，使用選擇的用戶；否則使用當前用戶）
    let bookingUser;
    if (user) {
      // 管理員創建預約，獲取選擇的用戶信息
      bookingUser = await User.findById(bookingUserId);
      if (!bookingUser) {
        return res.status(404).json({ message: '選擇的用戶不存在' });
      }
    } else {
      // 普通用戶創建預約，使用當前登錄用戶
      bookingUser = req.user;
    }
    
    const isMember = bookingUser.membershipLevel !== 'basic';
    const isVip = bookingUser.membershipLevel === 'vip';
    
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
    
    // 處理兌換碼折扣
    let redeemCodeData = null;
    if (redeemCodeId) {
      try {
        const RedeemCode = require('../models/RedeemCode');
        const RedeemUsage = require('../models/RedeemUsage');
        
        const redeemCode = await RedeemCode.findById(redeemCodeId);
        if (redeemCode && redeemCode.isValid()) {
          // 檢查適用範圍（僅以此為準）
          if (!redeemCode.applicableTypes.includes('all') && 
              !redeemCode.applicableTypes.includes('booking')) {
            throw new Error('此兌換碼不適用於預約場地');
          }

          // 檢查用戶是否可以使用
          const canUse = await redeemCode.canUserUse(bookingUserId);
          if (canUse) {
            // 計算兌換碼折扣 - 基於原價計算，不是基於已應用 VIP 折扣的價格
            let discountAmount = 0;
            const originalPrice = tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0);
            
            // 檢查最低消費金額
            if (originalPrice < redeemCode.minAmount) {
              throw new Error(`此兌換碼需要最低消費 HK$${redeemCode.minAmount}`);
            }
            
            if (redeemCode.type === 'fixed') {
              discountAmount = redeemCode.value;
            } else if (redeemCode.type === 'percentage') {
              discountAmount = Math.round(originalPrice * (redeemCode.value / 100));
              if (redeemCode.maxDiscount && discountAmount > redeemCode.maxDiscount) {
                discountAmount = redeemCode.maxDiscount;
              }
            }
            
            // 應用兌換碼折扣
            pointsToDeduct = Math.max(0, pointsToDeduct - discountAmount);
            redeemCodeData = {
              id: redeemCode._id,
              name: redeemCode.name,
              discountAmount: discountAmount,
              finalAmount: pointsToDeduct
            };
          }
        }
      } catch (error) {
        console.error('兌換碼處理錯誤:', error);
        // 兌換碼處理失敗不影響預約創建
      }
    }
    
    // 檢查用戶餘額（使用預約用戶的 ID，而不是當前登錄用戶）
    let userBalance = await UserBalance.findOne({ user: bookingUserId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: bookingUserId });
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
      const finalPointsToDeduct = isCustomPoints ? customPoints : pointsToDeduct;
      await userBalance.deductBalance(
        finalPointsToDeduct, 
        `場地預約 - ${courtDoc.name} ${bookingDate.toDateString()} ${startTime}-${endTime}${isCustomPoints ? ' (自訂積分)' : ''}`,
        null // 稍後會更新為實際的預約ID
      );
    }
    
    // 創建預約數據對象
    // 確保 ObjectId 類型正確（特別是在 bypass 模式下）
    const userObjectId = typeof bookingUserId === 'string' ? new mongoose.Types.ObjectId(bookingUserId) : bookingUserId;
    const courtObjectId = typeof court === 'string' ? new mongoose.Types.ObjectId(court) : court;
    
    const bookingData = {
      user: userObjectId,
      court: courtObjectId,
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
      // 添加兌換碼信息
      redeemCode: redeemCodeData ? redeemCodeData.id : undefined,
      redeemDiscount: redeemCodeData ? redeemCodeData.discountAmount : 0,
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
        totalPrice: isCustomPoints ? customPoints : pointsToDeduct, // 使用自訂積分或實際扣除的積分
        originalPrice: tempBooking.pricing.totalPrice, // 保存原價
        pointsDeducted: isCustomPoints ? customPoints : pointsToDeduct,
        vipDiscount: isVip ? Math.round((tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0)) * 0.2) : 0,
        soloCourtFee: includeSoloCourt ? 100 : 0, // 單人場費用
        customPoints: isCustomPoints ? customPoints : undefined, // 自訂積分
        isCustomPoints: isCustomPoints // 是否使用自訂積分
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
    
    // 記錄兌換碼使用
    if (redeemCodeData) {
      try {
        const RedeemUsage = require('../models/RedeemUsage');
        const RedeemCode = require('../models/RedeemCode');
        
        const redeemUsage = new RedeemUsage({
          redeemCode: redeemCodeData.id,
          user: bookingUserId,
          orderType: 'booking',
          orderId: booking._id,
          originalAmount: tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0),
          discountAmount: redeemCodeData.discountAmount,
          finalAmount: pointsToDeduct,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        await redeemUsage.save();
        
        // 更新兌換碼統計
        const redeemCode = await RedeemCode.findById(redeemCodeData.id);
        if (redeemCode) {
          redeemCode.totalUsed += 1;
          redeemCode.totalDiscount += redeemCodeData.discountAmount;
          await redeemCode.save();
        }
        
        console.log('✅ 兌換碼使用記錄已保存');
      } catch (error) {
        console.error('❌ 兌換碼使用記錄保存失敗:', error);
      }
    }
    
    // 調試：記錄保存的預約信息
    console.log('🔍 預約保存成功:', {
      bookingId: booking._id,
      includeSoloCourt: booking.includeSoloCourt,
      soloCourtFee: booking.pricing.soloCourtFee,
      totalPointsDeducted: booking.pricing.pointsDeducted,
      redeemCodeUsed: !!redeemCodeData
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
      // 確保 ObjectId 類型正確（特別是在 bypass 模式下）
      const soloUserObjectId = typeof bookingUserId === 'string' ? new mongoose.Types.ObjectId(bookingUserId) : bookingUserId;
      const soloCourtObjectId = typeof soloCourt._id === 'string' ? new mongoose.Types.ObjectId(soloCourt._id) : soloCourt._id;
      
      // 創建單人場預約對象來計算價格
      const tempSoloBooking = new Booking({
        user: soloUserObjectId,
        court: soloCourtObjectId,
        date: bookingDate,
        endDate: calculatedEndDate,
        startTime,
        endTime,
        duration,
        players: players,
        totalPlayers: totalPlayers,
        specialRequests: `單人場租用 - 與主場地同時段使用`,
        includeSoloCourt: false,
        bypassRestrictions,
        status: 'confirmed'
      });
      
      // 計算單人場價格
      tempSoloBooking.calculatePrice(soloCourt, isMember);
      
      const soloCourtBookingData = {
        user: soloUserObjectId,
        court: soloCourtObjectId,
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
          originalPrice: tempSoloBooking.pricing.totalPrice,
          discount: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.2) : 0
        },
        pricing: {
          basePrice: tempSoloBooking.pricing.basePrice,
          memberDiscount: tempSoloBooking.pricing.memberDiscount,
          totalPrice: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.8) : tempSoloBooking.pricing.totalPrice, // 應用 VIP 折扣
          originalPrice: tempSoloBooking.pricing.totalPrice, // 保存原價
          pointsDeducted: 0, // 費用已包含在主預約中
          vipDiscount: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.2) : 0,
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
    if (latestTransaction) {
      latestTransaction.relatedBooking = booking._id;
      await userBalance.save();
    }

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

    // 處理開門系統流程
    try {
      const visitorData = {
        name: booking.players[0]?.name || bookingUser.name,
        email: booking.players[0]?.email || bookingUser.email,
        phone: booking.players[0]?.phone || bookingUser.phone
      };

      const bookingData = {
        bookingId: booking._id.toString(),
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        courtName: courtDoc.name,
        courtNumber: courtDoc.number
      };

      const accessControlResult = await accessControlService.processAccessControl(visitorData, bookingData);
      console.log('✅ 開門系統流程處理完成');
      
      // 保存 tempAuth 數據到 Booking
      if (accessControlResult && accessControlResult.tempAuth) {
        booking.tempAuth = {
          code: accessControlResult.tempAuth.code || null,
          password: accessControlResult.tempAuth.password || null,
          startTime: accessControlResult.tempAuth.startTime || null,
          endTime: accessControlResult.tempAuth.endTime || null,
          createdAt: new Date()
        };
        await booking.save();
        console.log('✅ 臨時授權數據已保存到預約記錄');
      }
    } catch (accessControlError) {
      console.error('❌ 開門系統流程處理失敗:', accessControlError);
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

// @route   POST /api/bookings/:id/admin-notes
// @desc    添加預約管理員留言（管理員）
// @access  Private (Admin)
router.post('/:id/admin-notes', [
  auth,
  adminAuth,
  body('content').trim().notEmpty().withMessage('留言內容不能為空').isLength({ max: 1000 }).withMessage('留言內容不能超過1000個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    // 添加新留言
    booking.adminNotes.push({
      content: content.trim(),
      createdBy: req.user.id,
      createdAt: new Date()
    });

    await booking.save();

    // 填充創建者信息
    await booking.populate('adminNotes.createdBy', 'name email');

    res.json({
      message: '留言添加成功',
      booking
    });
  } catch (error) {
    console.error('添加預約留言錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/bookings/:id/admin-notes/:noteId
// @desc    更新或刪除特定留言（管理員，只能編輯/刪除自己的留言）
// @access  Private (Admin)
router.put('/:id/admin-notes/:noteId', [
  auth,
  adminAuth,
  body('content').optional().trim().isLength({ max: 1000 }).withMessage('留言內容不能超過1000個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { content } = req.body;
    const { id: bookingId, noteId } = req.params;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    const note = booking.adminNotes.id(noteId);
    if (!note) {
      return res.status(404).json({ message: '留言不存在' });
    }

    // 檢查是否是留言創建者（處理 createdBy 可能是 ObjectId 或 Object 的情況）
    const noteCreatedBy = note.createdBy.toString ? note.createdBy.toString() : note.createdBy;
    if (noteCreatedBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '只能編輯自己的留言' });
    }

    if (content !== undefined) {
      note.content = content.trim();
    }

    await booking.save();
    await booking.populate('adminNotes.createdBy', 'name email');

    res.json({
      message: '留言更新成功',
      booking
    });
  } catch (error) {
    console.error('更新留言錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/bookings/:id/admin-notes/:noteId
// @desc    刪除特定留言（管理員，只能刪除自己的留言）
// @access  Private (Admin)
router.delete('/:id/admin-notes/:noteId', [
  auth,
  adminAuth
], async (req, res) => {
  try {
    const { id: bookingId, noteId } = req.params;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    const note = booking.adminNotes.id(noteId);
    if (!note) {
      return res.status(404).json({ message: '留言不存在' });
    }

    // 檢查是否是留言創建者（處理 createdBy 可能是 ObjectId 或 Object 的情況）
    const noteCreatedBy = note.createdBy.toString ? note.createdBy.toString() : note.createdBy;
    if (noteCreatedBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '只能刪除自己的留言' });
    }

    note.deleteOne();
    await booking.save();
    await booking.populate('adminNotes.createdBy', 'name email');

    res.json({
      message: '留言刪除成功',
      booking
    });
  } catch (error) {
    console.error('刪除留言錯誤:', error);
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
      .populate('adminNotes.createdBy', 'name email')
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

// @route   PUT /api/bookings/:id/special-requests-processed
// @desc    更新特殊要求處理狀態（管理員）
// @access  Private (Admin)
router.put('/:id/special-requests-processed', [
  auth,
  adminAuth,
  body('specialRequestsProcessed').isBoolean().withMessage('特殊要求處理狀態必須是布林值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { specialRequestsProcessed } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { specialRequestsProcessed },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    res.json({
      message: '處理狀態更新成功',
      booking
    });
  } catch (error) {
    console.error('更新處理狀態錯誤:', error);
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
      .populate('user', 'name email phone')
      .populate('adminNotes.createdBy', 'name email');

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

    // 檢查是否可以取消（管理員可繞過時間限制）
    if (req.user.role !== 'admin' && !booking.canBeCancelled()) {
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

    // 檢查是否為包場預約，如果是包場則不自動退款
    const isFullVenueBooking = booking.notes?.includes('包場預約') || booking.notes?.includes('🏢 包場預約');
    
    // 如為積分支付或管理員建立且已扣分，則退回積分（包場預約除外）
    try {
      const pointsToRefund = Number(
        booking.pricing?.pointsDeducted ??
        booking.payment?.pointsDeducted ??
        Math.round(booking.pricing?.totalPrice ?? 0)
      );
      const paidByPoints = booking.payment?.method === 'points' || booking.payment?.method === 'admin_created';
      const notRefundedYet = booking.payment?.status !== 'refunded';
      
      if (paidByPoints && notRefundedYet && pointsToRefund > 0) {
        if (isFullVenueBooking) {
          // 包場預約不自動退款，需要管理員手動處理
          console.log(`🏢 包場預約取消 - 不自動退款，需要管理員手動處理: ${booking._id}`);
          booking.payment.status = 'pending_refund'; // 標記為待退款
          booking.payment.requiresManualRefund = true; // 需要手動退款
        } else {
          // 普通預約自動退款
          let userBalance = await UserBalance.findOne({ user: booking.user });
          if (!userBalance) {
            userBalance = new UserBalance({ user: booking.user, balance: 0, totalRecharged: 0, totalSpent: 0, transactions: [] });
          }
          await userBalance.refund(pointsToRefund, `預約取消退款 - ${booking.court?.name || ''} ${booking.startTime}-${booking.endTime}`, booking._id);
          booking.payment.status = 'refunded';
          booking.payment.refundedAt = new Date();
        }
      }
    } catch (refundError) {
      console.error('退款處理失敗（不影響取消）:', refundError);
    }

    // 使用關閉驗證的保存方式，避免舊資料因缺欄位而無法更新
    await booking.save({ validateBeforeSave: false });

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

// @route   POST /api/bookings/:id/resend-access-email
// @desc    重發預約開門通知郵件
// @access  Private (Admin only)
router.post('/:id/resend-access-email', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找預約記錄
    const booking = await Booking.findById(id)
      .populate('user', 'name email phone')
      .populate('court', 'name number type');
    
    if (!booking) {
      return res.status(404).json({ message: '預約記錄不存在' });
    }
    
    // 準備訪問者數據
    const visitorData = {
      name: booking.players[0]?.name || booking.user.name,
      email: booking.players[0]?.email || booking.user.email,
      phone: booking.players[0]?.phone || booking.user.phone
    };
    
    // 準備預約數據
    const bookingData = {
      bookingId: booking._id.toString(),
      date: booking.date,
      endDate: booking.endDate || null, // 傳入 endDate 用於判斷跨天
      startTime: booking.startTime,
      endTime: booking.endTime,
      courtName: booking.court.name,
      courtNumber: booking.court.number
    };
    
    let qrCodeData = null;
    let password = null;
    let tempAuthCreated = false;
    
    // 檢查是否有 tempAuth 數據
    if (!booking.tempAuth || !booking.tempAuth.code) {
      // 如果沒有 tempAuth，重新創建
      console.log('⚠️ 預約記錄沒有 tempAuth 數據，正在重新創建...');
      
      try {
        // 調用 API 創建臨時授權
        const tempAuth = await accessControlService.createTempAuth(visitorData, bookingData);
        
        if (tempAuth && tempAuth.code) {
          // 處理二維碼數據
          qrCodeData = tempAuth.code;
          password = tempAuth.password;
          
          // 計算開始和結束時間（ISO 格式）
          // 傳入 endDate 和 earlyStartTime 用於判斷 endTime 是否為跨天
          const earlyStartTime = accessControlService.subtractMinutes(bookingData.startTime, 15);
          const startTimeISO = accessControlService.convertToISOString(bookingData.date, earlyStartTime);
          const endTimeISO = accessControlService.convertToISOString(
            bookingData.date, 
            bookingData.endTime, 
            bookingData.endDate || null, 
            earlyStartTime
          );
          
          // 保存新創建的 tempAuth 數據到 Booking
          booking.tempAuth = {
            code: tempAuth.code || null,
            password: tempAuth.password || null,
            startTime: startTimeISO || null,
            endTime: endTimeISO || null,
            createdAt: new Date()
          };
          await booking.save();
          console.log('✅ 臨時授權數據已重新創建並保存到預約記錄');
          
          tempAuthCreated = true;
        } else {
          throw new Error('創建臨時授權失敗：未返回有效數據');
        }
      } catch (createError) {
        console.error('❌ 重新創建 tempAuth 失敗:', createError);
        return res.status(500).json({ 
          message: '重新創建臨時授權失敗，無法發送郵件',
          error: createError.message 
        });
      }
    } else {
      // 使用已保存的 tempAuth 數據
      qrCodeData = booking.tempAuth.code;
      password = booking.tempAuth.password;
    }
    
    // 發送郵件
    await accessControlService.sendAccessEmail(visitorData, bookingData, qrCodeData, password);
    
    const message = tempAuthCreated 
      ? '臨時授權已重新創建，開門通知郵件已發送'
      : '開門通知郵件已重新發送';
    
    res.json({ 
      message: message,
      email: visitorData.email,
      tempAuthCreated: tempAuthCreated
    });
    
  } catch (error) {
    console.error('重發開門通知郵件錯誤:', error);
    res.status(500).json({ 
      message: '重發郵件失敗，請稍後再試',
      error: error.message 
    });
  }
});

module.exports = router;
