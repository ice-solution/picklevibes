import type { Location } from 'react-router-dom';

const AUTH_PATHS = new Set(['/login', '/register', '/forgot-password']);

/**
 * 登入／註冊成功後要回到的 path（含 query，例如 game join 的 sig、code）
 */
export function getPostAuthRedirectPath(
  from?: Location | null,
  fallback = '/my-bookings'
): string {
  if (!from?.pathname || AUTH_PATHS.has(from.pathname)) {
    return fallback;
  }
  return `${from.pathname}${from.search || ''}${from.hash || ''}`;
}
