const { allianceRequiredForSaas } = require('../config/platformFeatures');

function isAllianceStore(store) {
  return Boolean(store && store.allianceEnabled);
}

/** 可作為 SaaS tenant 的店鋪（加盟聯盟） */
function isSaasTenantStore(store) {
  if (!store || store.isActive === false) return false;
  if (!allianceRequiredForSaas) return true;
  return isAllianceStore(store);
}

function assertSaasTenantStore(store) {
  if (!store) {
    const err = new Error('店鋪不存在');
    err.status = 404;
    throw err;
  }
  if (!isSaasTenantStore(store)) {
    const err = new Error('此店鋪未加入 PickCourt 聯盟，無法使用 SaaS 功能');
    err.status = 403;
    err.code = 'NOT_ALLIANCE_STORE';
    throw err;
  }
  return store;
}

module.exports = {
  isAllianceStore,
  isSaasTenantStore,
  assertSaasTenantStore,
};
