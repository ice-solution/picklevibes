import type { Location } from 'react-router-dom';
import type { User } from '../contexts/AuthContext';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password']);

const STORE_ADMIN_PATH = /^\/store\/([^/]+)\/admin(?:\/|$)/;

export type StoreMembershipRole = 'manager' | 'staff' | 'shareholder' | 'platform';

export function parseStoreSlugFromAdminPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(STORE_ADMIN_PATH);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

export function canOpenAdminV2(user?: User | null): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  return user.role === 'staff' && (user.managedStores?.length ?? 0) > 0;
}

/** 跨店取最高權限：manager > staff > shareholder */
export function getEffectiveStoreRole(user?: User | null): StoreMembershipRole | null {
  if (!user) return null;
  if (user.isPlatformAdmin || user.role === 'admin') return 'platform';
  if (user.role !== 'staff') return null;
  const roles = (user.managedStores || []).map((s) =>
    String(s.membershipRole || 'staff').toLowerCase()
  );
  if (roles.some((r) => r === 'manager')) return 'manager';
  if (roles.some((r) => r === 'staff')) return 'staff';
  if (roles.some((r) => r === 'shareholder')) return 'shareholder';
  return user.managedStores?.length ? 'staff' : null;
}

export function getDefaultHomeForUser(user?: User | null): string {
  if (!user) return '/my-bookings';
  if (canOpenAdminV2(user)) return '/admin-v2';
  return '/my-bookings';
}

export function getPostAuthRedirectPath(
  from?: Location | null,
  user?: User | null,
  fallback?: string
): string {
  const defaultFallback = fallback ?? getDefaultHomeForUser(user);
  if (!from?.pathname || AUTH_PATHS.has(from.pathname)) {
    return defaultFallback;
  }
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

export function canAccessStoreAdmin(user: User | null | undefined, storeSlug: string): boolean {
  if (!user || !storeSlug) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  return (user.managedStores || []).some((s) => s.slug === storeSlug);
}

export function getMembershipRoleForStore(
  user: User | null | undefined,
  storeSlug: string
): StoreMembershipRole | null {
  if (!user || !storeSlug) return null;
  if (user.isPlatformAdmin || user.role === 'admin') return 'platform';
  const match = (user.managedStores || []).find((s) => s.slug === storeSlug);
  if (!match) return null;
  const r = String(match.membershipRole || 'staff').toLowerCase();
  if (r === 'manager') return 'manager';
  if (r === 'shareholder') return 'shareholder';
  return 'staff';
}

export function storeRoleLabel(role: StoreMembershipRole | null | undefined): string {
  if (role === 'platform') return '平台管理員';
  if (role === 'manager') return '店長';
  if (role === 'shareholder') return '股東';
  if (role === 'staff') return '店員';
  return '';
}
