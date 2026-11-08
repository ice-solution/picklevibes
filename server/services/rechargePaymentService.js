const Recharge = require('../models/Recharge');
const User = require('../models/User');
const emailService = require('./emailService');
const { completeRechargePayment: creditRechargeBalance } = require('./storeBalanceService');

/**
 * 充值付款成功（Stripe / Wonder 共用）
 * 依 recharge.store 入帳平台或店鋪餘額
 */
async function completeRechargePayment(rechargeId, transactionId) {
  const recharge = await Recharge.findById(rechargeId);
  if (!recharge) {
    throw new Error(`找不到充值記錄: ${rechargeId}`);
  }
  if (recharge.status === 'completed') {
    return { recharge, alreadyCompleted: true };
  }
  if (recharge.status !== 'pending') {
    throw new Error(`充值狀態不可完成: ${recharge.status}`);
  }

  recharge.status = 'completed';
  recharge.payment.status = 'paid';
  recharge.payment.paidAt = new Date();
  if (transactionId) {
    recharge.payment.transactionId = transactionId;
  }
  await recharge.save();

  await creditRechargeBalance(recharge, `充值 ${recharge.points} 分`);

  // 店充值不抽成（只對積分預約場地抽成）；清除舊錯誤寫入嘅抽成紀錄
  try {
    const { voidFeeForSource } = require('./platformFeeService');
    if (recharge.store && recharge._id) {
      await voidFeeForSource('Recharge', recharge._id, 'store_recharge_not_commissionable');
    }
  } catch (feeErr) {
    console.warn('店充值清除抽成紀錄:', feeErr.message);
  }

  try {
    const user = await User.findById(recharge.user);
    if (user) {
      await emailService.sendRechargeInvoiceEmail(user, recharge);
    }
  } catch (emailError) {
    console.error('❌ 充值發票郵件發送失敗:', emailError);
  }

  return { recharge, alreadyCompleted: false };
}

function parseRechargeIdFromReference(referenceNumber) {
  if (!referenceNumber) return null;
  const s = String(referenceNumber);
  if (/^[a-f0-9]{24}$/i.test(s)) return s;
  const m = s.match(/^recharge_([a-f0-9]{24})_/i);
  return m ? m[1] : null;
}

module.exports = {
  completeRechargePayment,
  parseRechargeIdFromReference,
};
