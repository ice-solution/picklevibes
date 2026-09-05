import type { Location } from 'react-router-dom';
import type { User } from '../contexts/AuthContext';
import { PICKCOURT_ACCOUNT } from './pickcourtRoutes';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/pickcourt/login', '/picklecourt/login']);

const STORE_ADMIN_PATH = /^\/store\/([^/]+)\/admin(?:\/|$)/;
const STORE_LOGIN_PATH = /^\/store\/([^/]+)\/login$/;

/** 從店鋪後台 path 解析 slug，例如 /store/lai-chi-kok/admin */
export function parseStoreSlugFromAdminPath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(STORE_ADMIN_PATH);
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

/** 從任意店鋪路徑解析 slug（公開頁 / 登入 / 後台） */
export function parseStoreSlugFromStorePath(pathname?: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/store\/([^/]+)/);
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
  if (!user) return PICKCOURT_ACCOUNT.bookings;
  const adminPath = getAdminPortalPath(user);
  if (adminPath) return adminPath;
  return PICKCOURT_ACCOUNT.bookings;
}

/** 平台 admin 或有管理店鋪的店員／店長 */
export function canAccessAdminPortal(user?: User | null): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  return Boolean(user.managedStores?.length);
}

/**
 * 後台入口：平台 admin → /admin-v2；店員 → /store/:slug/admin
 * 無權限則回 null
 */
export function getAdminPortalPath(user?: User | null): string | null {
  if (!user) return null;
  if (user.isPlatformAdmin || user.role === 'admin') return '/admin-v2';
  if (user.managedStores?.length) {
    return `/store/${user.managedStores[0].slug}/admin`;
  }
  return null;
}

export function getAdminPortalLabel(user?: User | null): string {
  if (!user) return '後台登入';
  if (user.isPlatformAdmin || user.role === 'admin') return '平台管理';
  if (user.managedStores?.length) return '店鋪後台';
  return '後台';
}

/** 登入後導向目標（唔需要完整 Location） */
export type PostAuthRedirectFrom = Pick<Location, 'pathname' | 'search' | 'hash'>;

/**
 * 登入／註冊成功後要回到的 path（含 query，例如 game join 的 sig、code）
 */
export function getPostAuthRedirectPath(
  from?: PostAuthRedirectFrom | Location | null,
  user?: User | null,
  fallback?: string
): string {
  const defaultFallback = fallback ?? getDefaultHomeForUser(user);

  if (!from?.pathname || isAuthPath(from.pathname)) {
    return defaultFallback;
  }

  // 後台入口：依角色落地，唔好逼店員入 /admin-v2
  if (
    from.pathname === '/admin-v2' ||
    from.pathname.startsWith('/admin-v2/') ||
    from.pathname === '/admin' ||
    from.pathname.startsWith('/admin/')
  ) {
    return getAdminPortalPath(user) || defaultFallback;
  }

  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}

export function canAccessStoreAdmin(user: User | null | undefined, storeSlug: string): boolean {
  if (!user || !storeSlug) return false;
  if (user.isPlatformAdmin || user.role === 'admin') return true;
  return (user.managedStores || []).some((s) => s.slug === storeSlug);
}
