const mongoose = require('mongoose');
const {
  ADMIN_ROLES,
  ADMIN_PANEL_ROLES,
  LEGACY_SUPER_ADMIN_ROLE,
} = require('../constants/adminRoles');

function normalizeAdminRole(role) {
  return role;
}

function canAccessAdminPanel(user) {
  const role = normalizeAdminRole(user?.role);
  if (ADMIN_PANEL_ROLES.includes(role)) return true;
  return isLegacySuperAdmin(user);
}

function isLegacySuperAdmin(user) {
  const role = normalizeAdminRole(user?.role);
  if (role !== LEGACY_SUPER_ADMIN_ROLE) return false;
  const stores = user?.managedStores || [];
  return stores.length === 0;
}

function isSuperAdmin(user) {
  const role = normalizeAdminRole(user?.role);
  if (role === ADMIN_ROLES.SUPER_ADMIN) return true;
  return isLegacySuperAdmin(user);
}

function isStoreAdmin(user) {
  return normalizeAdminRole(user?.role) === ADMIN_ROLES.ADMIN;
}

function isStaff(user) {
  return normalizeAdminRole(user?.role) === ADMIN_ROLES.STAFF;
}

/** 後台建單／管理預約（含 staff） */
function isAdminPanelUser(user) {
  return canAccessAdminPanel(user);
}

/** staff 不可用 0 元／bypass 建單 */
function canBypassBookingRestrictions(user) {
  const role = normalizeAdminRole(user?.role);
  return role === ADMIN_ROLES.SUPER_ADMIN || role === ADMIN_ROLES.ADMIN;
}

function getManagedStoreIdStrings(user) {
  if (isSuperAdmin(user)) return null;
  const raw = user?.managedStores || [];
  return raw.map((id) => String(id._id || id)).filter(Boolean);
}

function assertStoreAccess(user, storeId) {
  if (!storeId) return true;
  if (isSuperAdmin(user)) return true;
  const allowed = getManagedStoreIdStrings(user);
  if (!allowed || allowed.length === 0) return false;
  return allowed.includes(String(storeId));
}

/**
 * 非 super_admin：限制 query.store 在 managedStores 內
 */
function applyStoreScopeToQuery(user, query, field = 'store') {
  if (isSuperAdmin(user)) return query;
  const ids = getManagedStoreIdStrings(user);
  if (!ids || ids.length === 0) {
    query[field] = { $in: [] };
    return query;
  }
  if (query[field]) {
    const requested = String(query[field]);
    if (!ids.includes(requested)) {
      query[field] = { $in: [] };
    }
  } else {
    query[field] = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  return query;
}

function serializeAdminUser(user) {
  if (!user) return null;
  const doc = user.toObject ? user.toObject() : user;
  const role = normalizeAdminRole(doc.role);
  const adminRole = isLegacySuperAdmin(doc) ? ADMIN_ROLES.SUPER_ADMIN : role;
  const managedStores = (doc.managedStores || []).map((s) =>
    s && typeof s === 'object' && s._id
      ? { _id: String(s._id), name: s.name, slug: s.slug }
      : String(s._id || s)
  );
  return {
    id: String(doc._id || doc.id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    role: doc.role,
    adminRole,
    managedStores,
    membershipLevel: doc.membershipLevel,
    preferences: doc.preferences,
    lastLogin: doc.lastLogin,
    createdAt: doc.createdAt,
    canBypassBooking: canBypassBookingRestrictions(doc),
    isSuperAdmin: adminRole === ADMIN_ROLES.SUPER_ADMIN,
  };
}

module.exports = {
  ADMIN_ROLES,
  normalizeAdminRole,
  canAccessAdminPanel,
  isLegacySuperAdmin,
  isSuperAdmin,
  isStoreAdmin,
  isStaff,
  isAdminPanelUser,
  canBypassBookingRestrictions,
  getManagedStoreIdStrings,
  assertStoreAccess,
  applyStoreScopeToQuery,
  serializeAdminUser,
};
