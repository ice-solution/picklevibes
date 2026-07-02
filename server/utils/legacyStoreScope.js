const mongoose = require('mongoose');
const Store = require('../models/Store');
const { isLegacyFullUserLookupStore } = require('./storeUserVisibility');

/**
 * 店鋪後台帶 store 篩選時：主店（預設 lai-chi-kok）同時包含舊資料 store=null
 */
async function applyRequestedStoreFilter(query, storeId) {
  if (!storeId || String(storeId).trim() === '') {
    return query;
  }

  const sid = String(storeId).trim();
  const store = await Store.findById(sid).select('slug').lean();

  if (store && isLegacyFullUserLookupStore(store)) {
    const storeOr = {
      $or: [
        { store: new mongoose.Types.ObjectId(sid) },
        { store: null },
        { store: { $exists: false } },
      ],
    };
    if (!query || Object.keys(query).length === 0) {
      return storeOr;
    }
    return { $and: [query, storeOr] };
  }

  return { ...query, store: sid };
}

module.exports = {
  applyRequestedStoreFilter,
};
