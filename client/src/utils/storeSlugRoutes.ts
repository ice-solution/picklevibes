/** 不可作為店鋪 slug 的單段路徑（與 App 靜態路由一致） */
export const RESERVED_STORE_SLUG_SEGMENTS = new Set([
  'about',
  'account',
  'activities',
  'admin',
  'admin-v2',
  'balance',
  'booking',
  'cart',
  'checkout',
  'coach',
  'coach-calendar',
  'coach-courses',
  'dashboard',
  'faq',
  'forgot-password',
  'game',
  'login',
  'maintenance',
  'orders',
  'payment-result',
  'pickcourt',
  'picklecourt',
  'picklevibes',
  'pricing',
  'privacy',
  'recharge',
  'recharge-success',
  'register',
  'reset-password',
  'search',
  'shop',
  'store',
  'terms',
  'tournaments',
  'vlog',
]);

export function isReservedStoreSlug(slug: string): boolean {
  const s = String(slug || '').trim().toLowerCase();
  if (!s) return true;
  return RESERVED_STORE_SLUG_SEGMENTS.has(s);
}
