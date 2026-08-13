/**
 * 店鋪員工角色權限（TenantMembership.role）
 * - staff 店員
 * - manager 店長
 * - shareholder 股東（唯讀）
 */

const MEMBERSHIP_ROLES = ['manager', 'staff', 'shareholder'];

const ROLE_LABELS = {
  manager: '店長',
  staff: '店員',
  shareholder: '股東',
  platform: '平台管理員',
};

/** 店鋪後台 tab id → 所需模組權限 */
const TAB_MODULE = {
  bookings: 'bookings',
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

/** 各角色可進入的模組（manager = 全部） */
const ROLE_MODULES = {
  staff: new Set([
    'calendar',
    'shop',
    'orders',
    'activities',
    'regularActivities',
  ]),
  manager: null, // all
  shareholder: new Set([
    'analytics',
    'reports',
    'accounting',
    'calendar',
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

function modulesForRole(role) {
  if (role === 'platform' || role === 'manager') return null;
  return ROLE_MODULES[normalizeMembershipRole(role)] || ROLE_MODULES.staff;
}

function canAccessModule(role, moduleKey) {
  if (!moduleKey) return true;
  if (role === 'platform' || role === 'manager') return true;
  const set = modulesForRole(role);
  if (!set) return true;
  return set.has(moduleKey);
}

function canAccessTab(role, tabId) {
  const mod = TAB_MODULE[tabId];
  if (!mod) return role === 'platform' || role === 'manager';
  return canAccessModule(role, mod);
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

/**
 * 股東唯讀：阻擋寫入。
 * 有指定 store 時依該店角色；否則若用戶全部 membership 皆為 shareholder 則阻擋。
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

function listTabsForRole(role) {
  const ids = Object.keys(TAB_MODULE);
  return ids.filter((id) => canAccessTab(role, id));
}

module.exports = {
  MEMBERSHIP_ROLES,
  ROLE_LABELS,
  TAB_MODULE,
  ROLE_MODULES,
  normalizeMembershipRole,
  roleLabel,
  modulesForRole,
  canAccessModule,
  canAccessTab,
  isReadOnlyRole,
  getMembershipRoleOnStore,
  assertNotShareholderWrite,
  listTabsForRole,
};
