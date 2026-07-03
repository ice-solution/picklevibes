/** PickCourt 平台公開路由（首頁即聯盟站） */
export const PICKCOURT_HOME = '/';
export const PICKCOURT_SEARCH = '/search';

/** 店鋪公開頁（不含 /admin） */
export function isStorePublicPath(pathname: string): boolean {
  return /^\/store\/[^/]+$/.test(pathname);
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

export function isPickCourtPublicPath(pathname: string): boolean {
  if (pathname === PICKCOURT_HOME || pathname === PICKCOURT_SEARCH) return true;
  if (pathname === '/pickcourt' || pathname.startsWith('/pickcourt/')) return true;
  if (isStorePublicPath(pathname)) return true;
  if (isPickCourtBookingPath(pathname)) return true;
  return false;
}

export function pickcourtHomeHash(hash: string): string {
  const h = hash.startsWith('#') ? hash : `#${hash}`;
  return `${PICKCOURT_HOME}${h}`;
}
