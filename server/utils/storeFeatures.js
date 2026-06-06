/** 店鋪 slug 工具；包場功能依店鋪開放（iSQUARE 已重新開放） */
const STORE_SLUG_ISQUARE = 'isquare';

function isStoreSlugIsquare(storeOrSlug) {
  if (!storeOrSlug) return false;
  if (typeof storeOrSlug === 'string') {
    return storeOrSlug.trim().toLowerCase() === STORE_SLUG_ISQUARE;
  }
  return String(storeOrSlug.slug || '').trim().toLowerCase() === STORE_SLUG_ISQUARE;
}

function isFullVenueEnabledForStore(_store) {
  return true;
}

module.exports = {
  STORE_SLUG_ISQUARE,
  isStoreSlugIsquare,
  isFullVenueEnabledForStore
};
