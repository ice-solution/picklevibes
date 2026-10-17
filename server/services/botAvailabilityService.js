const Court = require('../models/Court');
const Booking = require('../models/Booking');
const Store = require('../models/Store');
const { findUserByPhone } = require('./botUserService');
const {
  hasBookingVipDiscount,
  applyBookingVipDiscount,
  applyBookingVipRateOnly,
  getVipBookingExtraFlatOff,
  bookingVipDiscountLabel,
} = require('../utils/memberBenefits');

function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startTotalMin = startHour * 60 + startMin;
  let endTotalMin = endHour * 60 + endMin;

  if (endTotalMin <= startTotalMin) {
    endTotalMin += 24 * 60;
  }

  return endTotalMin - startTotalMin;
}

function siteBaseUrl() {
  const raw = String(
    process.env.PUBLIC_SITE_URL || process.env.PICKLEVIBES_REGISTER_URL || ''
  ).trim();
  if (raw) return raw.replace(/\/$/, '').replace(/\/register$/i, '');
  const client = String(process.env.CLIENT_URL || '').trim().replace(/\/$/, '');
  if (client && !/localhost|127\.0\.0\.1/i.test(client)) return client;
  return 'https://picklevibes.hk';
}

function buildPricingForUser(listTotal, durationMinutes, user) {
  const listPrice = Math.round(Number(listTotal) || 0);
  const memberMatched = Boolean(user);
  const hasVip = hasBookingVipDiscount(user);

  if (!memberMatched || !hasVip) {
    return {
      listPrice,
      finalCost: listPrice,
      /** 兼容舊 Bot／LLM：報價用最終應付 */
      totalPrice: listPrice,
      vipRatePrice: null,
      extraOff: 0,
      vipDiscount: 0,
      memberMatched,
      hasMemberDiscount: false,
      membershipLevel: user?.membershipLevel || null,
      discountLabel: memberMatched ? '無會員場租折扣（正價）' : null,
    };
  }

  const vipRatePrice = applyBookingVipRateOnly(listPrice, user);
  const extraOff = getVipBookingExtraFlatOff(user, new Date(), durationMinutes);
  const finalCost = applyBookingVipDiscount(listPrice, user, new Date(), durationMinutes);

  return {
    listPrice,
    finalCost,
    totalPrice: finalCost,
    vipRatePrice,
    extraOff,
    vipDiscount: Math.max(0, listPrice - finalCost),
    memberMatched: true,
    hasMemberDiscount: true,
    membershipLevel: user.membershipLevel || null,
    discountLabel: bookingVipDiscountLabel(user, durationMinutes),
  };
}

async function checkCourtSlotAvailability(court, date, startTime, endTime, user = null) {
  if (!court.isAvailable()) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '場地正在維護中',
    };
  }

  const bookingDate = new Date(date);
  if (!court.isOpenAt(bookingDate, startTime, endTime)) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '場地在該時間段不開放',
    };
  }

  const hasConflict = await Booking.checkTimeConflict(court._id, date, startTime, endTime);
  if (hasConflict) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '該時間段已被預約',
    };
  }

  const duration = calculateDuration(startTime, endTime);
  const basePrice = court.getPriceForTime(startTime, bookingDate);
  const listTotal = Math.round(basePrice * (duration / 60));
  const slotName = court.getTimeSlotName(startTime, bookingDate);
  const hour = parseInt(startTime.split(':')[0], 10);
  const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
  const isPeakHour = isWeekend || (hour >= 18 && hour < 23);
  const memberPricing = buildPricingForUser(listTotal, duration, user);

  return {
    courtId: court._id,
    courtName: court.name,
    courtNumber: court.number,
    courtType: court.type,
    available: true,
    pricing: {
      basePrice,
      duration,
      isPeakHour,
      slotName,
      ...memberPricing,
    },
  };
}

/**
 * 查詢指定店鋪、日期、時段內所有場地空缺。
 * 可選 phone：對應 WhatsApp 會員後回傳同網站嘅 finalCost（VIP／周年減價）。
 */
async function searchAvailability({ storeId, date, startTime, endTime, courtType, phone } = {}) {
  const store = await Store.findById(storeId).select('name slug isActive');
  if (!store) {
    const err = new Error('店鋪不存在');
    err.code = 'STORE_NOT_FOUND';
    throw err;
  }
  if (store.isActive === false) {
    const err = new Error('店鋪已停用');
    err.code = 'STORE_INACTIVE';
    throw err;
  }

  const query = { store: storeId, isActive: true };
  if (courtType) {
    query.type = courtType;
  }

  const courts = await Court.find(query)
    .populate('store', 'name slug')
    .sort({ number: 1 });

  let user = null;
  if (phone) {
    user = await findUserByPhone(phone);
  }

  const results = await Promise.all(
    courts.map((court) => checkCourtSlotAvailability(court, date, startTime, endTime, user))
  );

  const availableCourts = results.filter((r) => r.available);
  const unavailableCourts = results.filter((r) => !r.available);

  const base = siteBaseUrl();
  const registerUrl = `${base}/register`;
  const courtsUrl = `${base}/courts`;
  const memberMatched = Boolean(user);
  const hasMemberDiscount = hasBookingVipDiscount(user);

  let pricingNote;
  if (!phone) {
    pricingNote = '未提供電話，以下為正價（牌價）。';
  } else if (!memberMatched) {
    pricingNote = `搵唔到呢個 WhatsApp 電話嘅會員帳戶，以下為正價。登記做會員可享場租 8 折：${registerUrl}。亦可上網站查價／訂場：${courtsUrl}`;
  } else if (hasMemberDiscount) {
    pricingNote = `已對應會員（${bookingVipDiscountLabel(user, calculateDuration(startTime, endTime))}）。finalCost／totalPrice 為實際應付積分，同網站一致。`;
  } else {
    pricingNote = `已對應會員，但目前無場租折扣，以下為正價。詳情可上網站：${courtsUrl}`;
  }

  return {
    store: {
      id: store._id,
      name: store.name,
      slug: store.slug,
    },
    date,
    startTime,
    endTime,
    duration: calculateDuration(startTime, endTime),
    member: memberMatched
      ? {
          matched: true,
          name: user.name,
          membershipLevel: user.membershipLevel,
          hasMemberDiscount,
          discountLabel: hasMemberDiscount
            ? bookingVipDiscountLabel(user, calculateDuration(startTime, endTime))
            : null,
        }
      : {
          matched: false,
          phoneProvided: Boolean(phone),
        },
    pricingNote,
    registerUrl,
    courtsUrl,
    summary: {
      total: results.length,
      available: availableCourts.length,
      unavailable: unavailableCourts.length,
    },
    availableCourts,
    unavailableCourts,
  };
}

module.exports = {
  searchAvailability,
  checkCourtSlotAvailability,
  calculateDuration,
  buildPricingForUser,
};
