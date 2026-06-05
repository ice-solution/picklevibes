const { DEFAULT_TUYA_BASE_URL } = require('../constants/tuyaRegions');

/**
 * 店鋪級 Tuya API 憑證（與 HIK 相同：店鋪優先，.env 為 fallback）
 */
function getStoreTuyaConfig(store) {
  if (!store) {
    return {
      accessKey: process.env.TUYA_ACCESS_KEY || null,
      secretKey: process.env.TUYA_SECRET_KEY || null,
      baseUrl: DEFAULT_TUYA_BASE_URL,
      preBufferMinutes: parseInt(process.env.TUYA_PRE_BUFFER_MINUTES, 10) || 15,
      postBufferMinutes: parseInt(process.env.TUYA_POST_BUFFER_MINUTES, 10) || 15,
      mergeGapMinutes: parseInt(process.env.TUYA_MERGE_GAP_MINUTES, 10) || 0,
    };
  }
  return {
    accessKey: store.tuyaAccessKey || process.env.TUYA_ACCESS_KEY || null,
    secretKey: store.tuyaSecretKey || process.env.TUYA_SECRET_KEY || null,
    baseUrl: store.tuyaBaseUrl || DEFAULT_TUYA_BASE_URL,
    preBufferMinutes: store.tuyaPreBufferMinutes ?? 15,
    postBufferMinutes: store.tuyaPostBufferMinutes ?? 15,
    mergeGapMinutes: store.tuyaMergeGapMinutes ?? 0,
  };
}

function isTuyaConfigured(store) {
  const cfg = getStoreTuyaConfig(store);
  return Boolean(cfg.accessKey && cfg.secretKey && cfg.baseUrl);
}

module.exports = { getStoreTuyaConfig, isTuyaConfigured };
