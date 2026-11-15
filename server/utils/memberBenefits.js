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
 * 限時：VIP／會員價之後，「第二小時」半價（只減第二個小時；第 1／3／4… 小時維持 VIP 價）
 * 由 2026-11-19 起取代舊「每小時 −88」優惠。
 * env：
 *   VIP_BOOKING_EXTRA_OFF_FROM=2026-11-19
 *   VIP_BOOKING_EXTRA_OFF_UNTIL=          （留空＝無結束日）
 *   VIP_BOOKING_EXTRA_OFF_DISABLED=1     （或 POINTS=0）關閉
 */
const DEFAULT_VIP_EXTRA_OFF_FROM = '2026-11-19T00:00:00+08:00';
const DEFAULT_VIP_EXTRA_OFF_UNTIL = '';
const EXTRA_OFF_LABEL_ZH = '第二小時半價';

/**
 * 訂場／收款連結身份折扣（VIP、付費會籍、選手）。
 * 月卡全免邏輯在 monthlyPassService + paymentLinkPaymentService.resolvePaymentLinkPrices。
 */

function parseEnvDate(raw, fallbackIso, { endOfDay = false } = {}) {
  const s = String(raw || '').trim();
  if (!s) {
    if (!fallbackIso) return null;
    return new Date(fallbackIso);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}+08:00`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return fallbackIso ? new Date(fallbackIso) : null;
  }
  return d;
}

function isExtraOffDisabledByEnv() {
  const disabled = String(process.env.VIP_BOOKING_EXTRA_OFF_DISABLED || '')
    .trim()
    .toLowerCase();
  if (disabled === '1' || disabled === 'true' || disabled === 'yes') return true;
  // 兼容舊開關：POINTS=0 即關閉
  const rawPoints = process.env.VIP_BOOKING_EXTRA_OFF_POINTS;
  if (rawPoints !== undefined && rawPoints !== '') {
    const points = Number(rawPoints);
    if (Number.isFinite(points) && points <= 0) return true;
  }
  return false;
}

function getVipBookingExtraFlatOffConfig(now = new Date()) {
  if (isExtraOffDisabledByEnv()) {
    return { active: false, mode: 'second_hour_half', from: null, until: null };
  }
  const from = parseEnvDate(
    process.env.VIP_BOOKING_EXTRA_OFF_FROM,
    DEFAULT_VIP_EXTRA_OFF_FROM,
    { endOfDay: false }
  );
  const untilRaw = process.env.VIP_BOOKING_EXTRA_OFF_UNTIL;
  const untilFallback = DEFAULT_VIP_EXTRA_OFF_UNTIL || null;
  const until = parseEnvDate(
    untilRaw === undefined || untilRaw === '' ? untilFallback : untilRaw,
    untilFallback,
    { endOfDay: true }
  );
  const t = now instanceof Date ? now : new Date(now);
  const afterFrom = !from || t >= from;
  const beforeUntil = !until || t <= until;
  const active = afterFrom && beforeUntil;
  return { active, mode: 'second_hour_half', from, until };
}

/**
 * VIP 價上「第二小時半價」減額。
 * @param {object} user
 * @param {Date} now 活動窗口參考時間（通常為下單當下）
 * @param {number} durationMinutes
 * @param {number} vipAmount VIP／會員倍率後總價（未扣第二小時優惠）
 */
function getVipBookingExtraFlatOff(
  user,
  now = new Date(),
  durationMinutes = 60,
  vipAmount = 0
) {
  if (!hasBookingVipDiscount(user)) return 0;
  if (!getVipBookingExtraFlatOffConfig(now).active) return 0;

  const amount = Number(vipAmount);
  const minutes = Number(durationMinutes);
  if (!(amount > 0) || !(minutes > 0)) return 0;

  // 只減「第二個小時」：超過 60 分嘅首 60 分內以半價計
  const secondMins = Math.min(60, Math.max(0, minutes - 60));
  if (secondMins <= 0) return 0;

  return Math.round(amount * (secondMins / minutes) * 0.5);
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

function bookingVipDiscountLabel(user, durationMinutes = 60, vipAmount = 0) {
  const level = resolveBookingDiscountLevel(user);
  const base = BOOKING_DISCOUNT_LABELS_ZH[level] || BOOKING_DISCOUNT_LABELS_ZH.basic;
  const extra = getVipBookingExtraFlatOff(user, new Date(), durationMinutes, vipAmount);
  if (extra > 0) return `${base}，${EXTRA_OFF_LABEL_ZH}`;
  // 窗口已開、時長達兩小時但未傳 vipAmount 時，仍提示優惠名
  if (
    hasBookingVipDiscount(user) &&
    getVipBookingExtraFlatOffConfig(new Date()).active &&
    Number(durationMinutes) > 60
  ) {
    return `${base}，${EXTRA_OFF_LABEL_ZH}`;
  }
  return base;
}

/** 牌價 → VIP／會員倍率價（未扣限時優惠） */
function applyBookingVipRateOnly(amount, user) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * getBookingDiscountRate(user));
}

/** 牌價 → VIP／會員價；限時再套「第二小時半價」（floor 0） */
function applyBookingVipDiscount(amount, user, now = new Date(), durationMinutes = 60) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  const afterRate = applyBookingVipRateOnly(n, user);
  const extra = getVipBookingExtraFlatOff(user, now, durationMinutes, afterRate);
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
  EXTRA_OFF_LABEL_ZH,
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
