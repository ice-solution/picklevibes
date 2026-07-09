const { getStoreHikConfig } = require('./storeHikConfig');

function isAccessControlEnabled(store) {
  return Boolean(store?.enableHikAccess);
}

function getAccessControlVendor(store) {
  if (!isAccessControlEnabled(store)) return null;
  const v = String(store.accessControlVendor || 'hik').toLowerCase();
  return v === 'dahua' ? 'dahua' : 'hik';
}

function getStoreAccessControlConfig(store) {
  const vendor = getAccessControlVendor(store);
  if (!vendor) {
    return { enabled: false, vendor: null };
  }

  if (vendor === 'dahua') {
    return {
      enabled: true,
      vendor: 'dahua',
      clientId: store.dahuaClientId || process.env.DAHUA_CLIENT_ID || null,
      clientSecret: store.dahuaClientSecret || process.env.DAHUA_CLIENT_SECRET || null,
      deviceModel: store.dahuaDeviceModel || 'DHI-ASI3213A-W',
      platformUrl: (process.env.DAHUA_PLATFORM_URL || 'https://openapi.dahuatech.com').replace(/\/$/, ''),
    };
  }

  const hik = getStoreHikConfig(store);
  return {
    enabled: true,
    vendor: 'hik',
    appKey: hik.appKey,
    secretKey: hik.secretKey,
    accessLevelId: hik.accessLevelId,
  };
}

function accessControlVendorLabel(store) {
  if (!isAccessControlEnabled(store)) return '僅確認信';
  return getAccessControlVendor(store) === 'dahua' ? '大華' : 'HIK';
}

module.exports = {
  isAccessControlEnabled,
  getAccessControlVendor,
  getStoreAccessControlConfig,
  accessControlVendorLabel,
};
