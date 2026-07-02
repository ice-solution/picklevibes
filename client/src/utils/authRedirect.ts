import type { Location } from 'react-router-dom';
import type { User } from '../contexts/AuthContext';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/pickcourt/login', '/picklecourt/login']);

const STORE_ADMIN_PATH = /^\/store\/([^/]+)\/admin(?:\/|$)/;
const STORE_LOGIN_PATH = /^\/store\/([^/]+)\/login$/;

/** 從店鋪後台 path 解析 slug，例如 /store/lai-chi-kok/admin */
export function parseStoreSlugFromAdminPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(STORE_ADMIN_PATH);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

export function getStoreLoginPath(storeSlug: string): string {
  return `/store/${encodeURIComponent(storeSlug)}/login`;
}

function isAuthPath(pathname: string): boolean {
  if (AUTH_PATHS.has(pathname)) return true;
  return STORE_LOGIN_PATH.test(pathname);
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

  if (!from?.pathname || isAuthPath(from.pathname)) {
    return defaultFallback;
  }
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

export function canAccessStoreAdmin(user: User | null | undefined, storeSlug: string): boolean {
  if (!user || !storeSlug) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  return (user.managedStores || []).some((s) => s.slug === storeSlug);
}
