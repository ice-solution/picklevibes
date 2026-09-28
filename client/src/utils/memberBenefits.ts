export const VIP_BOOKING_DISCOUNT_RATE = 0.8;
export const ATHLETE_PAYMENT_LINK_RATE = 0.5;

/** 付費級額外倍率（疊在 VIP 0.8 之上） */
const PAID_TIER_EXTRA_RATE: Record<string, number> = {
  silver: 0.95,
  gold: 0.9,
  platinum: 0.85,
};

const BOOKING_DISCOUNT_RATE_BY_LEVEL: Record<string, number> = {
  basic: 1,
  vip: VIP_BOOKING_DISCOUNT_RATE,
  silver: VIP_BOOKING_DISCOUNT_RATE * PAID_TIER_EXTRA_RATE.silver,
  gold: VIP_BOOKING_DISCOUNT_RATE * PAID_TIER_EXTRA_RATE.gold,
  platinum: VIP_BOOKING_DISCOUNT_RATE * PAID_TIER_EXTRA_RATE.platinum,
};

const MAX_ADVANCE_DAYS_BY_MEMBERSHIP: Record<string, number> = {
  basic: 0,
  vip: 0,
  silver: 21,
  gold: 28,
  platinum: 60,
};

const BOOKING_DISCOUNT_LABELS_ZH: Record<string, string> = {
  basic: '無折扣',
  vip: 'VIP會員8折',
  silver: '會員折扣（VIP價再9.5折）',
  gold: '會員折扣（VIP價再9折）',
  platinum: '會員折扣（VIP價再8.5折）',
  athlete: '選手／VIP 8折',
};

/** 限時 VIP 價再減（需同 server/utils/memberBenefits.js 對齊） */
const DEFAULT_VIP_EXTRA_OFF_POINTS = 88;
const DEFAULT_VIP_EXTRA_OFF_FROM = '2026-09-29T00:00:00+08:00';
const DEFAULT_VIP_EXTRA_OFF_UNTIL = '2026-10-29T23:59:59.999+08:00';

type DiscountUser = {
  role?: string | null;
  membershipLevel?: string | null;
} | null | undefined;

function parseCampaignDate(raw: string | undefined, fallbackIso: string, endOfDay = false): Date {
  const s = String(raw || '').trim();
  if (!s) return new Date(fallbackIso);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T${endOfDay ? '23:59:59.999' : '00:00:00'}+08:00`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date(fallbackIso) : d;
}

export function getVipBookingExtraFlatOffConfig(now: Date = new Date()): {
  active: boolean;
  points: number;
} {
  const rawPoints = process.env.REACT_APP_VIP_BOOKING_EXTRA_OFF_POINTS;
  const points =
    rawPoints === undefined || rawPoints === ''
      ? DEFAULT_VIP_EXTRA_OFF_POINTS
      : Number(rawPoints);
  if (!Number.isFinite(points) || points <= 0) {
    return { active: false, points: 0 };
  }
  const from = parseCampaignDate(
    process.env.REACT_APP_VIP_BOOKING_EXTRA_OFF_FROM,
    DEFAULT_VIP_EXTRA_OFF_FROM,
    false
  );
  const until = parseCampaignDate(
    process.env.REACT_APP_VIP_BOOKING_EXTRA_OFF_UNTIL,
    DEFAULT_VIP_EXTRA_OFF_UNTIL,
    true
  );
  const active = now >= from && now <= until;
  return { active, points: active ? points : 0 };
}

export function getVipBookingExtraFlatOff(user: DiscountUser, now: Date = new Date()): number {
  if (!hasBookingVipDiscount(user)) return 0;
  return getVipBookingExtraFlatOffConfig(now).points;
}

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

/** 僅倍率，未扣限時固定減額 */
export function applyBookingVipRateOnly(amount: number, user: DiscountUser): number {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  return Math.round(n * getBookingDiscountRate(user));
}

export function applyBookingVipDiscount(amount: number, user: DiscountUser, now: Date = new Date()): number {
  const n = Number(amount) || 0;
  if (!hasBookingVipDiscount(user) || n <= 0) return n;
  const afterRate = applyBookingVipRateOnly(n, user);
  const extra = getVipBookingExtraFlatOff(user, now);
  return Math.max(0, afterRate - extra);
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

export function bookingMembershipDiscountLabelZh(user: DiscountUser): string {
  const level = resolveBookingDiscountLevel(user);
  const base = BOOKING_DISCOUNT_LABELS_ZH[level] || BOOKING_DISCOUNT_LABELS_ZH.basic;
  const extra = getVipBookingExtraFlatOff(user);
  if (extra > 0) return `${base}，周年減價`;
  return base;
}

export function membershipDiscountLabelZh(level?: string | null): string {
  switch (level) {
    case 'vip':
      return '場租 VIP 8 折';
    case 'silver':
      return '場租：VIP 價再 9.5 折';
    case 'gold':
      return '場租：VIP 價再 9 折';
    case 'platinum':
      return '場租：VIP 價再 8.5 折';
    default:
      return '無場租折扣';
  }
}

/** 會籍權益說明（給「我的」顯示） */
export function getMembershipPerkLines(level?: string | null): string[] {
  const days = MAX_ADVANCE_DAYS_BY_MEMBERSHIP[String(level || 'basic')] || 0;
  const lines = [membershipDiscountLabelZh(level)];
  if (days > 0) {
    lines.push(`可提前 ${days} 日預約`);
  } else if (level === 'vip') {
    lines.push('預約天數跟一般會員身份（可再升級銀／金／白金延長）');
  }
  if (level === 'silver' || level === 'gold' || level === 'platinum') {
    lines.push('到期後自動回到 VIP 常駐');
  } else if (level === 'vip') {
    lines.push('註冊 VIP；到期前系統會自動續期');
  }
  return lines;
}

export function formatMembershipExpiryZh(
  expiry?: string | Date | null,
  level?: string | null
): string {
  if (!expiry) {
    if (level === 'vip') return '有效（自動續期）';
    if (level === 'silver' || level === 'gold' || level === 'platinum') return '未設定到期日';
    return '—';
  }
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const now = new Date();
  if (d < now) return `已於 ${dateStr} 到期`;
  if (level === 'vip') return `有效至 ${dateStr}（到期前自動續期）`;
  return `有效至 ${dateStr}`;
}
