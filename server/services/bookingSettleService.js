const Booking = require('../models/Booking');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');
const Store = require('../models/Store');
const { collectBundledBookingIds } = require('../utils/bookingBundle');
const {
  BOOKING_EXTERNAL_PAYMENT_METHODS,
  bookingPaymentMethodLabel,
  isExternalPaymentMethod,
} = require('../constants/bookingPaymentMethods');

/** 活動佔場只鎖時段，不當客戶待結算 */
function isActivityVenueHold(booking) {
  if (!booking) return false;
  if (booking.venueBundleKind === 'activity_hold') return true;
  if (booking.relatedActivity) return true;
  return false;
}

function isBookingEligibleForSettle(booking) {
  if (!booking || ['cancelled', 'no_show'].includes(booking.status)) return false;
  if (isActivityVenueHold(booking)) return false;

  const method = booking.payment?.method;
  const payStatus = booking.payment?.status;
  const pts = Number(booking.payment?.pointsDeducted) || 0;

  // 已標記付款（含兌換碼全額抵扣、外部收款）不可再結算
  if (payStatus === 'paid' && method !== 'admin_waived') return false;

  if (method === 'points' && pts > 0 && !booking.noUserBalanceDebited) return false;

  if (
    (['stripe', ...BOOKING_EXTERNAL_PAYMENT_METHODS].includes(method) ||
      isExternalPaymentMethod(method)) &&
    payStatus === 'paid' &&
    method !== 'admin_waived'
  ) {
    return false;
  }
  return true;
}

function suggestedSettlePoints(booking) {
  if (booking.pricing?.isCustomPoints && booking.pricing?.customPoints > 0) {
    return booking.pricing.customPoints;
  }
  return Number(booking.pricing?.totalPrice) || 0;
}

async function loadBundledBookings(booking) {
  const ids = await collectBundledBookingIds(booking);
  const bookings = await Booking.find({ _id: { $in: ids } })
    .populate('store', 'name slug')
    .populate({
      path: 'court',
      select: 'name store',
      populate: { path: 'store', select: 'name slug' },
    })
    .sort({ court: 1 });
  return bookings.length ? bookings : [booking];
}

async function bundleAlreadySettled(booking) {
  const ids = await collectBundledBookingIds(booking);
  const existing = await Recharge.findOne({
    booking: { $in: ids },
    pointsDeducted: true,
    status: 'completed',
  });
  return !!existing;
}

async function getSettlePreview(bookingId, { baseOverride, forUserId } = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('預約不存在');
    err.status = 404;
    throw err;
  }

  const bundle = await loadBundledBookings(booking);
  const alreadySettled = await bundleAlreadySettled(booking);
  const suggestedPoints = alreadySettled
    ? bundle.reduce((sum, b) => sum + (Number(b.payment?.pointsDeducted) || 0), 0)
    : bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0);
  const isFullVenue =
    bundle.length > 1 &&
    (booking.venueBundleKind === 'full_venue' ||
      booking.isFullVenue ||
      String(booking.specialRequests || '').includes('包場'));

  const eligible = isBookingEligibleForSettle(booking) && !alreadySettled;

  let redeemPreview = null;
  try {
    const { computePendingRedeemPreview } = require('./bookingPendingRedeemService');
    redeemPreview = await computePendingRedeemPreview(booking, {
      baseOverride: baseOverride != null ? baseOverride : suggestedPoints,
      forUserId,
    });
  } catch (err) {
    console.error('結算兌換碼預覽失敗:', err.message || err);
  }

  return {
    eligible,
    alreadySettled,
    suggestedPoints,
    baseAmount: redeemPreview?.baseAmount ?? suggestedPoints,
    totalDiscount: redeemPreview?.totalDiscount ?? 0,
    netPayable: redeemPreview?.netPayable ?? suggestedPoints,
    pendingRedeems: redeemPreview?.applied ?? [],
    bundleCount: bundle.length,
    isFullVenue,
    label: isFullVenue ? `包場（${bundle.length} 個場地）` : null,
    bundleBreakdown: bundle.map((b) => ({
      id: String(b._id),
      courtName: b.court?.name || '場地',
      pointsDeducted: Number(b.payment?.pointsDeducted) || 0,
    })),
  };
}

async function resolveBookingStoreCourt(booking) {
  const storeDoc = booking.store?._id
    ? booking.store
    : booking.court?.store?._id
      ? booking.court.store
      : await Store.findById(booking.store || booking.court?.store);
  if (!storeDoc) {
    const err = new Error('無法解析預約所屬店鋪');
    err.status = 400;
    throw err;
  }
  return {
    store: storeDoc,
    court: booking.court?._id ? booking.court : null,
  };
}

function buildPlayerFromUser(user) {
  const phoneRaw = user.phone ? String(user.phone).replace(/\D/g, '') : '';
  return {
    name: user.name || '用戶',
    email: user.email || '',
    phone: phoneRaw.length >= 8 ? phoneRaw : '00000000',
  };
}

function allocateBundlePoints(bundle, totalPoints, opts = {}) {
  const isFullVenue = opts.isFullVenue === true;
  const defaultTotal = bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0);
  const isCustomTotal = totalPoints !== defaultTotal;

  // 包場自訂議價：平均分配到各場，避免牌價 $0 時段分不到
  if (isFullVenue && isCustomTotal && bundle.length > 1) {
    const even = Math.floor(totalPoints / bundle.length);
    return bundle.map((_, i) =>
      i === bundle.length - 1 ? totalPoints - even * (bundle.length - 1) : even
    );
  }

  const subtotal = defaultTotal;
  if (subtotal <= 0) {
    const even = Math.floor(totalPoints / bundle.length);
    return bundle.map((_, i) =>
      i === bundle.length - 1 ? totalPoints - even * (bundle.length - 1) : even
    );
  }
  let allocated = 0;
  return bundle.map((b, i) => {
    if (i === bundle.length - 1) return totalPoints - allocated;
    const share = Math.round((totalPoints * suggestedSettlePoints(b)) / subtotal);
    allocated += share;
    return share;
  });
}

/**
 * 將預約（含包場整組）指派予用戶並扣積分結算
 */
async function settleBookingWithPoints({
  bookingId,
  targetUserId,
  points,
  reason = '預約結算',
  adminUser,
  allowReassign = true,
  ipAddress,
  userAgent,
}) {
  const booking = await Booking.findById(bookingId)
    .populate('store', 'name slug')
    .populate({
      path: 'court',
      select: 'name store',
      populate: { path: 'store', select: 'name slug' },
    });

  if (!booking) {
    const err = new Error('預約不存在');
    err.status = 404;
    throw err;
  }

  if (await bundleAlreadySettled(booking)) {
    const err = new Error('此預約（或包場組）已完成結算');
    err.status = 400;
    throw err;
  }

  if (!isBookingEligibleForSettle(booking)) {
    const err = new Error('此預約不可結算（可能已付款或已取消）');
    err.status = 400;
    throw err;
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    const err = new Error('用戶不存在');
    err.status = 404;
    throw err;
  }

  const bundle = await loadBundledBookings(booking);
  const isSameUser = bundle.every((b) => String(b.user) === String(targetUserId));
  if (!isSameUser && !allowReassign) {
    const err = new Error('預約不屬於此用戶');
    err.status = 400;
    throw err;
  }

  const defaultTotal = bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0);
  const {
    resolveSettleBase,
    collectPendingRedeemEntries,
    consumePendingRedeemsOnSettle,
    computePendingRedeemPreview,
  } = require('./bookingPendingRedeemService');
  const hasPendingRedeems = collectPendingRedeemEntries(bundle).length > 0;
  const baseAmount = resolveSettleBase(
    bundle,
    points != null && points !== '' ? Number(points) : undefined
  );
  if (!hasPendingRedeems && baseAmount < 1) {
    const err = new Error('扣款積分必須大於 0');
    err.status = 400;
    throw err;
  }

  // 先預覽折扣與檢查餘額，再真正 consume，避免扣券後餘額不足
  const preview = await computePendingRedeemPreview(booking, {
    baseOverride: baseAmount,
    forUserId: targetUserId,
  });
  if (preview.applied.some((a) => a.valid === false)) {
    const bad = preview.applied.find((a) => !a.valid);
    const err = new Error(bad?.error || '掛載的兌換碼已失效，請先移除後再結算');
    err.status = 400;
    throw err;
  }
  const deductPoints = Math.max(0, Math.round(preview.netPayable));

  const isFullVenue =
    bundle.length > 1 &&
    (booking.venueBundleKind === 'full_venue' ||
      booking.isFullVenue ||
      String(booking.specialRequests || '').includes('包場'));
  const perBookingPoints = allocateBundlePoints(bundle, deductPoints, { isFullVenue });
  const { store, court } = await resolveBookingStoreCourt(booking);

  let userBalance = await UserBalance.findOne({ user: targetUserId });
  if (!userBalance) {
    userBalance = new UserBalance({ user: targetUserId });
  }
  if (deductPoints > 0 && userBalance.balance < deductPoints) {
    const err = new Error(`餘額不足！當前餘額：${userBalance.balance}，需要：${deductPoints}`);
    err.status = 400;
    throw err;
  }

  const redeemResult = await consumePendingRedeemsOnSettle({
    booking,
    bundle,
    baseAmount,
    targetUserId,
    ipAddress,
    userAgent,
  });
  // 以實際 consume 結果為準（理論上與 preview 相同）
  const finalDeduct = Math.max(0, Math.round(redeemResult.netPayable));
  if (finalDeduct !== deductPoints) {
    // 極罕見：預覽與消費之間狀態變化；若變高則再檢查餘額
    if (finalDeduct > userBalance.balance) {
      const err = new Error(`餘額不足！當前餘額：${userBalance.balance}，需要：${finalDeduct}`);
      err.status = 400;
      throw err;
    }
  }
  const chargePoints = finalDeduct;
  const chargePerBooking = allocateBundlePoints(bundle, chargePoints, { isFullVenue });

  const courtLabel = isFullVenue
    ? `包場 ${bundle.length} 場`
    : court?.name || booking.court?.name || '場地';
  const dateLabel = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(booking.date));

  const discountNote =
    redeemResult.totalDiscount > 0 ? `，兌換碼折扣 $${redeemResult.totalDiscount}` : '';

  if (chargePoints > 0) {
    await userBalance.deductBalance(
      chargePoints,
      `${isFullVenue ? '包場結算' : '預約結算'} - ${courtLabel} ${dateLabel} ${booking.startTime}-${booking.endTime} (${reason}${discountNote})`
    );
  }

  const player = buildPlayerFromUser(targetUser);
  const paidAt = new Date();

  for (let i = 0; i < bundle.length; i += 1) {
    const b = bundle[i];
    const courtPts = chargePerBooking[i] || 0;
    if (!isSameUser) {
      b.user = targetUserId;
      b.players = [player];
      b.totalPlayers = Math.max(1, b.totalPlayers || 1);
    }
    b.payment.method = 'points';
    b.payment.pointsDeducted = courtPts;
    b.payment.originalPrice = b.pricing?.totalPrice || courtPts;
    b.payment.discount = i === 0 ? redeemResult.totalDiscount : 0;
    b.payment.status = 'paid';
    b.payment.paidAt = paidAt;
    b.noUserBalanceDebited = false;
    b.pricing.totalPrice = courtPts;
    b.pricing.pointsDeducted = courtPts;
    if (baseAmount !== defaultTotal || redeemResult.totalDiscount > 0) {
      b.pricing.isCustomPoints = true;
      b.pricing.customPoints = courtPts;
    }
    b.pendingRedeems = [];
    await b.save();
  }

  let deductRecord = null;
  if (chargePoints > 0) {
    deductRecord = new Recharge({
      user: targetUserId,
      points: chargePoints,
      amount: chargePoints,
      status: 'completed',
      paymentIntentId: `booking_settle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      description: isFullVenue
        ? `包場結算 - ${reason}${discountNote}`
        : `預約結算 - ${reason}${discountNote}`,
      store: store._id,
      court: court?._id || booking.court || null,
      booking: booking._id,
      adjustedBy: adminUser._id,
      payment: {
        status: 'paid',
        method: 'manual',
        paidAt,
        transactionId: `booking_settle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      pointsAdded: false,
      pointsDeducted: true,
    });
    await deductRecord.save();
  }

  await booking.populate('user', 'name email phone');
  await booking.populate('store', 'name slug');
  await booking.populate({
    path: 'court',
    select: 'name number type store',
    populate: { path: 'store', select: 'name slug' },
  });

  return {
    booking,
    deductRecord,
    userBalance: {
      balance: userBalance.balance,
      totalRecharged: userBalance.totalRecharged,
      totalSpent: userBalance.totalSpent,
    },
    reassigned: !isSameUser,
    bundleCount: bundle.length,
    redeem: {
      baseAmount: redeemResult.baseAmount,
      totalDiscount: redeemResult.totalDiscount,
      netPayable: chargePoints,
      applied: redeemResult.applied,
    },
  };
}

/**
 * 現場／外部收款結算（現金、KPay、FPS 等，不扣積分）
 */
async function settleBookingWithExternalPayment({
  bookingId,
  method,
  targetUserId,
  amount,
  note = '',
  adminUser,
  allowReassign = true,
  ipAddress,
  userAgent,
}) {
  if (!isExternalPaymentMethod(method)) {
    const err = new Error('無效的付款方式');
    err.status = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId)
    .populate('store', 'name slug')
    .populate({
      path: 'court',
      select: 'name store',
      populate: { path: 'store', select: 'name slug' },
    });

  if (!booking) {
    const err = new Error('預約不存在');
    err.status = 404;
    throw err;
  }

  if (await bundleAlreadySettled(booking)) {
    const err = new Error('此預約（或包場組）已完成積分結算');
    err.status = 400;
    throw err;
  }

  if (!isBookingEligibleForSettle(booking)) {
    const err = new Error('此預約不可結算（可能已付款或已取消）');
    err.status = 400;
    throw err;
  }

  let targetUser = null;
  if (targetUserId) {
    targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      const err = new Error('用戶不存在');
      err.status = 404;
      throw err;
    }
  }

  const bundle = await loadBundledBookings(booking);
  const defaultTotal = bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0);
  const { resolveSettleBase, collectPendingRedeemEntries, consumePendingRedeemsOnSettle } =
    require('./bookingPendingRedeemService');
  const hasPendingRedeems = collectPendingRedeemEntries(bundle).length > 0;
  const baseAmount = resolveSettleBase(
    bundle,
    amount != null && Number(amount) >= 0 ? Number(amount) : undefined
  );

  let redeemResult = {
    baseAmount,
    totalDiscount: 0,
    netPayable: baseAmount,
    applied: [],
  };

  if (hasPendingRedeems) {
    const consumeUserId = targetUser?._id || booking.user;
    if (!consumeUserId) {
      const err = new Error('使用兌換碼結算時請指定用戶');
      err.status = 400;
      throw err;
    }
    redeemResult = await consumePendingRedeemsOnSettle({
      booking,
      bundle,
      baseAmount,
      targetUserId: consumeUserId,
      ipAddress,
      userAgent,
    });
  }

  const totalAmount = Math.max(0, Number(redeemResult.netPayable) || 0);

  const isFullVenue =
    bundle.length > 1 &&
    (booking.venueBundleKind === 'full_venue' ||
      booking.isFullVenue ||
      String(booking.specialRequests || '').includes('包場'));

  const perBookingAmounts = allocateBundlePoints(bundle, totalAmount, { isFullVenue });
  const paidAt = new Date();
  const methodLabel = bookingPaymentMethodLabel(method);
  const noteTrim = String(note || '').trim();
  const discountNote =
    redeemResult.totalDiscount > 0 ? ` · 兌換碼折扣 $${redeemResult.totalDiscount}` : '';
  const adminNoteContent = `外部收款結算 · ${methodLabel}${noteTrim ? ` · ${noteTrim}` : ''}${discountNote} · $${totalAmount}`;

  let reassigned = false;
  if (targetUser) {
    const isSameUser = bundle.every((b) => String(b.user) === String(targetUser._id));
    if (!isSameUser && !allowReassign) {
      const err = new Error('預約不屬於此用戶');
      err.status = 400;
      throw err;
    }
    if (!isSameUser) {
      reassigned = true;
      const player = buildPlayerFromUser(targetUser);
      for (const b of bundle) {
        b.user = targetUser._id;
        b.players = [player];
        b.totalPlayers = Math.max(1, b.totalPlayers || 1);
      }
    }
  }

  for (let i = 0; i < bundle.length; i += 1) {
    const b = bundle[i];
    const courtAmount = perBookingAmounts[i] || 0;
    b.payment.method = method;
    b.payment.status = 'paid';
    b.payment.paidAt = paidAt;
    b.payment.pointsDeducted = 0;
    b.payment.originalPrice = b.pricing?.totalPrice || courtAmount;
    b.payment.discount = i === 0 ? redeemResult.totalDiscount : 0;
    b.payment.externalNote = noteTrim || undefined;
    b.noUserBalanceDebited = false;
    b.pricing.totalPrice = courtAmount;
    if (baseAmount !== defaultTotal || redeemResult.totalDiscount > 0) {
      b.pricing.isCustomPoints = true;
      b.pricing.customPoints = courtAmount;
    }
    b.pendingRedeems = [];
    if (adminUser?._id) {
      b.adminNotes = b.adminNotes || [];
      b.adminNotes.push({
        content: adminNoteContent,
        createdBy: adminUser._id,
        createdAt: paidAt,
      });
    }
    await b.save();
  }

  await booking.populate('user', 'name email phone');
  await booking.populate('store', 'name slug');
  await booking.populate({
    path: 'court',
    select: 'name number type store',
    populate: { path: 'store', select: 'name slug' },
  });

  return {
    booking,
    method,
    methodLabel,
    totalAmount,
    reassigned,
    bundleCount: bundle.length,
    redeem: {
      baseAmount: redeemResult.baseAmount,
      totalDiscount: redeemResult.totalDiscount,
      netPayable: totalAmount,
      applied: redeemResult.applied,
    },
  };
}

module.exports = {
  isActivityVenueHold,
  isBookingEligibleForSettle,
  suggestedSettlePoints,
  loadBundledBookings,
  bundleAlreadySettled,
  getSettlePreview,
  settleBookingWithPoints,
  settleBookingWithExternalPayment,
  BOOKING_EXTERNAL_PAYMENT_METHODS,
  bookingPaymentMethodLabel,
};
