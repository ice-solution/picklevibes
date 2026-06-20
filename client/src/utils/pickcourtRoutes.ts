/** PickCourt 平台公開路由（首頁即聯盟站） */
export const PICKCOURT_HOME = '/';
export const PICKCOURT_SEARCH = '/search';

export function isPickCourtPublicPath(pathname: string): boolean {
  if (pathname === PICKCOURT_HOME || pathname === PICKCOURT_SEARCH) return true;
  if (pathname === '/pickcourt' || pathname.startsWith('/pickcourt/')) return true;
  return false;
}

export function pickcourtHomeHash(hash: string): string {
  const h = hash.startsWith('#') ? hash : `#${hash}`;
  return `${PICKCOURT_HOME}${h}`;
}
