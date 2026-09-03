export const VIP_BOOKING_DISCOUNT_RATE = 0.8;
export const ATHLETE_PAYMENT_LINK_RATE = 0.5;

type DiscountUser = {
  role?: string | null;
  membershipLevel?: string | null;
} | null | undefined;

export function isAthleteRole(user: DiscountUser): boolean {
  return String(user?.role || '').toLowerCase() === 'athlete';
}

export function hasBookingVipDiscount(user: DiscountUser): boolean {
  if (!user) return false;
  if (isAthleteRole(user)) return true;
  return user.membershipLevel === 'vip';
}

export function applyBookingVipDiscount(amount: number, user: DiscountUser): number {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * VIP_BOOKING_DISCOUNT_RATE);
}

export function applyAthletePaymentLinkPrice(amount: number, user: DiscountUser): number {
  const n = Number(amount) || 0;
  if (!isAthleteRole(user) || n <= 0) return n;
  return Math.round(n * ATHLETE_PAYMENT_LINK_RATE * 100) / 100;
}
