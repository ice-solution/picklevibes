const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');

function bookingDeductedPoints(booking) {
  const paymentPoints = Number(booking?.payment?.pointsDeducted);
  const pricingPoints = Number(booking?.pricing?.pointsDeducted);
  if (Number.isFinite(paymentPoints) && paymentPoints > 0) return paymentPoints;
  if (Number.isFinite(pricingPoints) && pricingPoints > 0) return pricingPoints;
  return 0;
}

function isFullVenueLike(booking) {
  return (
    booking?.venueBundleKind === 'full_venue' ||
    booking?.isFullVenue === true ||
    String(booking?.specialRequests || '').includes('包場預約') ||
    String(booking?.specialRequests || '').includes('🏢 包場預約')
  );
}

/**
 * 取消時退回實際已扣積分。
 * 包場：成組加總只退一次，並標記全組 payment.status=refunded，避免重複退。
 */
async function refundPointsOnBookingCancel(bundleBookings, { courtName } = {}) {
  const list = (Array.isArray(bundleBookings) ? bundleBookings : []).filter(Boolean);
  if (!list.length) {
    return { refunded: 0, skipped: true, reason: 'empty' };
  }

  if (list.some((b) => b.payment?.status === 'refunded')) {
    return { refunded: 0, skipped: true, reason: 'already_refunded' };
  }

  const total = list.reduce((sum, b) => sum + bookingDeductedPoints(b), 0);
  if (total <= 0) {
    return { refunded: 0, skipped: true, reason: 'no_points' };
  }

  const primary =
    list.find((b) => b.isFullVenue) ||
    list.find((b) => b.venueBundleKind === 'full_venue') ||
    list[0];
  const userId = primary.user;
  if (!userId) {
    return { refunded: 0, skipped: true, reason: 'no_user' };
  }

  const fullVenue = list.length > 1 && list.some(isFullVenueLike);
  const label = fullVenue
    ? `包場 ${list.length} 場`
    : courtName || primary.court?.name || '';
  const description = `預約取消退款 - ${label} ${primary.startTime || ''}-${primary.endTime || ''}`.trim();

  let userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance) {
    userBalance = new UserBalance({
      user: userId,
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
      transactions: [],
    });
  }

  await userBalance.refund(total, description, primary._id);

  const refundedAt = new Date();
  for (const b of list) {
    if (!b.payment) b.payment = {};
    b.payment.status = 'refunded';
    b.payment.refundedAt = refundedAt;
    b.payment.requiresManualRefund = false;
  }

  try {
    await Recharge.updateMany(
      {
        booking: { $in: list.map((b) => b._id) },
        pointsDeducted: true,
        status: { $ne: 'cancelled' },
      },
      {
        $set: {
          status: 'cancelled',
          'payment.status': 'refunded',
          'payment.refundedAt': refundedAt,
        },
      }
    );
  } catch (rechargeErr) {
    console.error('沖銷結算扣款記錄失敗（積分已退）:', rechargeErr);
  }

  return {
    refunded: total,
    skipped: false,
    primaryId: primary._id,
    refundedAt,
    fullVenue,
  };
}

module.exports = {
  bookingDeductedPoints,
  isFullVenueLike,
  refundPointsOnBookingCancel,
};
