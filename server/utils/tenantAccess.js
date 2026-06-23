const TenantMembership = require('../models/TenantMembership');

/**
 * 載入用戶的店鋪權限上下文
 * @param {import('../models/User')} user
 */
async function loadTenantAccess(user) {
  if (!user) {
    return {
      isPlatformAdmin: false,
      managedStoreIds: [],
      managedStores: [],
      memberships: [],
    };
  }

  if (user.role === 'admin') {
    return {
      isPlatformAdmin: true,
      managedStoreIds: null,
      managedStores: [],
      memberships: [],
    };
  }

  if (user.role === 'staff') {
    const memberships = await TenantMembership.find({
      user: user._id,
      isActive: true,
    })
      .populate('store', 'name slug allianceEnabled')
      .lean();

    const managedStores = memberships
      .filter((m) => m.store)
      .map((m) => ({
        id: m.store._id,
        name: m.store.name,
        slug: m.store.slug,
        membershipRole: m.role,
      }));

    return {
      isPlatformAdmin: false,
      managedStoreIds: managedStores.map((s) => s.id),
      managedStores,
      memberships,
    };
  }

  return {
    isPlatformAdmin: false,
    managedStoreIds: [],
    managedStores: [],
    memberships: [],
  };
}

function canAccessStore(tenantAccess, storeId) {
  if (!storeId) return false;
  if (!tenantAccess) return false;
  if (tenantAccess.isPlatformAdmin) return true;
  return (tenantAccess.managedStoreIds || []).some((id) => String(id) === String(storeId));
}

/**
 * 在查詢物件上套用店鋪範圍（非平台 admin）
 */
function applyStoreScope(query, tenantAccess, field = 'store') {
  if (!tenantAccess || tenantAccess.isPlatformAdmin) return query;

  const ids = tenantAccess.managedStoreIds || [];
  const scoped = { ...query };

  if (ids.length === 0) {
    scoped[field] = { $in: [] };
    return scoped;
  }

  if (scoped[field] != null && scoped[field] !== '') {
    const sid = String(scoped[field]);
    if (!ids.some((id) => String(id) === sid)) {
      scoped[field] = { $in: [] };
    }
  } else {
    scoped[field] = { $in: ids };
  }

  return scoped;
}

function formatTenantAccessForClient(tenantAccess) {
  if (!tenantAccess) {
    return { isPlatformAdmin: false, managedStores: [] };
  }
  return {
    isPlatformAdmin: Boolean(tenantAccess.isPlatformAdmin),
    managedStores: tenantAccess.managedStores || [],
  };
}

/** 單筆資源的店鋪存取（store 為 null 時僅平台 admin） */
function checkDocumentStoreAccess(tenantAccess, storeId) {
  if (!storeId) {
    if (!tenantAccess?.isPlatformAdmin) {
      return { ok: false, status: 403, message: '無權限存取此資源' };
    }
    return { ok: true };
  }
  if (!canAccessStore(tenantAccess, storeId)) {
    return { ok: false, status: 403, message: '無權限存取此資源' };
  }
  return { ok: true };
}

/** 建立資源時解析並驗證店鋪 ID */
function resolveStoreForCreate(tenantAccess, requestedStoreId) {
  if (!tenantAccess) {
    return { ok: false, status: 500, message: '權限上下文未載入' };
  }
  if (tenantAccess.isPlatformAdmin) {
    return { ok: true, storeId: requestedStoreId || null };
  }
  const ids = tenantAccess.managedStoreIds || [];
  if (ids.length === 0) {
    return { ok: false, status: 403, message: '無店鋪管理權限' };
  }
  if (requestedStoreId) {
    if (!ids.some((id) => String(id) === String(requestedStoreId))) {
      return { ok: false, status: 403, message: '無權限指定此店鋪' };
    }
    return { ok: true, storeId: requestedStoreId };
  }
  if (ids.length === 1) {
    return { ok: true, storeId: ids[0] };
  }
  return { ok: false, status: 400, message: '請指定店鋪' };
}

module.exports = {
  loadTenantAccess,
  canAccessStore,
  applyStoreScope,
  formatTenantAccessForClient,
  checkDocumentStoreAccess,
  resolveStoreForCreate,
};
