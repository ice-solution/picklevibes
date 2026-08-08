import type { Location } from 'react-router-dom';
import type { User } from '../contexts/AuthContext';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password']);

const STORE_ADMIN_PATH = /^\/store\/([^/]+)\/admin(?:\/|$)/;

export function parseStoreSlugFromAdminPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(STORE_ADMIN_PATH);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

export function getDefaultHomeForUser(user?: User | null): string {
  if (!user) return '/my-bookings';
  if (user.isPlatformAdmin || user.role === 'admin') return '/admin-v2';
  if (user.role === 'staff' && user.managedStores?.length) {
    return `/store/${user.managedStores[0].slug}/admin`;
  }
  return '/my-bookings';
}

/**
 * 登入／註冊成功後要回到的 path（含 query，例如 game join 的 sig、code）
 */
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
): 'manager' | 'staff' | 'platform' | null {
  if (!user || !storeSlug) return null;
  if (user.isPlatformAdmin || user.role === 'admin') return 'platform';
  const match = (user.managedStores || []).find((s) => s.slug === storeSlug);
  if (!match) return null;
  return match.membershipRole === 'manager' ? 'manager' : 'staff';
}
