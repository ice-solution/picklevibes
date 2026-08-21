const TenantMembership = require('../models/TenantMembership');
const {
  resolveModules,
  canAccessModule,
  normalizeMembershipRole,
} = require('./tenantPermissions');

function hasAnyMembershipRole(tenantAccess, roles) {
  const wanted = new Set(roles);
  return (tenantAccess?.managedStores || []).some((s) => wanted.has(s.membershipRole));
}

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
      .populate('store', 'name slug isActive')
      .lean();

    const managedStores = memberships
      .filter((m) => m.store)
      .map((m) => {
        const role = normalizeMembershipRole(m.role);
        const custom =
          Array.isArray(m.modules) && m.modules.length > 0 ? m.modules : null;
        return {
          id: m.store._id,
          name: m.store.name,
          slug: m.store.slug,
          membershipRole: role,
          modules: resolveModules(role, custom),
        };
      });

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

function getMembershipRoleForStore(tenantAccess, storeId) {
  if (!tenantAccess) return null;
  if (tenantAccess.isPlatformAdmin) return 'platform';
  const match = (tenantAccess.managedStores || []).find(
    (s) => String(s.id) === String(storeId)
  );
  return match?.membershipRole || null;
}

function getStoreModules(tenantAccess, storeId) {
  if (!tenantAccess) return [];
  if (tenantAccess.isPlatformAdmin) return null;
  const match = (tenantAccess.managedStores || []).find(
    (s) => String(s.id) === String(storeId)
  );
  return match ? match.modules : [];
}

function isStoreManager(tenantAccess, storeId) {
  const role = getMembershipRoleForStore(tenantAccess, storeId);
  return role === 'platform' || role === 'manager';
}

function isStoreStaffOnly(tenantAccess, storeId) {
  return getMembershipRoleForStore(tenantAccess, storeId) === 'staff';
}

/**
 * 檢查店鋪後台功能權限
 */
function assertStoreFeatureAccess(tenantAccess, storeId, feature) {
  if (!tenantAccess) {
    return { ok: false, status: 500, message: '權限上下文未載入' };
  }
  if (tenantAccess.isPlatformAdmin) return { ok: true };

  if (!canAccessStore(tenantAccess, storeId)) {
    return { ok: false, status: 403, message: '無權限存取此店鋪' };
  }

  const role = getMembershipRoleForStore(tenantAccess, storeId);
  const modules = getStoreModules(tenantAccess, storeId);
  if (canAccessModule(role, feature, modules)) return { ok: true };

  return { ok: false, status: 403, message: '無權限存取此功能' };
}

function assertInternalAdminAccess(tenantAccess) {
  if (!tenantAccess) {
    return { ok: false, status: 500, message: '權限上下文未載入' };
  }
  if (tenantAccess.isPlatformAdmin) return { ok: true };
  const stores = tenantAccess.managedStores || [];
  for (const s of stores) {
    if (
      canAccessModule(s.membershipRole, 'accounting', s.modules) ||
      canAccessModule(s.membershipRole, 'analytics', s.modules) ||
      canAccessModule(s.membershipRole, 'reports', s.modules)
    ) {
      return { ok: true };
    }
  }
  return { ok: false, status: 403, message: '無權限存取內部管理功能' };
}

function assertManagerAccess(tenantAccess) {
  if (!tenantAccess) {
    return { ok: false, status: 500, message: '權限上下文未載入' };
  }
  if (tenantAccess.isPlatformAdmin) return { ok: true };
  if (hasAnyMembershipRole(tenantAccess, ['manager'])) return { ok: true };

  return { ok: false, status: 403, message: '需要店長或平台管理員權限' };
}

function resolveAccountingStoreScope(tenantAccess, requestedStoreId) {
  const requested = requestedStoreId ? String(requestedStoreId) : '';

  if (!tenantAccess || tenantAccess.isPlatformAdmin) {
    return {
      ok: true,
      storeId: requested || null,
      storeIds: requested ? [requested] : null,
      unrestricted: !requested,
    };
  }

  const allowed = (tenantAccess.managedStoreIds || []).map((id) => String(id));
  if (!allowed.length) {
    return {
      ok: false,
      status: 403,
      message: '無店鋪管理權限',
      storeId: null,
      storeIds: [],
      unrestricted: false,
    };
  }

  if (requested) {
    if (!allowed.includes(requested)) {
      return {
        ok: false,
        status: 403,
        message: '無權限存取此店鋪',
        storeId: null,
        storeIds: [],
        unrestricted: false,
      };
    }
    return {
      ok: true,
      storeId: requested,
      storeIds: [requested],
      unrestricted: false,
    };
  }

  return {
    ok: true,
    storeId: null,
    storeIds: allowed,
    unrestricted: false,
  };
}

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
    managedStores: (tenantAccess.managedStores || []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      membershipRole: s.membershipRole,
      modules: s.modules,
    })),
  };
}

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
  getMembershipRoleForStore,
  getStoreModules,
  isStoreManager,
  isStoreStaffOnly,
  assertStoreFeatureAccess,
  assertInternalAdminAccess,
  assertManagerAccess,
  resolveAccountingStoreScope,
  applyStoreScope,
  formatTenantAccessForClient,
  checkDocumentStoreAccess,
  resolveStoreForCreate,
};
