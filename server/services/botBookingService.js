const Booking = require('../models/Booking');
const Court = require('../models/Court');
const UserBalance = require('../models/UserBalance');
const Store = require('../models/Store');
const Config = require('../models/Config');
const whatsappService = require('../services/whatsappService');
const {
  sendBookingNotification,
  applyTempAuthToBooking,
  sendWhatsAppBookingConfirmationStub,
} = require('../services/bookingNotificationService');
const { consumeRedeemCodeOnce } = require('../services/redeemUsageService');
const { assertRedeemCodePricingSlotAllowed } = require('../utils/redeemBookingContext');
const { scheduleTuyaCourtsSync } = require('../services/tuyaSchedulerService');
const { normalizeHkPhone } = require('../utils/phoneUtils');
const { findUserByPhone } = require('./botUserService');
const { calculateDuration } = require('./botAvailabilityService');

function normalizeDateTime(date, time) {
  const normalizedDate = new Date(date);
  if (time === '24:00') {
    normalizedDate.setDate(normalizedDate.getDate() + 1);
    return { date: normalizedDate, time: '00:00' };
  }
  return { date: normalizedDate, time };
}

function buildContactPlayer(user) {
  return [
    {
      name: user.name,
      email: user.email,
      phone: normalizeHkPhone(user.phone) || user.phone,
    },
  ];
}

/**
 * Bot 簡化預約（邏輯與 POST /api/bookings 一般用戶流程一致）
 * players 只存一位聯絡人（帳戶資料），與前台 BookingSummary 相同；人數用 totalPlayers。
 */
async function createBookingViaBot(params) {
  const {
    phone,
    court: courtId,
    date,
    startTime: startTimeRaw,
    endTime: endTimeRaw,
    totalPlayers: totalPlayersInput,
    specialRequests = '',
    includeSoloCourt = false,
    redeemCodeId,
    ipAddress,
    userAgent,
  } = params;

  const user = await findUserByPhone(phone);
  if (!user) {
    const err = new Error('找不到此電話號碼的用戶');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const players = buildContactPlayer(user);

  const totalPlayers = totalPlayersInput != null ? Number(totalPlayersInput) : 1;
  if (!Number.isFinite(totalPlayers) || totalPlayers < 1 || totalPlayers > 8) {
    const err = new Error('totalPlayers 必須是 1-8');
    err.code = 'INVALID_TOTAL_PLAYERS';
    throw err;
  }

  if (specialRequests && String(specialRequests).length > 500) {
    const err = new Error('特殊要求不能超過 500 個字符');
    err.code = 'INVALID_SPECIAL_REQUESTS';
    throw err;
  }

  let startTime = startTimeRaw;
  let endTime = endTimeRaw;

  const normalizedEndTime = normalizeDateTime(date, endTime);
  endTime = normalizedEndTime.time;

  const courtDoc = await Court.findById(courtId);
  if (!courtDoc) {
    const err = new Error('場地不存在');
    err.code = 'COURT_NOT_FOUND';
    throw err;
  }

  if (!courtDoc.isAvailable()) {
    const err = new Error('場地目前不可用');
    err.code = 'COURT_UNAVAILABLE';
    throw err;
  }

  const bookingDate = new Date(date);

  if (!courtDoc.isOpenAt(bookingDate, startTime, endTime)) {
    const err = new Error('場地在該時間段不開放');
    err.code = 'COURT_CLOSED';
    throw err;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDateOnly = new Date(bookingDate);
  bookingDateOnly.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((bookingDateOnly - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const err = new Error('不可預約過去的日期');
    err.code = 'PAST_DATE';
    throw err;
  }

  const bookingConfig = await Config.getBookingConfig();
  const maxDays = bookingConfig.maxAdvanceDaysByRole[user.role] ?? 7;
  if (diffDays > maxDays) {
    const err = new Error(`您的身份最多可預約 ${maxDays} 天內的場地`);
    err.code = 'DATE_TOO_FAR';
    throw err;
  }

  const hasConflict = await Booking.checkTimeConflict(courtId, date, startTime, endTime);
  if (hasConflict) {
    const err = new Error('該時間段已被預約');
    err.code = 'TIME_CONFLICT';
    throw err;
  }

  const duration = calculateDuration(startTime, endTime);
  if (duration < 60) {
    const err = new Error('預約時長至少 1 小時');
    err.code = 'DURATION_TOO_SHORT';
    throw err;
  }
  if (duration > 120) {
    const err = new Error('預約時長最多 2 小時');
    err.code = 'DURATION_TOO_LONG';
    throw err;
  }

  const startMinutes = parseInt(startTime.split(':')[0], 10) * 60 + parseInt(startTime.split(':')[1], 10);
  let endMinutes = parseInt(endTime.split(':')[0], 10) * 60 + parseInt(endTime.split(':')[1], 10);
  if (endTime === '24:00') endMinutes = 24 * 60;
  const isOvernight = endMinutes <= startMinutes;

  const calculatedEndDate = new Date(bookingDate);
  if (isOvernight) {
    calculatedEndDate.setDate(calculatedEndDate.getDate() + 1);
  }

  const bookingUser = user;
  const isMember = bookingUser.membershipLevel !== 'basic';
  const isVip = bookingUser.membershipLevel === 'vip';

  const tempBooking = new Booking({
    user: user._id,
    court: courtId,
    date: bookingDate,
    endDate: calculatedEndDate,
    startTime,
    endTime,
    duration,
    players,
    totalPlayers,
    specialRequests,
  });
  tempBooking.calculatePrice(courtDoc, isMember);

  let pointsToDeduct = Math.round(tempBooking.pricing.totalPrice);
  if (includeSoloCourt) pointsToDeduct += 100;
  if (isVip) pointsToDeduct = Math.round(pointsToDeduct * 0.8);

  let redeemCodeData = null;
  if (redeemCodeId) {
    const RedeemCode = require('../models/RedeemCode');
    const redeemCode = await RedeemCode.findById(redeemCodeId);
    if (redeemCode && redeemCode.isValid()) {
      if (!redeemCode.applicableTypes.includes('all') && !redeemCode.applicableTypes.includes('booking')) {
        const err = new Error('此兌換碼不適用於預約場地');
        err.code = 'INVALID_REDEEM_CODE';
        throw err;
      }

      await assertRedeemCodePricingSlotAllowed(redeemCode, {
        orderType: 'booking',
        courtId: courtDoc._id,
        date: bookingDate,
        startTime,
      });

      const canUse = await redeemCode.canUserUse(user._id);
      if (canUse) {
        let discountAmount = 0;
        const originalPrice = tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0);

        if (originalPrice < redeemCode.minAmount) {
          const err = new Error(`此兌換碼需要最低消費 HK$${redeemCode.minAmount}`);
          err.code = 'INVALID_REDEEM_CODE';
          throw err;
        }

        if (redeemCode.type === 'fixed') {
          discountAmount = redeemCode.value;
        } else if (redeemCode.type === 'percentage') {
          discountAmount = Math.round(originalPrice * (redeemCode.value / 100));
          if (redeemCode.maxDiscount && discountAmount > redeemCode.maxDiscount) {
            discountAmount = redeemCode.maxDiscount;
          }
        }

        pointsToDeduct = Math.max(0, pointsToDeduct - discountAmount);
        redeemCodeData = {
          id: redeemCode._id,
          name: redeemCode.name,
          discountAmount,
          finalAmount: pointsToDeduct,
        };
      }
    }
  }

  let userBalance = await UserBalance.findOne({ user: user._id });
  if (!userBalance) {
    userBalance = new UserBalance({ user: user._id });
  }

  if (userBalance.balance < pointsToDeduct) {
    const err = new Error('積分餘額不足');
    err.code = 'INSUFFICIENT_BALANCE';
    err.details = {
      required: pointsToDeduct,
      available: userBalance.balance,
      discount: isVip ? 'VIP會員8折' : '無折扣',
    };
    throw err;
  }

  await userBalance.deductBalance(
    pointsToDeduct,
    `場地預約 - ${courtDoc.name} ${bookingDate.toDateString()} ${startTime}-${endTime}`,
    null
  );

  const bookingData = {
    user: user._id,
    store: courtDoc.store,
    court: courtDoc._id,
    date: bookingDate,
    endDate: calculatedEndDate,
    startTime,
    endTime,
    duration,
    players,
    totalPlayers,
    specialRequests,
    includeSoloCourt,
    bypassRestrictions: false,
    noUserBalanceDebited: false,
    status: 'confirmed',
    redeemCode: redeemCodeData ? redeemCodeData.id : undefined,
    redeemDiscount: redeemCodeData ? redeemCodeData.discountAmount : 0,
    payment: {
      status: 'paid',
      paidAt: new Date(),
      method: 'points',
      pointsDeducted: pointsToDeduct,
      originalPrice: tempBooking.pricing.totalPrice,
      discount: isVip ? 20 : 0,
    },
    pricing: {
      basePrice: tempBooking.pricing.basePrice,
      memberDiscount: tempBooking.pricing.memberDiscount,
      totalPrice: pointsToDeduct,
      originalPrice: tempBooking.pricing.totalPrice,
      pointsDeducted: pointsToDeduct,
      vipDiscount: isVip ? Math.round((tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0)) * 0.2) : 0,
      soloCourtFee: includeSoloCourt ? 100 : 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const booking = new Booking(bookingData);
  await booking.save();

  if (redeemCodeData) {
    try {
      await consumeRedeemCodeOnce({
        redeemCodeId: redeemCodeData.id,
        userId: user._id,
        orderType: 'booking',
        orderId: booking._id,
        originalAmount: tempBooking.pricing.totalPrice + (includeSoloCourt ? 100 : 0),
        discountAmount: redeemCodeData.discountAmount,
        finalAmount: pointsToDeduct,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('❌ Bot 預約兌換碼記錄失敗:', error);
    }
  }

  let soloCourtBooking = null;
  if (includeSoloCourt) {
    const soloCourt = await Court.findOne({ type: 'solo', store: courtDoc.store, isActive: true });
    if (!soloCourt) {
      const err = new Error('找不到單人場');
      err.code = 'SOLO_COURT_NOT_FOUND';
      throw err;
    }

    const soloConflict = await Booking.checkTimeConflict(soloCourt._id, date, startTime, endTime);
    if (soloConflict) {
      const err = new Error('單人場在該時間段已被預約');
      err.code = 'SOLO_TIME_CONFLICT';
      throw err;
    }

    const tempSoloBooking = new Booking({
      user: user._id,
      court: soloCourt._id,
      date: bookingDate,
      endDate: calculatedEndDate,
      startTime,
      endTime,
      duration,
      players,
      totalPlayers,
    });
    tempSoloBooking.calculatePrice(soloCourt, isMember);

    soloCourtBooking = new Booking({
      user: user._id,
      store: courtDoc.store,
      court: soloCourt._id,
      date: bookingDate,
      endDate: calculatedEndDate,
      startTime,
      endTime,
      duration,
      players,
      totalPlayers,
      specialRequests: '單人場租用 - 與主場地同時段使用',
      includeSoloCourt: false,
      bypassRestrictions: false,
      noUserBalanceDebited: false,
      status: 'confirmed',
      payment: {
        status: 'paid',
        method: 'points',
        paidAt: new Date(),
        pointsDeducted: 0,
        originalPrice: tempSoloBooking.pricing.totalPrice,
        discount: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.2) : 0,
      },
      pricing: {
        basePrice: tempSoloBooking.pricing.basePrice,
        memberDiscount: tempSoloBooking.pricing.memberDiscount,
        totalPrice: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.8) : tempSoloBooking.pricing.totalPrice,
        originalPrice: tempSoloBooking.pricing.totalPrice,
        pointsDeducted: 0,
        vipDiscount: isVip ? Math.round(tempSoloBooking.pricing.totalPrice * 0.2) : 0,
        soloCourtFee: 0,
      },
    });
    await soloCourtBooking.save();
  }

  const latestTransaction = userBalance.transactions[userBalance.transactions.length - 1];
  if (latestTransaction) {
    latestTransaction.relatedBooking = booking._id;
    await userBalance.save();
  }

  await booking.populate('court', 'name number type amenities store');
  if (soloCourtBooking) {
    await soloCourtBooking.populate('court', 'name number type amenities');
  }

  const storeDoc = await Store.findById(courtDoc.store).lean();

  try {
    const phoneNumber = booking.players[0]?.phone || user.phone;
    if (phoneNumber && whatsappService.isValidPhoneNumber(phoneNumber)) {
      await whatsappService.sendBookingConfirmation(booking, phoneNumber);
    }
  } catch (whatsappError) {
    console.error('❌ Bot 預約 WhatsApp 通知失敗:', whatsappError);
  }

  try {
    const notifyResult = await sendBookingNotification({
      booking,
      courtDoc,
      store: storeDoc,
      userFallback: bookingUser,
    });
    if (notifyResult.mode === 'hik' && notifyResult.accessControlResult) {
      await applyTempAuthToBooking(booking, notifyResult.accessControlResult);
    }
    await sendWhatsAppBookingConfirmationStub(booking, storeDoc);
  } catch (notifyError) {
    console.error('❌ Bot 預約通知發送失敗:', notifyError);
  }

  const tuyaCourtIds = [booking.court._id || booking.court];
  if (soloCourtBooking?.court) tuyaCourtIds.push(soloCourtBooking.court._id || soloCourtBooking.court);
  scheduleTuyaCourtsSync(tuyaCourtIds, 'booking_created');

  return {
    message: soloCourtBooking ? '預約創建成功（包含單人場）' : '預約創建成功',
    booking,
    soloCourtBooking,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      membershipLevel: user.membershipLevel,
    },
    pointsDeducted: pointsToDeduct,
    remainingBalance: userBalance.balance,
    discount: isVip ? 'VIP會員8折' : '無折扣',
    redeemCode: redeemCodeData,
  };
}

module.exports = {
  createBookingViaBot,
  buildContactPlayer,
};
