const Booking = require('../models/Booking');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');
const Store = require('../models/Store');
const { collectBundledBookingIds } = require('../utils/bookingBundle');

function isBookingEligibleForSettle(booking) {
  if (!booking || ['cancelled', 'no_show'].includes(booking.status)) return false;

  const method = booking.payment?.method;
  const pts = Number(booking.payment?.pointsDeducted) || 0;
  if (method === 'points' && pts > 0 && !booking.noUserBalanceDebited) return false;

  if (['cash', 'bank_transfer', 'stripe'].includes(method) && booking.payment?.status === 'paid') {
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

async function getSettlePreview(bookingId) {
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

  return {
    eligible,
    alreadySettled,
    suggestedPoints,
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
  const deductPoints = Math.max(1, Number(points) || defaultTotal);
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
  if (userBalance.balance < deductPoints) {
    const err = new Error(`餘額不足！當前餘額：${userBalance.balance}，需要：${deductPoints}`);
    err.status = 400;
    throw err;
  }

  const courtLabel = isFullVenue
    ? `包場 ${bundle.length} 場`
    : court?.name || booking.court?.name || '場地';
  const dateLabel = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(booking.date));

  await userBalance.deductBalance(
    deductPoints,
    `${isFullVenue ? '包場結算' : '預約結算'} - ${courtLabel} ${dateLabel} ${booking.startTime}-${booking.endTime} (${reason})`
  );

  const player = buildPlayerFromUser(targetUser);
  const paidAt = new Date();

  for (let i = 0; i < bundle.length; i += 1) {
    const b = bundle[i];
    const courtPts = perBookingPoints[i] || 0;
    if (!isSameUser) {
      b.user = targetUserId;
      b.players = [player];
      b.totalPlayers = Math.max(1, b.totalPlayers || 1);
    }
    b.payment.method = 'points';
    b.payment.pointsDeducted = courtPts;
    b.payment.originalPrice = b.pricing?.totalPrice || courtPts;
    b.payment.status = 'paid';
    b.payment.paidAt = paidAt;
    b.noUserBalanceDebited = false;
    b.pricing.totalPrice = courtPts;
    b.pricing.pointsDeducted = courtPts;
    if (deductPoints !== defaultTotal) {
      b.pricing.isCustomPoints = true;
      b.pricing.customPoints = courtPts;
    }
    await b.save();
  }

  const deductRecord = new Recharge({
    user: targetUserId,
    points: deductPoints,
    amount: deductPoints,
    status: 'completed',
    paymentIntentId: `booking_settle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    description: isFullVenue ? `包場結算 - ${reason}` : `預約結算 - ${reason}`,
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
  };
}

module.exports = {
  isBookingEligibleForSettle,
  suggestedSettlePoints,
  getSettlePreview,
  settleBookingWithPoints,
};
