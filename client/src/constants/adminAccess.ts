/** 後台角色與分頁權限（前端） */

export type AdminRole = 'super_admin' | 'admin' | 'staff' | 'user' | 'coach';

export interface ManagedStoreRef {
  _id: string;
  name?: string;
  slug?: string;
}

export interface AdminUserFields {
  role: string;
  adminRole?: AdminRole;
  managedStores?: ManagedStoreRef[] | string[];
  canBypassBooking?: boolean;
  isSuperAdmin?: boolean;
}

export function normalizeAdminRole(role?: string): AdminRole | string {
  return role || 'user';
}

export function canAccessAdminPanel(user?: AdminUserFields | null): boolean {
  const r = normalizeAdminRole(user?.adminRole || user?.role);
  return r === 'super_admin' || r === 'admin' || r === 'staff';
}

export function isSuperAdmin(user?: AdminUserFields | null): boolean {
  const r = normalizeAdminRole(user?.adminRole || user?.role);
  if (r === 'super_admin') return true;
  if (r === 'admin') {
    const stores = user?.managedStores || [];
    return stores.length === 0;
  }
  return false;
}

export function isStaff(user?: AdminUserFields | null): boolean {
  return normalizeAdminRole(user?.adminRole || user?.role) === 'staff';
}

export function canBypassBooking(user?: AdminUserFields | null): boolean {
  if (user?.canBypassBooking != null) return user.canBypassBooking;
  const r = normalizeAdminRole(user?.adminRole || user?.role);
  return r === 'super_admin' || r === 'admin';
}

const STAFF_TABS = new Set(['bookings', 'calendar']);
const SUPER_ONLY_TABS = new Set(['users', 'maintenance', 'bulk-upgrade']);

export function canSeeAdminTab(tabId: string, user?: AdminUserFields | null): boolean {
  if (!canAccessAdminPanel(user)) return false;
  const role = normalizeAdminRole(user?.adminRole || user?.role);
  if (role === 'staff') return STAFF_TABS.has(tabId);
  if (SUPER_ONLY_TABS.has(tabId) && role !== 'super_admin') return false;
  return true;
}

export function adminRoleLabel(role?: string): string {
  const r = normalizeAdminRole(role);
  switch (r) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return '店鋪 Admin';
    case 'staff':
      return 'Staff';
    case 'coach':
      return '教練';
    default:
      return '用戶';
  }
}
