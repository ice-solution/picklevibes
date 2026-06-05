const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const { getStoreTuyaConfig, isTuyaConfigured } = require('../utils/storeTuyaConfig');

/** 依店鋪快取 TuyaContext（避免每次 new） */
const clientCache = new Map();

function cacheKey(storeId, cfg) {
  return `${storeId || 'env'}:${cfg.baseUrl}:${cfg.accessKey}`;
}

function getTuyaClient(store) {
  const cfg = getStoreTuyaConfig(store);
  if (!cfg.accessKey || !cfg.secretKey) {
    throw new Error('Tuya API 憑證未設定（請於店鋪管理或 .env 填寫 Access ID / Secret）');
  }
  const key = cacheKey(store?._id, cfg);
  if (!clientCache.has(key)) {
    clientCache.set(
      key,
      new TuyaContext({
        baseUrl: cfg.baseUrl,
        accessKey: cfg.accessKey,
        secretKey: cfg.secretKey,
      })
    );
  }
  return clientCache.get(key);
}

/**
 * 查詢設備狀態（測試連線用）
 */
async function getDeviceStatus(store, deviceId) {
  const tuya = getTuyaClient(store);
  const response = await tuya.request({
    method: 'GET',
    path: `/v1.0/devices/${deviceId}/status`,
  });
  return response;
}

/**
 * 控制單一開關（對應 tyua-sample.js controlSwitch）
 */
async function setDeviceSwitch(store, { deviceId, switchCode = 'switch_1', turnOn }) {
  const tuya = getTuyaClient(store);
  const response = await tuya.request({
    method: 'POST',
    path: `/v1.0/devices/${deviceId}/commands`,
    body: {
      commands: [{ code: switchCode, value: Boolean(turnOn) }],
    },
  });
  if (!response.success) {
    const err = new Error(response.msg || 'Tuya 控制失敗');
    err.tuyaResponse = response;
    throw err;
  }
  return response;
}

function getActiveCourtDevices(court) {
  if (!court?.enableTuyaAutomation) return [];
  return (court.tuyaDevices || []).filter((d) => d.enabled && d.deviceId);
}

/**
 * 對場地所有啟用設備下達同一開關狀態
 */
async function setCourtDevices(store, court, turnOn) {
  const devices = getActiveCourtDevices(court);
  if (!devices.length) {
    throw new Error('此場地未啟用智能家居或未設定設備');
  }
  const results = [];
  for (const device of devices) {
    const result = await setDeviceSwitch(store, {
      deviceId: device.deviceId,
      switchCode: device.switchCode || 'switch_1',
      turnOn,
    });
    results.push({
      deviceId: device.deviceId,
      label: device.label,
      switchCode: device.switchCode || 'switch_1',
      turnOn,
      success: true,
      result,
    });
  }
  return results;
}

function assertStoreTuyaReady(store) {
  if (!store?.enableTuyaAutomation) {
    throw new Error('此店鋪未啟用 Tuya 智能家居');
  }
  if (!isTuyaConfigured(store)) {
    throw new Error('Tuya API 憑證未設定');
  }
}

module.exports = {
  getTuyaClient,
  getDeviceStatus,
  setDeviceSwitch,
  setCourtDevices,
  getActiveCourtDevices,
  assertStoreTuyaReady,
  isTuyaConfigured,
};
