const Store = require('../models/Store');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const { canAccessStore } = require('./tenantAccess');

/** 可查看全部會員、不受「曾預約」限制的店鋪 slug（預設 PickleVibes 荔枝角） */
function legacyFullUserLookupSlugs() {
  return (process.env.LEGACY_FULL_USER_LOOKUP_STORE_SLUGS || 'lai-chi-kok')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isLegacyFullUserLookupStore(store) {
  if (!store?.slug) return false;
  return legacyFullUserLookupSlugs().includes(String(store.slug).toLowerCase());
}

/**
 * 店鋪員工查詢會員時，解析要套用的 store 範圍
 * @returns {{ shouldFilter: boolean, storeId?: string, store?: object }}
 */
async function resolveUserLookupScope(req) {
  const access = req.tenantAccess;
  if (!access || access.isPlatformAdmin) {
    return { shouldFilter: false };
  }

  const managedIds = (access.managedStoreIds || []).map((id) => String(id));
  if (managedIds.length === 0) {
    const err = new Error('無店鋪權限');
    err.status = 403;
    throw err;
  }

  let storeId = req.query.store ? String(req.query.store).trim() : '';
  if (!storeId && managedIds.length === 1) {
    storeId = managedIds[0];
  }
  if (!storeId) {
    const err = new Error('請指定 store 參數以查詢會員');
    err.status = 400;
    throw err;
  }
  if (!canAccessStore(access, storeId)) {
    const err = new Error('無權限查詢此店鋪會員');
    err.status = 403;
    throw err;
  }

  const store = await Store.findById(storeId).select('slug name').lean();
  if (!store) {
    const err = new Error('店鋪不存在');
    err.status = 404;
    throw err;
  }
  if (isLegacyFullUserLookupStore(store)) {
    return { shouldFilter: false, storeId, store };
  }

  return { shouldFilter: true, storeId, store };
}

async function getStoreBookingUserFilter(storeId) {
  const courtIds = await Court.distinct('_id', { store: storeId });
  const or = [{ store: storeId }];
  if (courtIds.length) {
    or.push({ court: { $in: courtIds } });
  }
  return { $or: or };
}

async function getUserIdsWithStoreBooking(storeId) {
  return Booking.distinct('user', await getStoreBookingUserFilter(storeId));
}

async function userHasBookedAtStore(userId, storeId) {
  const exists = await Booking.exists({
    user: userId,
    ...(await getStoreBookingUserFilter(storeId)),
  });
  return Boolean(exists);
}

/**
 * 店鋪員工是否可查看該用戶（平台 admin / 豁免店鋪 / 曾於該店預約）
 */
async function assertStaffCanViewUser(req, userId, explicitStoreId) {
  const access = req.tenantAccess;
  if (!access || access.isPlatformAdmin) return;

  let scope;
  if (explicitStoreId) {
    if (!canAccessStore(access, explicitStoreId)) {
      const err = new Error('無權限查詢此店鋪會員');
      err.status = 403;
      throw err;
    }
    const store = await Store.findById(explicitStoreId).select('slug').lean();
    if (!store) {
      const err = new Error('店鋪不存在');
      err.status = 404;
      throw err;
    }
    if (isLegacyFullUserLookupStore(store)) return;
    scope = { shouldFilter: true, storeId: String(explicitStoreId) };
  } else {
    scope = await resolveUserLookupScope(req);
    if (!scope.shouldFilter) return;
  }

  const ok = await userHasBookedAtStore(userId, scope.storeId);
  if (!ok) {
    const err = new Error('此用戶未曾於本店預約，無法查閱其資料');
    err.status = 404;
    throw err;
  }
}

/**
 * 將 User 查詢限制為曾在該店預約的用戶
 */
async function applyBookingUserFilter(query, storeId) {
  const userIds = await getUserIdsWithStoreBooking(storeId);
  if (!userIds.length) {
    return { ...query, _id: { $in: [] } };
  }
  if (query._id) {
    const existing = query._id;
    if (existing.$in) {
      const allowed = new Set(userIds.map(String));
      return {
        ...query,
        _id: { $in: existing.$in.filter((id) => allowed.has(String(id))) },
      };
    }
    const allowed = userIds.some((id) => String(id) === String(existing));
    return { ...query, _id: allowed ? existing : { $in: [] } };
  }
  return { ...query, _id: { $in: userIds } };
}

module.exports = {
  legacyFullUserLookupSlugs,
  isLegacyFullUserLookupStore,
  resolveUserLookupScope,
  assertStaffCanViewUser,
  applyBookingUserFilter,
  userHasBookedAtStore,
};
