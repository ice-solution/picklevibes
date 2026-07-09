const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');
const User = require('../models/User');
const emailService = require('./emailService');

/**
 * 充值付款成功（Stripe / Wonder 共用）
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

  let userBalance = await UserBalance.findOne({ user: recharge.user });
  if (!userBalance) {
    userBalance = new UserBalance({ user: recharge.user });
  }
  await userBalance.addBalance(recharge.points, `充值 ${recharge.points} 分`);

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
