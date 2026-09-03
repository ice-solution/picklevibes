const VIP_BOOKING_DISCOUNT_RATE = 0.8;
const ATHLETE_PAYMENT_LINK_RATE = 0.5;

function isAthleteRole(user) {
  return String(user?.role || '').toLowerCase() === 'athlete';
}

/** 訂場 VIP 8 折：VIP 會籍或選手 role */
function hasBookingVipDiscount(user) {
  if (!user) return false;
  if (isAthleteRole(user)) return true;
  return user.membershipLevel === 'vip';
}

function bookingVipDiscountLabel(user) {
  if (isAthleteRole(user)) return '選手／VIP 8折';
  if (user?.membershipLevel === 'vip') return 'VIP會員8折';
  return '無折扣';
}

function applyBookingVipDiscount(amount, user) {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * VIP_BOOKING_DISCOUNT_RATE);
}

function applyAthletePaymentLinkPrice(amount, user) {
  const n = Number(amount) || 0;
  if (!isAthleteRole(user) || n <= 0) return n;
  return Math.round(n * ATHLETE_PAYMENT_LINK_RATE * 100) / 100;
}

module.exports = {
  VIP_BOOKING_DISCOUNT_RATE,
  ATHLETE_PAYMENT_LINK_RATE,
  isAthleteRole,
  hasBookingVipDiscount,
  bookingVipDiscountLabel,
  applyBookingVipDiscount,
  applyAthletePaymentLinkPrice,
};
