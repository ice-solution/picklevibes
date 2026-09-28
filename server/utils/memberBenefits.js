const {
  BOOKING_DISCOUNT_RATE_BY_LEVEL,
  BOOKING_DISCOUNT_LABELS_ZH,
  MAX_ADVANCE_DAYS_BY_MEMBERSHIP,
  isPaidMembershipTier,
} = require('../constants/membershipTiers');

/** @deprecated 保留相容；實際依會籍等級 */
const VIP_BOOKING_DISCOUNT_RATE = BOOKING_DISCOUNT_RATE_BY_LEVEL.vip;
const ATHLETE_PAYMENT_LINK_RATE = 0.5;

/**
 * 限時：VIP／會員價之後再減固定積分（唔使兌換碼）
 * env：
 *   VIP_BOOKING_EXTRA_OFF_POINTS=88
 *   VIP_BOOKING_EXTRA_OFF_FROM=2026-09-29
 *   VIP_BOOKING_EXTRA_OFF_UNTIL=2026-10-29
 * 設 POINTS=0 即關閉。
 */
const DEFAULT_VIP_EXTRA_OFF_POINTS = 88;
const DEFAULT_VIP_EXTRA_OFF_FROM = '2026-09-29T00:00:00+08:00';
const DEFAULT_VIP_EXTRA_OFF_UNTIL = '2026-10-29T23:59:59.999+08:00';

/**
 * 訂場／收款連結身份折扣（VIP、付費會籍、選手）。
 * 月卡全免邏輯在 monthlyPassService + paymentLinkPaymentService.resolvePaymentLinkPrices。
 */

function parseEnvDate(raw, fallbackIso) {
  const s = String(raw || '').trim();
  if (!s) return new Date(fallbackIso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00+08:00`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(fallbackIso) : d;
}

function getVipBookingExtraFlatOffConfig(now = new Date()) {
  const rawPoints = process.env.VIP_BOOKING_EXTRA_OFF_POINTS;
  const points =
    rawPoints === undefined || rawPoints === ''
      ? DEFAULT_VIP_EXTRA_OFF_POINTS
      : Number(rawPoints);
  if (!Number.isFinite(points) || points <= 0) {
    return { active: false, points: 0 };
  }
  const from = parseEnvDate(process.env.VIP_BOOKING_EXTRA_OFF_FROM, DEFAULT_VIP_EXTRA_OFF_FROM);
  let until = parseEnvDate(process.env.VIP_BOOKING_EXTRA_OFF_UNTIL, DEFAULT_VIP_EXTRA_OFF_UNTIL);
  // 若只填 YYYY-MM-DD，當日完結用 23:59:59.999 HKT
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(process.env.VIP_BOOKING_EXTRA_OFF_UNTIL || '').trim())) {
    until = new Date(`${String(process.env.VIP_BOOKING_EXTRA_OFF_UNTIL).trim()}T23:59:59.999+08:00`);
  }
  const t = now instanceof Date ? now : new Date(now);
  const active = t >= from && t <= until;
  return { active, points: active ? points : 0, from, until };
}

/** 有 VIP／會員場租折扣時，限時再減嘅固定積分（否則 0） */
function getVipBookingExtraFlatOff(user, now = new Date()) {
  if (!hasBookingVipDiscount(user)) return 0;
  return getVipBookingExtraFlatOffConfig(now).points;
}

function isAthleteRole(user) {
  return String(user?.role || '').toLowerCase() === 'athlete';
}

function resolveBookingDiscountLevel(user) {
  if (!user) return 'basic';
  if (isAthleteRole(user)) return 'athlete';
  const level = String(user.membershipLevel || 'basic');
  if (level === 'vip' || isPaidMembershipTier(level)) return level;
  return 'basic';
}

function getBookingDiscountRate(user) {
  const level = resolveBookingDiscountLevel(user);
  if (level === 'athlete') return VIP_BOOKING_DISCOUNT_RATE;
  return BOOKING_DISCOUNT_RATE_BY_LEVEL[level] ?? 1;
}

/** 訂場有身份折扣：VIP／銀金白金／選手 */
function hasBookingVipDiscount(user) {
  if (!user) return false;
  return getBookingDiscountRate(user) < 1;
}

function bookingVipDiscountLabel(user) {
  const level = resolveBookingDiscountLevel(user);
  const base = BOOKING_DISCOUNT_LABELS_ZH[level] || BOOKING_DISCOUNT_LABELS_ZH.basic;
  const extra = getVipBookingExtraFlatOff(user);
  if (extra > 0) return `${base}，周年減價`;
  return base;
}

/** 牌價 → VIP／會員倍率價（未扣限時固定減額） */
function applyBookingVipRateOnly(amount, user) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * getBookingDiscountRate(user));
}

/** 牌價 → VIP／會員價；限時再減固定積分（floor 0） */
function applyBookingVipDiscount(amount, user, now = new Date()) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  const afterRate = applyBookingVipRateOnly(n, user);
  const extra = getVipBookingExtraFlatOff(user, now);
  return Math.max(0, afterRate - extra);
}

function applyAthletePaymentLinkPrice(amount, user) {
  const n = Number(amount) || 0;
  if (!isAthleteRole(user) || n <= 0) return n;
  return Math.round(n * ATHLETE_PAYMENT_LINK_RATE * 100) / 100;
}

/** role 天數與會籍天數取較大者 */
function resolveMaxAdvanceDays(user, maxAdvanceDaysByRole = {}) {
  const role = String(user?.role || 'user');
  const roleDays = Number(maxAdvanceDaysByRole[role] ?? maxAdvanceDaysByRole.user ?? 7) || 7;
  const level = String(user?.membershipLevel || 'basic');
  const membershipDays = Number(MAX_ADVANCE_DAYS_BY_MEMBERSHIP[level] || 0) || 0;
  return Math.max(roleDays, membershipDays);
}

module.exports = {
  VIP_BOOKING_DISCOUNT_RATE,
  ATHLETE_PAYMENT_LINK_RATE,
  isAthleteRole,
  hasBookingVipDiscount,
  bookingVipDiscountLabel,
  applyBookingVipRateOnly,
  applyBookingVipDiscount,
  applyAthletePaymentLinkPrice,
  getBookingDiscountRate,
  getVipBookingExtraFlatOff,
  getVipBookingExtraFlatOffConfig,
  resolveBookingDiscountLevel,
  resolveMaxAdvanceDays,
};
