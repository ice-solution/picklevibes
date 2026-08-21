/**
 * 店鋪員工角色權限（TenantMembership.role）
 * - staff 店員
 * - manager 店長
 * - shareholder 股東（唯讀）
 * 可另設 modules 覆寫預設模組清單
 */

const MEMBERSHIP_ROLES = ['manager', 'staff', 'shareholder'];

const ROLE_LABELS = {
  manager: '店長',
  staff: '店員',
  shareholder: '股東',
  platform: '平台管理員',
};

/** 全部可設定模組（key → 顯示名） */
const MODULE_CATALOG = [
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

const ALL_MODULE_KEYS = MODULE_CATALOG.map((m) => m.key);

/** 店鋪後台 tab id → 所需模組權限 */
const TAB_MODULE = {
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

/** 各角色預設模組（manager = null 表示全部） */
const ROLE_MODULES = {
  staff: new Set([
    'calendar',
    'shop',
    'orders',
    'pos',
    'activities',
    'regularActivities',
    'paymentLinks',
  ]),
  manager: null, // all
  shareholder: new Set([
    'analytics',
    'reports',
    'accounting',
    'calendar',
    'paymentLinks',
  ]),
};

function normalizeMembershipRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'manager' || r === 'staff' || r === 'shareholder') return r;
  return 'staff';
}

function roleLabel(role) {
  return ROLE_LABELS[normalizeMembershipRole(role)] || ROLE_LABELS.staff;
}

function defaultModulesForRole(role) {
  if (role === 'platform' || role === 'manager') return null;
  const set = ROLE_MODULES[normalizeMembershipRole(role)] || ROLE_MODULES.staff;
  return set ? [...set] : null;
}

/**
 * 解析最終可存取模組
 * @returns {string[]|null} null = 全部模組
 */
function resolveModules(role, customModules) {
  if (role === 'platform') return null;
  if (Array.isArray(customModules) && customModules.length > 0) {
    const allowed = new Set(ALL_MODULE_KEYS);
    return [...new Set(customModules.map(String).filter((k) => allowed.has(k)))];
  }
  if (role === 'manager') return null;
  return defaultModulesForRole(role);
}

function modulesForRole(role) {
  if (role === 'platform' || role === 'manager') return null;
  return ROLE_MODULES[normalizeMembershipRole(role)] || ROLE_MODULES.staff;
}

function canAccessModule(role, moduleKey, customModules) {
  if (!moduleKey) return true;
  if (role === 'platform') return true;
  const resolved = resolveModules(role, customModules);
  if (resolved == null) return true;
  return resolved.includes(moduleKey);
}

function canAccessTab(role, tabId, customModules) {
  const mod = TAB_MODULE[tabId];
  if (!mod) return role === 'platform' || role === 'manager';
  return canAccessModule(role, mod, customModules);
}

function isReadOnlyRole(role) {
  return normalizeMembershipRole(role) === 'shareholder' || role === 'shareholder';
}

function getMembershipRoleOnStore(tenantAccess, storeId) {
  if (!tenantAccess) return null;
  if (tenantAccess.isPlatformAdmin) return 'platform';
  if (!storeId) return null;
  const mems = tenantAccess.memberships || [];
  const hit = mems.find((m) => {
    const sid = m.store?._id || m.store;
    return String(sid) === String(storeId);
  });
  return hit ? normalizeMembershipRole(hit.role) : null;
}

function getMembershipModulesOnStore(tenantAccess, storeId) {
  if (!tenantAccess || tenantAccess.isPlatformAdmin) return null;
  if (!storeId) return null;
  const managed = (tenantAccess.managedStores || []).find(
    (s) => String(s.id) === String(storeId)
  );
  if (managed && Object.prototype.hasOwnProperty.call(managed, 'modules')) {
    return managed.modules;
  }
  const mems = tenantAccess.memberships || [];
  const hit = mems.find((m) => {
    const sid = m.store?._id || m.store;
    return String(sid) === String(storeId);
  });
  return hit?.modules || null;
}

/**
 * 股東唯讀：阻擋寫入。
 */
function assertNotShareholderWrite(tenantAccess, storeId) {
  if (!tenantAccess || tenantAccess.isPlatformAdmin) {
    return { ok: true };
  }
  if (storeId) {
    const role = getMembershipRoleOnStore(tenantAccess, storeId);
    if (role === 'shareholder') {
      return { ok: false, status: 403, message: '股東帳號僅可唯讀瀏覽，無法進行變更' };
    }
    return { ok: true };
  }
  const mems = tenantAccess.memberships || [];
  if (mems.length > 0 && mems.every((m) => normalizeMembershipRole(m.role) === 'shareholder')) {
    return { ok: false, status: 403, message: '股東帳號僅可唯讀瀏覽，無法進行變更' };
  }
  return { ok: true };
}

function listTabsForRole(role, customModules) {
  const ids = Object.keys(TAB_MODULE);
  return ids.filter((id) => canAccessTab(role, id, customModules));
}

function sanitizeModulesInput(modules) {
  if (modules == null) return null;
  if (!Array.isArray(modules)) return null;
  if (modules.length === 0) return [];
  const allowed = new Set(ALL_MODULE_KEYS);
  return [...new Set(modules.map(String).filter((k) => allowed.has(k)))];
}

module.exports = {
  MEMBERSHIP_ROLES,
  ROLE_LABELS,
  MODULE_CATALOG,
  ALL_MODULE_KEYS,
  TAB_MODULE,
  ROLE_MODULES,
  normalizeMembershipRole,
  roleLabel,
  defaultModulesForRole,
  resolveModules,
  modulesForRole,
  canAccessModule,
  canAccessTab,
  isReadOnlyRole,
  getMembershipRoleOnStore,
  getMembershipModulesOnStore,
  assertNotShareholderWrite,
  listTabsForRole,
  sanitizeModulesInput,
};
