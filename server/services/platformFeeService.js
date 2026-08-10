const Store = require('../models/Store');
const StorePlatformFee = require('../models/StorePlatformFee');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * 依店鋪 platformFeePercent 建立／更新抽成紀錄（idempotent by source）
 */
async function recordStorePlatformFee({
  storeId,
  type,
  sourceModel,
  sourceId,
  grossAmount,
  occurredAt,
  note = '',
}) {
  if (!storeId || !sourceId) {
    return { skipped: true, reason: 'missing_ids' };
  }

  const gross = round2(grossAmount);
  if (gross <= 0) {
    return { skipped: true, reason: 'zero_gross' };
  }

  const store = await Store.findById(storeId).select('platformFeePercent name').lean();
  if (!store) {
    return { skipped: true, reason: 'store_not_found' };
  }

  const feePercent = Number(store.platformFeePercent);
  if (!Number.isFinite(feePercent) || feePercent <= 0) {
    return { skipped: true, reason: 'no_fee_percent' };
  }

  const feeAmount = round2((gross * feePercent) / 100);
  const netAmount = round2(Math.max(0, gross - feeAmount));

  const doc = await StorePlatformFee.findOneAndUpdate(
    { sourceModel, sourceId, type },
    {
      $set: {
        store: store._id,
        type,
        sourceModel,
        sourceId,
        grossAmount: gross,
        feePercent,
        feeAmount,
        netAmount,
        occurredAt: occurredAt || new Date(),
        note: note || '',
        voided: false,
        voidedAt: null,
      },
      $setOnInsert: {
        settled: false,
        settledAt: null,
        settledBy: null,
      },
    },
    { upsert: true, new: true }
  );

  return { created: true, fee: doc };
}

async function recordFeeForStoreRecharge(recharge) {
  if (!recharge?.store || !recharge?._id) {
    return { skipped: true, reason: 'not_store_recharge' };
  }
  const gross = Number(recharge.amount) > 0 ? recharge.amount : recharge.points;
  return recordStorePlatformFee({
    storeId: recharge.store,
    type: 'store_recharge',
    sourceModel: 'Recharge',
    sourceId: recharge._id,
    grossAmount: gross,
    occurredAt: recharge.payment?.paidAt || recharge.updatedAt || new Date(),
    note: `店充值 ${recharge.points || 0} 分`,
  });
}

async function recordFeeForBookingPoints(booking, pointsDeducted) {
  if (!booking?.store || !booking?._id) {
    return { skipped: true, reason: 'no_store' };
  }
  const points =
    Number(pointsDeducted) ||
    Number(booking.payment?.pointsDeducted) ||
    Number(booking.pricing?.pointsDeducted) ||
    0;
  if (points <= 0) {
    return { skipped: true, reason: 'no_points' };
  }
  if (booking.payment?.method === 'admin_waived' || booking.noUserBalanceDebited) {
    return { skipped: true, reason: 'not_points_payment' };
  }

  return recordStorePlatformFee({
    storeId: booking.store,
    type: 'booking_points',
    sourceModel: 'Booking',
    sourceId: booking._id,
    grossAmount: points,
    occurredAt: booking.payment?.paidAt || booking.createdAt || new Date(),
    note: `積分預約 ${points} 分`,
  });
}

async function voidFeeForSource(sourceModel, sourceId, reason = '') {
  const fee = await StorePlatformFee.findOne({ sourceModel, sourceId, voided: false });
  if (!fee) return { skipped: true, reason: 'not_found' };
  fee.voided = true;
  fee.voidedAt = new Date();
  if (reason) fee.note = `${fee.note || ''} [${reason}]`.trim();
  await fee.save();
  return { voided: true, fee };
}

/**
 * 某店某時段抽成合計（未作廢）
 */
async function sumFeesForStore(storeId, { from, to, type } = {}) {
  const match = {
    store: storeId,
    voided: { $ne: true },
  };
  if (type) match.type = type;
  if (from || to) {
    match.occurredAt = {};
    if (from) match.occurredAt.$gte = from;
    if (to) match.occurredAt.$lte = to;
  }
  const rows = await StorePlatformFee.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        grossAmount: { $sum: '$grossAmount' },
        feeAmount: { $sum: '$feeAmount' },
        netAmount: { $sum: '$netAmount' },
        count: { $sum: 1 },
      },
    },
  ]);
  return (
    rows[0] || {
      grossAmount: 0,
      feeAmount: 0,
      netAmount: 0,
      count: 0,
    }
  );
}

module.exports = {
  recordStorePlatformFee,
  recordFeeForStoreRecharge,
  recordFeeForBookingPoints,
  voidFeeForSource,
  sumFeesForStore,
  round2,
};
