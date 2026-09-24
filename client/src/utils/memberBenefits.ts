export const VIP_BOOKING_DISCOUNT_RATE = 0.8;
export const ATHLETE_PAYMENT_LINK_RATE = 0.5;

const BOOKING_DISCOUNT_RATE_BY_LEVEL: Record<string, number> = {
  basic: 1,
  vip: 0.8,
  silver: 0.95,
  gold: 0.9,
  platinum: 0.85,
};

const MAX_ADVANCE_DAYS_BY_MEMBERSHIP: Record<string, number> = {
  basic: 0,
  vip: 0,
  silver: 21,
  gold: 28,
  platinum: 60,
};

type DiscountUser = {
  role?: string | null;
  membershipLevel?: string | null;
} | null | undefined;

export function isAthleteRole(user: DiscountUser): boolean {
  return String(user?.role || '').toLowerCase() === 'athlete';
}

function resolveBookingDiscountLevel(user: DiscountUser): string {
  if (!user) return 'basic';
  if (isAthleteRole(user)) return 'athlete';
  const level = String(user.membershipLevel || 'basic');
  if (level === 'vip' || level === 'silver' || level === 'gold' || level === 'platinum') {
    return level;
  }
  return 'basic';
}

export function getBookingDiscountRate(user: DiscountUser): number {
  const level = resolveBookingDiscountLevel(user);
  if (level === 'athlete') return VIP_BOOKING_DISCOUNT_RATE;
  return BOOKING_DISCOUNT_RATE_BY_LEVEL[level] ?? 1;
}

export function hasBookingVipDiscount(user: DiscountUser): boolean {
  if (!user) return false;
  return getBookingDiscountRate(user) < 1;
}

export function applyBookingVipDiscount(amount: number, user: DiscountUser): number {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * getBookingDiscountRate(user));
}

export function applyAthletePaymentLinkPrice(amount: number, user: DiscountUser): number {
  const n = Number(amount) || 0;
  if (!isAthleteRole(user) || n <= 0) return n;
  return Math.round(n * ATHLETE_PAYMENT_LINK_RATE * 100) / 100;
}

export function resolveMaxAdvanceDays(
  user: DiscountUser,
  maxAdvanceDaysByRole: Record<string, number> = {}
): number {
  const role = String(user?.role || 'user');
  const roleDays = Number(maxAdvanceDaysByRole[role] ?? maxAdvanceDaysByRole.user ?? 7) || 7;
  const level = String(user?.membershipLevel || 'basic');
  const membershipDays = Number(MAX_ADVANCE_DAYS_BY_MEMBERSHIP[level] || 0) || 0;
  return Math.max(roleDays, membershipDays);
}

export function membershipLevelLabelZh(level?: string | null): string {
  switch (level) {
    case 'vip':
      return 'VIP會員';
    case 'silver':
      return 'SILVER 銀級';
    case 'gold':
      return 'GOLD 金級';
    case 'platinum':
      return 'PLATINUM 白金級';
    case 'premium':
      return '高級會員';
    default:
      return '普通會員';
  }
}
