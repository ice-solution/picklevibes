/** 後台角色（User.role） */
const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  STAFF: 'staff',
};

const ADMIN_PANEL_ROLES = [
  ADMIN_ROLES.SUPER_ADMIN,
  ADMIN_ROLES.ADMIN,
  ADMIN_ROLES.STAFF,
];

/** 舊資料 role=admin 視為 super_admin */
const LEGACY_SUPER_ADMIN_ROLE = 'admin';

/** staff 僅能使用的 AdminV2 分頁 */
const STAFF_ADMIN_TAB_IDS = ['bookings', 'calendar'];

/** 僅 super_admin 可見的分頁 */
const SUPER_ADMIN_ONLY_TAB_IDS = ['users', 'maintenance', 'bulk-upgrade'];

module.exports = {
  ADMIN_ROLES,
  ADMIN_PANEL_ROLES,
  LEGACY_SUPER_ADMIN_ROLE,
  STAFF_ADMIN_TAB_IDS,
  SUPER_ADMIN_ONLY_TAB_IDS,
};
