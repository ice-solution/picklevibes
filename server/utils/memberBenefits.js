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
 * 訂場／收款連結身份折扣（VIP、付費會籍、選手）。
 * 月卡全免邏輯在 monthlyPassService + paymentLinkPaymentService.resolvePaymentLinkPrices。
 */

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
  return BOOKING_DISCOUNT_LABELS_ZH[level] || BOOKING_DISCOUNT_LABELS_ZH.basic;
}

function applyBookingVipDiscount(amount, user) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  const rate = getBookingDiscountRate(user);
  return Math.round(n * rate);
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
  applyBookingVipDiscount,
  applyAthletePaymentLinkPrice,
  getBookingDiscountRate,
  resolveBookingDiscountLevel,
  resolveMaxAdvanceDays,
};
