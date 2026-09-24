/** Vibe 付費會籍（疊在註冊 VIP 之上；到期後回到 vip） */
const MEMBERSHIP_LEVELS = ['basic', 'vip', 'silver', 'gold', 'platinum'];
const PAID_MEMBERSHIP_TIERS = ['silver', 'gold', 'platinum'];

/**
 * 場租折扣倍率（越小越優惠）
 * 付費級係「VIP 價再打 X 折」：VIP 0.8 × 級別倍率
 * 例：銀級 = 0.8 × 0.95 = 0.76
 */
const VIP_BASE_RATE = 0.8;
const PAID_TIER_EXTRA_RATE = {
  silver: 0.95, // VIP 價再 9.5 折
  gold: 0.9,
  platinum: 0.85,
};
const BOOKING_DISCOUNT_RATE_BY_LEVEL = {
  basic: 1,
  vip: VIP_BASE_RATE,
  silver: VIP_BASE_RATE * PAID_TIER_EXTRA_RATE.silver,
  gold: VIP_BASE_RATE * PAID_TIER_EXTRA_RATE.gold,
  platinum: VIP_BASE_RATE * PAID_TIER_EXTRA_RATE.platinum,
};

/** 會籍額外可預約天數（0 = 只跟 role） */
const MAX_ADVANCE_DAYS_BY_MEMBERSHIP = {
  basic: 0,
  vip: 0,
  silver: 21,
  gold: 28,
  platinum: 60,
};

const GRANT_MONTHS_BY_TIER = {
  silver: 12,
  gold: 18,
  platinum: 36,
};

const MEMBERSHIP_LABELS_ZH = {
  basic: '普通會員',
  vip: 'VIP會員',
  silver: 'SILVER 銀級',
  gold: 'GOLD 金級',
  platinum: 'PLATINUM 白金級',
};

const BOOKING_DISCOUNT_LABELS_ZH = {
  basic: '無折扣',
  vip: 'VIP會員8折',
  silver: '會員折扣（VIP價再9.5折）',
  gold: '會員折扣（VIP價再9折）',
  platinum: '會員折扣（VIP價再8.5折）',
  athlete: '選手／VIP 8折',
};

/** /vips 對應嘅三個充值入會方案 */
const VIBE_TIER_RECHARGE_OFFERS = [
  {
    name: 'SILVER 銀級入會',
    points: 18000,
    amount: 15000,
    description: '入會 $15,000 獲 $18,000 積分 · 銀級 12 個月 · VIP價再9.5折 · 提前 21 日預訂',
    sortOrder: 10,
    grantMembershipLevel: 'silver',
    grantMembershipMonths: 12,
  },
  {
    name: 'GOLD 金級入會',
    points: 38000,
    amount: 30000,
    description: '入會 $30,000 獲 $38,000 積分 · 金級 18 個月 · VIP價再9折 · 提前 28 日預訂',
    sortOrder: 20,
    grantMembershipLevel: 'gold',
    grantMembershipMonths: 18,
  },
  {
    name: 'PLATINUM 白金級入會',
    points: 66666,
    amount: 50000,
    description: '入會 $50,000 獲 $66,666 積分 · 白金級 36 個月 · VIP價再8.5折 · 提前 60 日預訂',
    sortOrder: 30,
    grantMembershipLevel: 'platinum',
    grantMembershipMonths: 36,
  },
];

function isPaidMembershipTier(level) {
  return PAID_MEMBERSHIP_TIERS.includes(String(level || ''));
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  // 處理月底溢出（例如 1/31 + 1 月）
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

module.exports = {
  MEMBERSHIP_LEVELS,
  PAID_MEMBERSHIP_TIERS,
  VIP_BASE_RATE,
  PAID_TIER_EXTRA_RATE,
  BOOKING_DISCOUNT_RATE_BY_LEVEL,
  MAX_ADVANCE_DAYS_BY_MEMBERSHIP,
  GRANT_MONTHS_BY_TIER,
  MEMBERSHIP_LABELS_ZH,
  BOOKING_DISCOUNT_LABELS_ZH,
  VIBE_TIER_RECHARGE_OFFERS,
  isPaidMembershipTier,
  addMonths,
};
