/** 與 server/utils/storeFeatures.js 一致 */
export const STORE_SLUG_ISQUARE = 'isquare';

export function isStoreSlugIsquare(slug?: string | null): boolean {
  return String(slug || '').trim().toLowerCase() === STORE_SLUG_ISQUARE;
}

export function isFullVenueEnabledForStoreSlug(_slug?: string | null): boolean {
  return true;
}
