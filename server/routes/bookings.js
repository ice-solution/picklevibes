const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const { auth, adminAuth } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const {
  sendBookingNotification,
  applyTempAuthToBooking,
  sendWhatsAppBookingConfirmationStub,
  resendBookingNotification,
} = require('../services/bookingNotificationService');
const Store = require('../models/Store');
const Config = require('../models/Config');
const { collectBundledBookingIds } = require('../utils/bookingBundle');
const { consumeRedeemCodeOnce } = require('../services/redeemUsageService');

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
    /**
     * 後台建單且未勾選「管理員權限」時：僅放寬「可預約天數上限」與「營業時段 isOpenAt」，
     * 其餘與一般用戶相同（含場地啟用、1～2 小時時長）；照常扣積分。
     * 勾選管理員權限時：仍會檢查時段衝突（不可與現有預約重疊），其餘可繞過（不扣分等）。
     */
    const adminRelaxRules = req.user.role === 'admin' && !bypassRestrictions;

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

    // 僅「管理員權限」繞過時不檢查 isAvailable；未勾選時與一般用戶相同
    if (!bypassRestrictions && !courtDoc.isAvailable()) {
      return res.status(400).json({ message: '場地目前不可用' });
    }

    const bookingDate = new Date(date);

    // 未勾選管理員權限之後台建單：可超出營業時段；勾選則一併略過
    if (!bypassRestrictions && !adminRelaxRules && !courtDoc.isOpenAt(bookingDate, startTime, endTime)) {
      return res.status(400).json({ message: '場地在該時間段不開放' });
    }

    // 過去日期：除完全繞過外一律禁止；可預約天數上限：僅一般用戶與非放寬後台建單需遵守
    if (!bypassRestrictions) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const bookingDateOnly = new Date(bookingDate);
      bookingDateOnly.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((bookingDateOnly - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        return res.status(400).json({ message: '不可預約過去的日期' });
      }
      if (!adminRelaxRules) {
        const bookingUserDoc = await User.findById(bookingUserId).select('role');
        const role = bookingUserDoc?.role || 'user';
        const bookingConfig = await Config.getBookingConfig();
        const maxDays = bookingConfig.maxAdvanceDaysByRole[role] ?? 7;
        if (diffDays > maxDays) {
          return res.status(400).json({
            message: `您的身份最多可預約 ${maxDays} 天內的場地，請選擇較近的日期`
          });
        }
      }
    }

    // 無論是否管理員繞過（bypassRestrictions），皆須檢查時段是否已被占用，避免重疊預約
    const hasConflict = await Booking.checkTimeConflict(court, date, startTime, endTime);
    if (hasConflict) {
      return res.status(400).json({ message: '該時間段已被預約' });
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

    // 僅「管理員權限」繞過時不限制時長；未勾選時仍須 1～2 小時
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
      store: courtDoc.store,
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
      noUserBalanceDebited: !!bypassRestrictions, // 繞過限制建單時未扣用戶積分，取消時不可退分
      status: 'confirmed', // 直接確認
      // 添加兌換碼信息
      redeemCode: redeemCodeData ? redeemCodeData.id : undefined,
      redeemDiscount: redeemCodeData ? redeemCodeData.discountAmount : 0,
      payment: {
        status: 'paid',
        paidAt: new Date(),
        // 管理員繞過限制：未扣積分，標記 admin_waived 並記 pointsDeducted=0，避免取消時誤退
        method: bypassRestrictions ? 'admin_waived' : 'points',
        pointsDeducted: bypassRestrictions ? 0 : pointsToDeduct,
        originalPrice: tempBooking.pricing.totalPrice,
        discount: isVip ? 20 : 0 // VIP折扣百分比
      },
      pricing: {
        basePrice: tempBooking.pricing.basePrice,
        memberDiscount: tempBooking.pricing.memberDiscount,
        // 仍保存「參考應付」金額供列表顯示；實際扣款以 pointsDeducted / noUserBalanceDebited 為準
        totalPrice: isCustomPoints ? customPoints : pointsToDeduct,
        originalPrice: tempBooking.pricing.totalPrice, // 保存原價
        pointsDeducted: bypassRestrictions ? 0 : (isCustomPoints ? customPoints : pointsToDeduct),
        vipDiscount: isVip ? Math.round((tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0)) * 0.2) : 0,
        soloCourtFee: includeSoloCourt ? 100 : 0, // 單人場費用
        customPoints: isCustomPoints ? customPoints : undefined, // 自訂積分
        isCustomPoints: isCustomPoints // 是否使用自訂積分
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let booking;

    if (bypassRestrictions) {
      const result = await Booking.collection.insertOne(bookingData);
      booking = await Booking.findById(result.insertedId);
    } else {
      booking = new Booking(bookingData);
      await booking.save();
    }
    
    // 記錄兌換碼使用
    if (redeemCodeData) {
      try {
        await consumeRedeemCodeOnce({
          redeemCodeId: redeemCodeData.id,
          userId: bookingUserId,
          orderType: 'booking',
          orderId: booking._id,
          originalAmount: tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0),
          discountAmount: redeemCodeData.discountAmount,
          finalAmount: pointsToDeduct,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

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
      const soloCourt = await Court.findOne({ type: 'solo', store: courtDoc.store, isActive: true });
      if (!soloCourt) {
        console.error('❌ 找不到單人場');
        return res.status(500).json({ message: '找不到單人場' });
      }

      const soloConflict = await Booking.checkTimeConflict(soloCourt._id, date, startTime, endTime);
      if (soloConflict) {
        return res.status(400).json({ message: '單人場在該時間段已被預約' });
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
        store: courtDoc.store,
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
        noUserBalanceDebited: !!bypassRestrictions, // 與主預約一致：繞過時未扣款
        status: 'confirmed',
        payment: {
          status: 'paid',
          method: bypassRestrictions ? 'admin_waived' : 'points',
          paidAt: new Date(),
          pointsDeducted: 0, // 單人場費用已包含在主預約中（或主預約為免扣款）
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

      if (bypassRestrictions) {
        const soloResult = await Booking.collection.insertOne(soloCourtBookingData);
        soloCourtBooking = await Booking.findById(soloResult.insertedId);
      } else {
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
    
    // 更新用戶餘額記錄中的預約ID（僅在有實際扣款時，避免誤掛到無關交易）
    if (!bypassRestrictions) {
      const latestTransaction = userBalance.transactions[userBalance.transactions.length - 1];
      if (latestTransaction) {
        latestTransaction.relatedBooking = booking._id;
        await userBalance.save();
      }
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

    const storeDoc = await Store.findById(courtDoc.store).lean();

    try {
      const notifyResult = await sendBookingNotification({
        booking,
        courtDoc,
        store: storeDoc,
        userFallback: bookingUser,
      });
      if (notifyResult.mode === 'hik' && notifyResult.accessControlResult) {
        await applyTempAuthToBooking(booking, notifyResult.accessControlResult);
        console.log('✅ 門禁／開門郵件流程完成');
      } else {
        console.log('✅ 預約確認郵件已發送（無門禁）');
      }
      await sendWhatsAppBookingConfirmationStub(booking, storeDoc);
    } catch (notifyError) {
      console.error('❌ 預約通知發送失敗:', notifyError);
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
      dateFrom,
      dateTo,
      page = 1, 
      limit = 20,
      sort: sortParam
    } = req.query;
    
    let query = {};
    
    if (status) query.status = status;
    if (court) query.court = court;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (dateFrom && dateTo) {
      const df = new Date(dateFrom);
      const dt = new Date(dateTo);
      query.$or = [
        { date: { $gte: df, $lte: dt } },
        { endDate: { $gte: df, $lte: dt } },
        { $and: [{ date: { $lte: dt } }, { endDate: { $gte: df } }] }
      ];
    }

    const sortDir = sortParam === 'asc' ? 1 : -1;
    const limitNum = Math.min(10000, Math.max(1, parseInt(limit, 10) || 20));

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('court', 'name number type')
      .populate('adminNotes.createdBy', 'name email')
      .sort({ date: sortDir, startTime: sortDir })
      .limit(limitNum)
      .skip((page - 1) * limitNum);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limitNum),
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

    const bundledIds = await collectBundledBookingIds(booking);
    const bundleBookings =
      bundledIds.length > 1
        ? await Booking.find({ _id: { $in: bundledIds } })
        : [booking];

    if (req.user.role !== 'admin') {
      const foreign = bundleBookings.find((b) => b.user.toString() !== req.user.id);
      if (foreign) {
        return res.status(403).json({ message: '無權限取消此預約' });
      }
    }

    // 檢查是否可以取消（管理員可繞過時間限制）；包場／活動佔用須整組可取消
    if (req.user.role !== 'admin') {
      const cannot = bundleBookings.find((b) => !b.canBeCancelled());
      if (cannot) {
        return res.status(400).json({
          message: '預約無法取消，請至少提前2小時取消或聯繫客服'
        });
      }
    }

    const cancellation = {
      cancelledAt: new Date(),
      cancelledBy: booking.user.toString() === req.user.id ? 'user' : 'admin',
      reason
    };

    // 更新預約狀態（先寫入主預約，退款邏輯僅針對 URL 上這一筆）
    booking.status = 'cancelled';
    booking.cancellation = cancellation;

    // 檢查是否為包場預約，如果是包場則不自動退款
    const isFullVenueBooking =
      booking.venueBundleKind === 'full_venue' ||
      booking.specialRequests?.includes('包場預約') ||
      booking.specialRequests?.includes('🏢 包場預約');

    // 建立時未從預約用戶扣積分（管理員繞過限制手動建單、活動佔場等）→ 取消時不可自動退回積分
    const skipAutoPointsRefund =
      booking.noUserBalanceDebited === true ||
      booking.bypassRestrictions === true ||
      booking.payment?.method === 'admin_waived';

    // 如為積分支付且實際有扣款，則退回積分（包場預約除外；免扣款建單除外）
    try {
      if (skipAutoPointsRefund) {
        console.log(
          `📌 預約 ${booking._id} 建立時未扣用戶積分 (noUserBalanceDebited/bypass/admin_waived)，取消時跳過積分退回`
        );
      } else {
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
      }
    } catch (refundError) {
      console.error('退款處理失敗（不影響取消）:', refundError);
    }

    // 使用關閉驗證的保存方式，避免舊資料因缺欄位而無法更新
    await booking.save({ validateBeforeSave: false });

    // 包場／活動佔用：同組其他場地一併取消（不重複退款）
    const otherIds = bundledIds.filter((oid) => !oid.equals(booking._id));
    if (otherIds.length > 0) {
      await Booking.updateMany(
        { _id: { $in: otherIds } },
        {
          $set: {
            status: 'cancelled',
            cancellation
          }
        }
      );
    }

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
      message:
        bundledIds.length > 1
          ? `已取消 ${bundledIds.length} 筆關聯場地預約（包場／活動佔用）`
          : '預約取消成功',
      cancelledCount: bundledIds.length,
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

    const booking = await Booking.findById(id)
      .populate('user', 'name email phone')
      .populate('court', 'name number type store');

    if (!booking) {
      return res.status(404).json({ message: '預約記錄不存在' });
    }

    const result = await resendBookingNotification(booking);
    const visitorEmail = booking.players[0]?.email || booking.user?.email;

    res.json({
      message: result.message,
      email: visitorEmail,
      tempAuthCreated: result.tempAuthCreated,
      mode: result.mode,
    });
  } catch (error) {
    console.error('重發預約通知郵件錯誤:', error);
    res.status(500).json({
      message: '重發郵件失敗，請稍後再試',
      error: error.message,
    });
  }
});

module.exports = router;
