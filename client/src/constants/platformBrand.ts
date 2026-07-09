/** PickCourt 平台品牌（主站 SEO / 靜態 meta / 預設 Helmet） */

export const PLATFORM_NAME = 'PickCourt';
export const PLATFORM_TAGLINE = 'Pick Friends.';
export const PLATFORM_DOMAIN =
  process.env.REACT_APP_PLATFORM_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '') ||
  'pickcourt.hk';

export const PLATFORM_URL =
  process.env.REACT_APP_PLATFORM_URL ||
  process.env.REACT_APP_SERVER_URL ||
  `https://${PLATFORM_DOMAIN}`;

export const PLATFORM_EMAIL =
  process.env.REACT_APP_PLATFORM_EMAIL || 'info@pickcourt.hk';

export const PLATFORM_LOGO_PATH = '/pickcourt_logo.jpg';
export const PLATFORM_OG_IMAGE = '/pickcourt_logo.jpg';

export const DEFAULT_SEO_TITLE = `${PLATFORM_NAME} | 聯盟式匹克球平台 · ${PLATFORM_TAGLINE}`;
export const DEFAULT_SEO_DESCRIPTION =
  'PickCourt 連結全港匹克球場地與球友。場地以 SaaS 獨立營運，球友以聯盟會籍預約、參與活動與比賽。';

export const DEFAULT_SEO_KEYWORDS =
  'PickCourt,匹克球,香港匹克球,場地預約,匹克球聯盟,智能球場,比賽計分,pickcourt.hk';

/** 頁面 title 若未含品牌名，自動加後綴 */
export function formatPageTitle(title: string): string {
  const t = title.trim();
  if (!t) return DEFAULT_SEO_TITLE;
  if (t.includes(PLATFORM_NAME) || t.includes('Picklevibes') || t.includes('PickleVibes')) {
    return t;
  }
  return `${t} | ${PLATFORM_NAME}`;
}

export function absolutePlatformUrl(path: string): string {
  const base = PLATFORM_URL.replace(/\/$/, '');
  if (!path || path === '/') return base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function absoluteAssetUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return absolutePlatformUrl(path);
}

export const DEFAULT_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: PLATFORM_NAME,
  description: DEFAULT_SEO_DESCRIPTION,
  url: PLATFORM_URL.replace(/\/$/, ''),
  email: PLATFORM_EMAIL,
  logo: absoluteAssetUrl(PLATFORM_LOGO_PATH),
  sameAs: [] as string[],
};
