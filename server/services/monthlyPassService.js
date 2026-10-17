const UserEntitlement = require('../models/UserEntitlement');
const MonthlyPassPlan = require('../models/MonthlyPassPlan');
const weekendService = require('./weekendService');

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** 0=日 … 6=六；非繁忙預設一至五 */
const DEFAULT_OFF_PEAK_WEEKDAYS = [1, 2, 3, 4, 5];

function parseHhMmToMinutes(value) {
  const s = String(value || '').trim();
  if (!HHMM_RE.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function isValidHhMm(value) {
  return parseHhMmToMinutes(value) != null;
}

function isValidYmd(value) {
  const s = String(value || '').trim();
  if (!YMD_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00+08:00`);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === s;
}

function weekdayFromYmd(ymd) {
  if (!isValidYmd(ymd)) return null;
  return new Date(`${String(ymd).trim()}T12:00:00+08:00`).getDay();
}

function normalizeAllowedWeekdays(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_OFF_PEAK_WEEKDAYS];
  }
  const cleaned = [
    ...new Set(
      value
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    ),
  ].sort((a, b) => a - b);
  return cleaned.length ? cleaned : [...DEFAULT_OFF_PEAK_WEEKDAYS];
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

/**
 * 活動日期是否落在可用星期，且（可選）唔係公眾假期
 */
async function isSessionDateAllowedForOffPeak(sessionDate, plan) {
  const ymd = String(sessionDate || '').trim();
  if (!isValidYmd(ymd)) return false;

  const allowed = normalizeAllowedWeekdays(plan?.allowedWeekdays);
  const weekday = weekdayFromYmd(ymd);
  if (weekday == null || !allowed.includes(weekday)) return false;

  const excludeHolidays = plan?.excludeHolidays !== false;
  if (excludeHolidays) {
    await weekendService.initialize();
    if (weekendService.isHoliday(new Date(`${ymd}T12:00:00+08:00`))) {
      return false;
    }
  }
  return true;
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
    const dateOk = await isSessionDateAllowedForOffPeak(link.sessionDate, plan);
    if (
      dateOk &&
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
      allowedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      excludeHolidays: false,
      sortOrder: 0,
    },
    {
      type: 'off_peak',
      name: '非繁忙時間月卡',
      description:
        '平日非繁忙時段（預設一至五、公眾假期除外）活動收款連結免費；時段須完全落在非繁忙窗內',
      price: 0,
      durationDays: 30,
      offPeakStart: '10:00',
      offPeakEnd: '16:00',
      allowedWeekdays: [...DEFAULT_OFF_PEAK_WEEKDAYS],
      excludeHolidays: true,
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

  // 舊 off_peak 方案補齊可用星期／假期（只補 DB 缺欄，唔覆寫已設定）
  await MonthlyPassPlan.updateOne(
    {
      type: 'off_peak',
      $or: [{ allowedWeekdays: { $exists: false } }, { allowedWeekdays: { $size: 0 } }],
    },
    { $set: { allowedWeekdays: [...DEFAULT_OFF_PEAK_WEEKDAYS] } }
  );
  await MonthlyPassPlan.updateOne(
    { type: 'off_peak', excludeHolidays: { $exists: false } },
    { $set: { excludeHolidays: true } }
  );

  return created;
}

module.exports = {
  HHMM_RE,
  YMD_RE,
  DEFAULT_OFF_PEAK_WEEKDAYS,
  parseHhMmToMinutes,
  isValidHhMm,
  isValidYmd,
  weekdayFromYmd,
  normalizeAllowedWeekdays,
  isSessionWithinOffPeak,
  isSessionDateAllowedForOffPeak,
  isEntitlementActive,
  getActiveEntitlementsForUser,
  doesUserPassCoverLink,
  grantOrExtendEntitlement,
  ensureDefaultPlans,
};
