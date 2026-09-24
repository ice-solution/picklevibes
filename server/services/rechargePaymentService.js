const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');
const User = require('../models/User');
const RechargeOffer = require('../models/RechargeOffer');
const RedeemCode = require('../models/RedeemCode');
const emailService = require('./emailService');
const { ensurePocketEntry } = require('./redeemPocketService');
const { generateOneUniqueIndependentCode } = require('./redeemBatchGenerator');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

/**
 * 由範本兌換碼複製一張「個人券」：有效期由充值當日起計
 */
async function createPersonalBonusRedeemCode(template, { validDays, offerName }) {
  const now = new Date();
  const validUntil = addDays(now, validDays);
  const code = await generateOneUniqueIndependentCode();

  const personal = new RedeemCode({
    code,
    name: template.name,
    description: template.description || '',
    type: template.type,
    value: template.value,
    minAmount: template.minAmount ?? 0,
    maxDiscount: template.maxDiscount ?? null,
    usageLimit: 1,
    userUsageLimit: 1,
    isIndependentCode: true,
    commissionRate: template.commissionRate ?? null,
    validFrom: now,
    validUntil,
    isActive: true,
    applicableTypes: template.applicableTypes?.length ? template.applicableTypes : ['all'],
    applicablePricingSlots: template.applicablePricingSlots || [],
    applicableProducts: template.applicableProducts || [],
    applicableCategories: template.applicableCategories || [],
    restrictedCode: template.restrictedCode || null,
    createdBy: template.createdBy,
    totalUsed: 0,
    totalDiscount: 0,
  });

  // 方便後台辨識來源
  if (offerName) {
    personal.description = [
      personal.description,
      `（充值贈券 · ${offerName} · 範本 ${template.code}）`,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  await personal.save();
  return personal;
}

/**
 * 充值優惠綁定的兌換券 → 自動派入用戶口袋
 * 每次成功充值會依範本複製個人券，有效期由當日起計 bonusRedeemValidDays 天
 */
async function grantRechargeOfferBonusRedeem(recharge) {
  if (!recharge || recharge.bonusRedeemGranted) {
    return { granted: 0, skipped: true };
  }
  if (!recharge.rechargeOffer) {
    recharge.bonusRedeemGranted = true;
    await recharge.save();
    return { granted: 0, skipped: true };
  }

  const offer = await RechargeOffer.findById(recharge.rechargeOffer)
    .select('name bonusRedeemCodes bonusRedeemValidDays')
    .lean();

  const templateIds = (offer?.bonusRedeemCodes || []).map((id) => String(id)).filter(Boolean);
  if (!templateIds.length) {
    recharge.bonusRedeemGranted = true;
    await recharge.save();
    return { granted: 0, skipped: false };
  }

  const validDays = Math.min(365, Math.max(1, Number(offer.bonusRedeemValidDays) || 30));
  const templates = await RedeemCode.find({ _id: { $in: templateIds }, isActive: true });
  const templateMap = new Map(templates.map((t) => [String(t._id), t]));

  let granted = 0;
  for (const templateId of templateIds) {
    const template = templateMap.get(String(templateId));
    if (!template) {
      console.error(`❌ 充值贈券範本不存在或已停用: ${templateId}`);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const personal = await createPersonalBonusRedeemCode(template, {
        validDays,
        offerName: offer?.name || '',
      });
      // eslint-disable-next-line no-await-in-loop
      const { created } = await ensurePocketEntry({
        userId: recharge.user,
        redeemCodeId: personal._id,
        source: 'recharge_offer',
        note: `充值優惠贈券：${offer?.name || ''}（有效 ${validDays} 日）`.trim(),
      });
      if (created) granted += 1;
    } catch (err) {
      console.error(`❌ 充值贈券派發失敗 (${templateId}):`, err.message || err);
    }
  }

  recharge.bonusRedeemGranted = true;
  await recharge.save();
  return { granted, skipped: false };
}


/**
 * 充值優惠綁定的會籍升級
 */
async function grantRechargeOfferMembership(recharge) {
  if (!recharge || recharge.membershipGranted) {
    return { granted: false, skipped: true };
  }
  if (!recharge.rechargeOffer) {
    recharge.membershipGranted = true;
    await recharge.save();
    return { granted: false, skipped: true };
  }

  const {
    isPaidMembershipTier,
    GRANT_MONTHS_BY_TIER,
  } = require('../constants/membershipTiers');

  const offer = await RechargeOffer.findById(recharge.rechargeOffer)
    .select('name grantMembershipLevel grantMembershipMonths')
    .lean();

  const level = offer?.grantMembershipLevel || null;
  if (!isPaidMembershipTier(level)) {
    recharge.membershipGranted = true;
    await recharge.save();
    return { granted: false, skipped: false };
  }

  const months =
    offer.grantMembershipMonths != null
      ? Number(offer.grantMembershipMonths)
      : GRANT_MONTHS_BY_TIER[level];

  const user = await User.findById(recharge.user);
  if (!user) {
    console.error(`❌ 充值升會籍找不到用戶: ${recharge.user}`);
    return { granted: false, skipped: false };
  }

  await user.setPaidMembershipTier(level, months);
  recharge.membershipGranted = true;
  await recharge.save();
  console.log(
    `✅ 充值升會籍: ${user.email} → ${level}（${months} 個月）· 優惠 ${offer?.name || ''}`
  );
  return { granted: true, level, months };
}

/**
 * 充值付款成功（Stripe / Wonder 共用）
 */
async function completeRechargePayment(rechargeId, transactionId) {
  const recharge = await Recharge.findById(rechargeId);
  if (!recharge) {
    throw new Error(`找不到充值記錄: ${rechargeId}`);
  }
  if (recharge.status === 'completed') {
    // 補派贈券／會籍（例如先前完成積分但派發失敗）
    await grantRechargeOfferBonusRedeem(recharge);
    await grantRechargeOfferMembership(recharge);
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
    await grantRechargeOfferBonusRedeem(recharge);
  } catch (bonusError) {
    console.error('❌ 充值優惠贈券派發失敗:', bonusError);
  }

  try {
    await grantRechargeOfferMembership(recharge);
  } catch (membershipError) {
    console.error('❌ 充值優惠會籍升級失敗:', membershipError);
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
  grantRechargeOfferBonusRedeem,
  grantRechargeOfferMembership,
};
