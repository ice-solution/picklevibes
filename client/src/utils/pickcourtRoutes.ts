import { isReservedStoreSlug } from './storeSlugRoutes';

/** PickCourt 平台公開路由（首頁即聯盟站） */
export const PICKCOURT_HOME = '/';
export const PICKCOURT_SEARCH = '/search';

/** PickCourt 會員中心（獨立於 PickleVibes /profile、/my-bookings 等） */
export const PICKCOURT_ACCOUNT = {
  root: '/account',
  bookings: '/account/bookings',
  profile: '/account/profile',
  balance: '/account/balance',
  recharge: '/account/recharge',
  orders: '/account/orders',
} as const;

export function isPickCourtMemberPath(pathname: string): boolean {
  return pathname === PICKCOURT_ACCOUNT.root || pathname.startsWith(`${PICKCOURT_ACCOUNT.root}/`);
}

/** 店鋪公開頁（不含 /admin）：/store/:slug 或 /:slug */
export function isStorePublicPath(pathname: string): boolean {
  if (/^\/store\/[^/]+$/.test(pathname)) return true;
  const m = pathname.match(/^\/([^/]+)$/);
  if (m && !isReservedStoreSlug(m[1])) return true;
  return false;
}

/** 聯盟預約流程（隱藏 PickleVibes 主站 chrome） */
export function isPickCourtBookingPath(pathname: string): boolean {
  return pathname === '/booking' || pathname.startsWith('/booking/');
}

/** URL 已帶店鋪 + 場地 slug（從店鋪頁點入，不需再選店） */
export function isPickCourtPresetBooking(
  pathname: string,
  routeParams?: { storeSlug?: string; courtSlug?: string } | null
): boolean {
  const courtSlug = routeParams?.courtSlug;
  const looksLikeDate = courtSlug ? /^\d{4}-\d{2}-\d{2}$/.test(courtSlug) : false;
  return (
    isPickCourtBookingPath(pathname) &&
    Boolean(routeParams?.storeSlug) &&
    Boolean(courtSlug) &&
    !looksLikeDate
  );
}

/** 會員認證頁（PickCourt 版面，隱藏 PickleVibes 主站 chrome） */
export function isPickCourtAuthPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/pickcourt/login' ||
    pathname === '/picklecourt/login'
  );
}

/** 平台 / 店鋪後台（獨立 chrome，隱藏 PickleVibes Navbar） */
export function isPickCourtAdminPath(pathname: string): boolean {
  if (pathname === '/admin-v2' || pathname.startsWith('/admin-v2/')) return true;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  if (/^\/store\/[^/]+\/admin(\/|$)/.test(pathname)) return true;
  return false;
}

export function isPickCourtPublicPath(pathname: string): boolean {
  if (pathname === PICKCOURT_HOME || pathname === PICKCOURT_SEARCH) return true;
  if (pathname === '/pickcourt' || pathname.startsWith('/pickcourt/')) return true;
  if (pathname === '/tournaments' || pathname.startsWith('/tournaments/')) return true;
  if (isStorePublicPath(pathname)) return true;
  if (isPickCourtBookingPath(pathname)) return true;
  if (isPickCourtMemberPath(pathname)) return true;
  if (isPickCourtAuthPath(pathname)) return true;
  return false;
}

export function pickcourtHomeHash(hash: string): string {
  const h = hash.startsWith('#') ? hash : `#${hash}`;
  return `${PICKCOURT_HOME}${h}`;
}

/** 組裝會員充值頁 URL（可帶店鋪 slug 與查詢參數） */
export function buildAccountRechargeUrl(
  storeSlug?: string | null,
  extraParams?: Record<string, string>
): string {
  const params = new URLSearchParams(extraParams || {});
  if (storeSlug) params.set('store', storeSlug);
  const qs = params.toString();
  return qs ? `${PICKCOURT_ACCOUNT.recharge}?${qs}` : PICKCOURT_ACCOUNT.recharge;
}
