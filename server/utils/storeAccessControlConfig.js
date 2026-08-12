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
      deviceModel: store.dahuaDeviceModel || 'DHI-ASI3213A-W',
      deviceHost: store.dahuaDeviceHost || process.env.DAHUA_DEVICE_HOST || null,
      deviceUser: store.dahuaDeviceUser || process.env.DAHUA_DEVICE_USER || 'admin',
      devicePassword: store.dahuaDevicePassword || process.env.DAHUA_DEVICE_PASS || null,
      httpPort: Number(store.dahuaHttpPort || process.env.DAHUA_HTTP_PORT || 80),
      useHttps: Boolean(store.dahuaUseHttps),
      doorChannel: Number(store.dahuaDoorChannel ?? 1),
      doorIndex: Number(store.dahuaDoorIndex ?? 0),
      deviceSerial: store.dahuaDeviceSerial || process.env.DAHUA_DEVICE_SERIAL || null,
      preBufferMinutes: Number(store.dahuaPreBufferMinutes ?? 15),
      postBufferMinutes: Number(store.dahuaPostBufferMinutes ?? 15),
      enrollPassword: store.dahuaEnrollPassword !== false,
      qrSecret: store.dahuaQrSecret || process.env.DAHUA_QR_SECRET || null,
      // 舊欄位保留讀取（已棄用 openapi）
      clientId: store.dahuaClientId || null,
      clientSecret: store.dahuaClientSecret || null,
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
