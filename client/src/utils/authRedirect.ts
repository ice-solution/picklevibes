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

export function getDefaultHomeForUser(user?: User | null): string {
  if (!user) return '/my-bookings';
  if (user.isPlatformAdmin || user.role === 'admin') return '/admin-v2';
  if (user.role === 'staff' && user.managedStores?.length) {
    return `/store/${user.managedStores[0].slug}/admin`;
  }
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
