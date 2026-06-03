/** iSQUARE 暫不開放包場（前後台一致） */
const STORE_SLUG_ISQUARE = 'isquare';

function isStoreSlugIsquare(storeOrSlug) {
  if (!storeOrSlug) return false;
  if (typeof storeOrSlug === 'string') {
    return storeOrSlug.trim().toLowerCase() === STORE_SLUG_ISQUARE;
  }
  return String(storeOrSlug.slug || '').trim().toLowerCase() === STORE_SLUG_ISQUARE;
}

function isFullVenueEnabledForStore(store) {
  return !isStoreSlugIsquare(store);
}

module.exports = {
  STORE_SLUG_ISQUARE,
  isStoreSlugIsquare,
  isFullVenueEnabledForStore
};
