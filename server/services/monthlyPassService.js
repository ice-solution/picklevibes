const UserEntitlement = require('../models/UserEntitlement');
const MonthlyPassPlan = require('../models/MonthlyPassPlan');

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseHhMmToMinutes(value) {
  const s = String(value || '').trim();
  if (!HHMM_RE.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function isValidHhMm(value) {
  return parseHhMmToMinutes(value) != null;
}

/** 活動時段須完全落在非繁忙窗內（不支援跨日） */
function isSessionWithinOffPeak(sessionStart, sessionEnd, offPeakStart, offPeakEnd) {
  const s = parseHhMmToMinutes(sessionStart);
  const e = parseHhMmToMinutes(sessionEnd);
  const os = parseHhMmToMinutes(offPeakStart);
  const oe = parseHhMmToMinutes(offPeakEnd);
  if (s == null || e == null || os == null || oe == null) return false;
  if (e <= s || oe <= os) return false;
  return s >= os && e <= oe;
}

function isEntitlementActive(entitlement, now = new Date()) {
  if (!entitlement?.expiresAt) return false;
  return new Date(entitlement.expiresAt) > now;
}

async function getActiveEntitlementsForUser(userId, now = new Date()) {
  if (!userId) return [];
  return UserEntitlement.find({
    user: userId,
    expiresAt: { $gt: now },
  }).lean();
}

async function getActivePlanMap(now = new Date()) {
  const plans = await MonthlyPassPlan.find({ isActive: true }).lean();
  const map = {};
  for (const p of plans) {
    map[p.type] = p;
  }
  return map;
}

/**
 * 活動收款連結是否被用戶有效月卡覆蓋（賣卡連結永不覆蓋）。
 */
async function doesUserPassCoverLink(userId, link, now = new Date()) {
  if (!userId || !link) return false;
  if (String(link.purpose || 'activity') === 'sell_pass') return false;

  const entitlements = await getActiveEntitlementsForUser(userId, now);
  if (!entitlements.length) return false;

  const plans = await getActivePlanMap(now);
  const hasType = (type) => entitlements.some((e) => e.planType === type);

  if (link.isReclub && hasType('reclub_unlimited')) {
    return true;
  }

  if (hasType('off_peak')) {
    const plan = plans.off_peak;
    const offStart = plan?.offPeakStart || '10:00';
    const offEnd = plan?.offPeakEnd || '16:00';
    if (
      link.sessionStart &&
      link.sessionEnd &&
      isSessionWithinOffPeak(link.sessionStart, link.sessionEnd, offStart, offEnd)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 發放／延長月卡（同一 planType 一筆）。idempotent：同一 sourcePayment 不重複延長。
 */
async function grantOrExtendEntitlement({
  userId,
  planType,
  durationDays,
  planId = null,
  sourcePaymentId = null,
  note = '',
  adjustedBy = null,
  now = new Date(),
}) {
  if (!userId || !planType || !durationDays || durationDays < 1) {
    throw new Error('發放月卡參數無效');
  }

  let ent = await UserEntitlement.findOne({ user: userId, planType });
  if (
    sourcePaymentId &&
    ent?.sourcePayment &&
    String(ent.sourcePayment) === String(sourcePaymentId)
  ) {
    return { entitlement: ent, extended: false, skippedDuplicate: true };
  }

  const base =
    ent && isEntitlementActive(ent, now) ? new Date(ent.expiresAt) : new Date(now);
  const expiresAt = new Date(base.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);

  if (!ent) {
    ent = new UserEntitlement({
      user: userId,
      planType,
      plan: planId || null,
      expiresAt,
      sourcePayment: sourcePaymentId || null,
      note: note || '',
      adjustedBy: adjustedBy || null,
    });
  } else {
    ent.expiresAt = expiresAt;
    if (planId) ent.plan = planId;
    if (sourcePaymentId) ent.sourcePayment = sourcePaymentId;
    if (note) ent.note = note;
    if (adjustedBy) ent.adjustedBy = adjustedBy;
  }
  await ent.save();
  return { entitlement: ent, extended: true, skippedDuplicate: false };
}

async function ensureDefaultPlans(createdBy = null) {
  const defaults = [
    {
      type: 'reclub_unlimited',
      name: '任打 Reclub 月卡',
      description: '有效期內 Reclub 活動收款連結免費（不限時段）',
      price: 0,
      durationDays: 30,
      offPeakStart: '10:00',
      offPeakEnd: '16:00',
      sortOrder: 0,
    },
    {
      type: 'off_peak',
      name: '非繁忙時間月卡',
      description: '活動時段完全落在非繁忙窗內的收款連結免費',
      price: 0,
      durationDays: 30,
      offPeakStart: '10:00',
      offPeakEnd: '16:00',
      sortOrder: 1,
    },
  ];
  const created = [];
  for (const d of defaults) {
    const existing = await MonthlyPassPlan.findOne({ type: d.type });
    if (!existing) {
      const doc = await MonthlyPassPlan.create({ ...d, createdBy });
      created.push(doc);
    }
  }
  return created;
}

module.exports = {
  HHMM_RE,
  parseHhMmToMinutes,
  isValidHhMm,
  isSessionWithinOffPeak,
  isEntitlementActive,
  getActiveEntitlementsForUser,
  doesUserPassCoverLink,
  grantOrExtendEntitlement,
  ensureDefaultPlans,
};
