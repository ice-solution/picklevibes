const mongoose = require('mongoose');
const Store = require('../models/Store');

/**
 * 以 MongoDB ObjectId 或 slug 解析店鋪。
 * 跨系統（PickCourt ↔ PickleVibes）應優先用 slug，兩邊 _id 通常唔同。
 *
 * @param {string} ref
 * @param {{ select?: string }} [options]
 * @returns {Promise<import('mongoose').Document|null>}
 */
async function resolveStoreRef(ref, options = {}) {
  const raw = String(ref || '').trim();
  if (!raw) return null;

  const select = options.select || 'name slug isActive';

  if (mongoose.Types.ObjectId.isValid(raw) && String(new mongoose.Types.ObjectId(raw)) === raw) {
    const byId = await Store.findById(raw).select(select);
    if (byId) return byId;
  }

  return Store.findOne({ slug: raw }).select(select);
}

module.exports = {
  resolveStoreRef,
};
