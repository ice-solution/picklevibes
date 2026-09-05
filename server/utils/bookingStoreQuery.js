const mongoose = require('mongoose');
const Court = require('../models/Court');

/**
 * 預約歸屬店鋪：優先 booking.store，否則以 court.store 推斷（舊資料常缺 booking.store）
 */
async function buildBookingStoreMatch({ storeId, storeIds } = {}) {
  let ids = [];
  if (storeId) {
    ids = [String(storeId).trim()];
  } else if (Array.isArray(storeIds) && storeIds.length) {
    ids = [...new Set(storeIds.map((id) => String(id)).filter(Boolean))];
  }
  if (!ids.length) return null;

  const oids = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!oids.length) return null;

  const courtIds = await Court.find({ store: { $in: oids } }).distinct('_id');
  const storeClause = oids.length === 1 ? oids[0] : { $in: oids };
  const orClause = [{ store: storeClause }];
  if (courtIds.length) {
    orClause.push({ court: { $in: courtIds } });
  }
  return { $or: orClause };
}

function mergeQueryWithAnd(baseQuery, extra) {
  if (!extra) return baseQuery;
  if (!baseQuery || Object.keys(baseQuery).length === 0) return extra;
  if (baseQuery.$and) {
    return { ...baseQuery, $and: [...baseQuery.$and, extra] };
  }
  return { $and: [baseQuery, extra] };
}

async function applyBookingStoreFilter(query, options) {
  const match = await buildBookingStoreMatch(options);
  return mergeQueryWithAnd(query, match);
}

/**
 * 管理後台預約列表／日曆的店鋪範圍（含 court 推斷 + 店鋪員工權限）
 */
async function applyAdminBookingStoreScope(query, tenantAccess, storeParam) {
  const storeId =
    storeParam && String(storeParam).trim() !== '' ? String(storeParam).trim() : null;

  if (storeId) {
    if (tenantAccess && !tenantAccess.isPlatformAdmin) {
      const allowed = tenantAccess.managedStoreIds || [];
      if (!allowed.some((id) => String(id) === storeId)) {
        return { denied: true, status: 403, message: '無權限存取此店鋪' };
      }
    }
    return {
      denied: false,
      query: await applyBookingStoreFilter(query, { storeId }),
    };
  }

  if (tenantAccess && !tenantAccess.isPlatformAdmin) {
    const ids = tenantAccess.managedStoreIds || [];
    if (!ids.length) {
      return {
        denied: false,
        query: mergeQueryWithAnd(query, { _id: { $in: [] } }),
      };
    }
    return {
      denied: false,
      query: await applyBookingStoreFilter(query, { storeIds: ids }),
    };
  }

  return { denied: false, query };
}

module.exports = {
  buildBookingStoreMatch,
  mergeQueryWithAnd,
  applyBookingStoreFilter,
  applyAdminBookingStoreScope,
};
