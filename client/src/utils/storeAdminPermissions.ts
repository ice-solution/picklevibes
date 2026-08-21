/** 與 server/utils/tenantPermissions.js 對齊的店鋪後台權限 */

import type { User, ManagedStore } from '../contexts/AuthContext';
import type { StoreMembershipRole } from './authRedirect';

export type { StoreMembershipRole };

export const MODULE_CATALOG: { key: string; label: string }[] = [
  { key: 'bookings', label: '預約管理' },
  { key: 'calendar', label: '預約日曆' },
  { key: 'courts', label: '場地管理' },
  { key: 'activities', label: '活動管理' },
  { key: 'regularActivities', label: '恆常活動' },
  { key: 'shop', label: '商店管理' },
  { key: 'orders', label: '訂單管理' },
  { key: 'pos', label: 'POS 收銀' },
  { key: 'redeem', label: '兌換券' },
  { key: 'rechargeOffers', label: '充值優惠' },
  { key: 'paymentLinks', label: '收款連結' },
  { key: 'accounting', label: '會計' },
  { key: 'coachRequests', label: '教練要請' },
  { key: 'weekend', label: '假期管理' },
  { key: 'bookingConfig', label: '預約設定' },
  { key: 'analytics', label: '數據分析' },
  { key: 'reports', label: '報告' },
];

const TAB_MODULE: Record<string, string> = {
  bookings: 'bookings',
  'pending-settle': 'bookings',
  calendar: 'calendar',
  courts: 'courts',
  activities: 'activities',
  'regular-activities': 'regularActivities',
  shop: 'shop',
  orders: 'orders',
  pos: 'pos',
  redeem: 'redeem',
  'recharge-offers': 'rechargeOffers',
  'payment-links': 'paymentLinks',
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
  staff: new Set([
    'calendar',
    'shop',
    'orders',
    'pos',
    'activities',
    'regularActivities',
    'paymentLinks',
  ]),
  manager: null,
  platform: null,
  shareholder: new Set([
    'analytics',
    'reports',
    'accounting',
    'calendar',
    'paymentLinks',
  ]),
};

export function defaultModulesForRole(role: StoreMembershipRole | null | undefined): string[] | null {
  if (!role || role === 'platform' || role === 'manager') return null;
  const set = ROLE_MODULES[role];
  return set ? Array.from(set) : null;
}

/**
 * 解析最終可存取模組。null = 全部。
 * customModules 非空時覆寫角色預設。
 */
export function resolveModules(
  role: StoreMembershipRole | null | undefined,
  customModules?: string[] | null
): string[] | null {
  if (!role) return [];
  if (role === 'platform' || role === 'manager') return null;
  if (Array.isArray(customModules) && customModules.length > 0) {
    const allowed = new Set(MODULE_CATALOG.map((m) => m.key));
    return Array.from(new Set(customModules.filter((k) => allowed.has(k))));
  }
  return defaultModulesForRole(role);
}

export function canAccessStoreTab(
  role: StoreMembershipRole | null | undefined,
  tabId: string,
  customModules?: string[] | null
): boolean {
  if (!role) return false;
  const resolved = resolveModules(role, customModules);
  if (resolved == null) return true;
  const mod = TAB_MODULE[tabId];
  if (!mod) return false;
  return resolved.includes(mod);
}

export function isStoreReadOnly(role: StoreMembershipRole | null | undefined): boolean {
  return role === 'shareholder';
}

export function canAccessAdminV2Tab(
  role: StoreMembershipRole | null | undefined,
  tabId: string,
  customModules?: string[] | null
): boolean {
  if (role === 'platform') return true;
  if (!role) return false;
  if (PLATFORM_ONLY_TABS.has(tabId)) return false;
  return canAccessStoreTab(role, tabId, customModules);
}

/** AdminV2：任一 managed store 有該 tab 權限即可見 */
export function canAccessAdminV2TabForUser(user: User | null | undefined, tabId: string): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  if (PLATFORM_ONLY_TABS.has(tabId)) return false;
  const stores = user.managedStores || [];
  return stores.some((s) => {
    const role = normalizeRole(s.membershipRole);
    return canAccessStoreTab(role, tabId, s.modules);
  });
}

export function getModulesForManagedStore(store: ManagedStore | undefined): string[] | null {
  if (!store) return [];
  const role = normalizeRole(store.membershipRole);
  return resolveModules(role, store.modules);
}

function normalizeRole(role?: string | null): StoreMembershipRole {
  const r = String(role || 'staff').toLowerCase();
  if (r === 'manager') return 'manager';
  if (r === 'shareholder') return 'shareholder';
  if (r === 'platform') return 'platform';
  return 'staff';
}
