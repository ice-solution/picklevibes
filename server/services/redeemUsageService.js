const mongoose = require('mongoose');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');

function isTransactionsUnsupportedError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Transaction numbers are only allowed') ||
    msg.includes('replica set') ||
    msg.includes('not supported') ||
    msg.includes('IllegalOperation')
  );
}

async function consumeRedeemCodeOnce({
  redeemCodeId,
  userId,
  orderType,
  orderId,
  originalAmount,
  discountAmount,
  finalAmount,
  ipAddress,
  userAgent,
}) {
  const now = new Date();

  const redeemCode = await RedeemCode.findById(redeemCodeId);
  if (!redeemCode || !redeemCode.isValid()) {
    const err = new Error('兌換碼無效或已過期');
    err.statusCode = 400;
    throw err;
  }

  // 檢查適用範圍（僅以 applicableTypes 為準）
  if (
    !redeemCode.applicableTypes?.includes('all') &&
    !redeemCode.applicableTypes?.includes(orderType)
  ) {
    const err = new Error('此兌換碼不適用於當前訂單類型');
    err.statusCode = 400;
    throw err;
  }

  // 檢查最低消費金額
  if (originalAmount < redeemCode.minAmount) {
    const err = new Error(`此兌換碼需要最低消費 HK$${redeemCode.minAmount}`);
    err.statusCode = 400;
    throw err;
  }

  // 檢查用戶使用次數（獨立兌換碼也固定為 1）
  const canUse = await redeemCode.canUserUse(userId);
  if (!canUse) {
    const err = new Error('您已超過此兌換碼的使用次數限制');
    err.statusCode = 400;
    throw err;
  }

  const effectiveUsageLimit = redeemCode.isIndependentCode ? 1 : redeemCode.usageLimit;

  const doWork = async (session) => {
    // 先用「條件式原子更新」搶占使用名額，避免並發下重複使用
    const query = {
      _id: redeemCode._id,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
    };
    if (effectiveUsageLimit !== null && effectiveUsageLimit !== undefined) {
      query.totalUsed = { $lt: effectiveUsageLimit };
    }

    const updated = await RedeemCode.findOneAndUpdate(
      query,
      { $inc: { totalUsed: 1, totalDiscount: discountAmount } },
      { new: true, session }
    );

    if (!updated) {
      const err = new Error('兌換碼已過期或使用次數已滿');
      err.statusCode = 400;
      throw err;
    }

    const commissionRate = updated.commissionRate ?? null;
    const commissionAmount = commissionRate
      ? Math.round(finalAmount * (commissionRate / 100) * 100) / 100
      : 0;

    const usage = new RedeemUsage({
      redeemCode: updated._id,
      user: userId,
      orderType,
      orderId,
      originalAmount,
      discountAmount,
      finalAmount,
      commissionRate,
      commissionAmount,
      ipAddress,
      userAgent,
    });

    await usage.save({ session });

    return { redeemCode: updated, usage };
  };

  // 優先用 transaction（如果 DB 支援），否則退回非 transaction 的原子更新版本
  const session = await mongoose.startSession();
  try {
    let result = null;
    await session.withTransaction(async () => {
      result = await doWork(session);
    });
    return result;
  } catch (err) {
    if (!isTransactionsUnsupportedError(err)) throw err;
  } finally {
    await session.endSession();
  }

  // fallback（無 transaction）
  return await doWork(undefined);
}

module.exports = {
  consumeRedeemCodeOnce,
};

