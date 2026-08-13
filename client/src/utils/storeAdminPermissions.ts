/** 與 server/utils/tenantPermissions.js 對齊的店鋪後台權限 */

export type StoreMembershipRole = 'manager' | 'staff' | 'shareholder' | 'platform';

const TAB_MODULE: Record<string, string> = {
  bookings: 'bookings',
  'pending-settle': 'bookings',
  calendar: 'calendar',
  courts: 'courts',
  activities: 'activities',
  'regular-activities': 'regularActivities',
  shop: 'shop',
  orders: 'orders',
  redeem: 'redeem',
  'recharge-offers': 'rechargeOffers',
  accounting: 'accounting',
  'coach-requests': 'coachRequests',
  weekend: 'weekend',
  'booking-config': 'bookingConfig',
  analytics: 'analytics',
  reports: 'reports',
};

/** admin-v2 僅平台管理員可見 */
const PLATFORM_ONLY_TABS = new Set([
  'stores',
  'tenant-staff',
  'users',
  'tiers',
  'vlogs',
  'hotnews',
  'game-halls',
  'game-clients',
  'game-leaderboard',
  'edm',
  'application-forms',
  'bulk-upgrade',
  'maintenance',
]);

const ROLE_MODULES: Record<string, Set<string> | null> = {
  staff: new Set(['calendar', 'shop', 'orders', 'activities', 'regularActivities']),
  manager: null,
  platform: null,
  shareholder: new Set(['analytics', 'reports', 'accounting', 'calendar']),
};

export function canAccessStoreTab(
  role: StoreMembershipRole | null | undefined,
  tabId: string
): boolean {
  if (!role) return false;
  const modules = ROLE_MODULES[role];
  if (modules == null) return true;
  const mod = TAB_MODULE[tabId];
  if (!mod) return false;
  return modules.has(mod);
}

export function isStoreReadOnly(role: StoreMembershipRole | null | undefined): boolean {
  return role === 'shareholder';
}

export function canAccessAdminV2Tab(
  role: StoreMembershipRole | null | undefined,
  tabId: string
): boolean {
  if (role === 'platform') return true;
  if (!role) return false;
  if (PLATFORM_ONLY_TABS.has(tabId)) return false;
  return canAccessStoreTab(role, tabId);
}
