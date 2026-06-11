const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const { getStoreTuyaConfig, isTuyaConfigured } = require('../utils/storeTuyaConfig');
const { logTuya } = require('../utils/tuyaActionLog');

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
 * 從 Tuya status API 回傳解析開關狀態
 * @returns {boolean|null} true=開, false=關, null=讀取失敗或找不到 DP
 */
function parseSwitchFromStatus(statusResponse, switchCode = 'switch_1') {
  if (!statusResponse?.success) return null;
  const list = statusResponse.result;
  if (!Array.isArray(list)) return null;

  const entry = list.find((item) => item.code === switchCode);
  if (!entry) return null;

  const { value } = entry;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return null;
}

async function getDeviceSwitchState(store, { deviceId, switchCode = 'switch_1' }) {
  const status = await getDeviceStatus(store, deviceId);
  return parseSwitchFromStatus(status, switchCode);
}

/**
 * 讀取場地所有設備實際開關狀態
 */
async function getCourtDevicesState(store, court) {
  const devices = getActiveCourtDevices(court);
  const results = [];
  for (const device of devices) {
    const switchCode = device.switchCode || 'switch_1';
    let isOn = null;
    try {
      isOn = await getDeviceSwitchState(store, {
        deviceId: device.deviceId,
        switchCode,
      });
    } catch (err) {
      results.push({
        deviceId: device.deviceId,
        label: device.label,
        switchCode,
        isOn: null,
        readError: err.message,
      });
      continue;
    }
    results.push({
      deviceId: device.deviceId,
      label: device.label,
      switchCode,
      isOn,
    });
  }
  return results;
}

/**
 * 對照目標狀態與硬件，僅對單一設備下指令（控制區同步用）
 */
async function reconcileDevice(store, device, turnOn, {
  reason = 'reconcile',
  contextLabel = '設備',
  zoneId,
  zoneName,
  courtIds,
} = {}) {
  const switchCode = device.switchCode || 'switch_1';
  const targetOn = Boolean(turnOn);
  let actualOn = null;
  let readFailed = 0;

  try {
    actualOn = await getDeviceSwitchState(store, {
      deviceId: device.deviceId,
      switchCode,
    });
  } catch (err) {
    readFailed = 1;
    logTuya('warn', `⚠️ Tuya [${contextLabel}] 讀取 ${device.label || device.deviceId} 失敗，將嘗試${targetOn ? '開' : '關'}`, {
      zoneId,
      zoneName,
      courtIds,
      reason,
      deviceId: device.deviceId,
      deviceLabel: device.label,
      switchCode,
      action: 'read_failed',
      targetOn,
      error: err.message,
    });
  }

  if (actualOn === targetOn) {
    logTuya('info', `💡 Tuya [${contextLabel}] ${device.label || device.deviceId} 已是${targetOn ? '開' : '關'}（無需變更）`, {
      zoneId,
      zoneName,
      courtIds,
      reason,
      deviceId: device.deviceId,
      deviceLabel: device.label,
      switchCode,
      action: 'unchanged',
      actualOn,
      targetOn,
    }, { silent: true });
    return {
      action: 'unchanged',
      targetOn,
      changed: 0,
      unchanged: 1,
      readFailed,
      device: {
        deviceId: device.deviceId,
        label: device.label,
        switchCode,
        action: 'unchanged',
        actualOn,
        targetOn,
      },
    };
  }

  const control = await setDeviceSwitch(store, {
    deviceId: device.deviceId,
    switchCode,
    turnOn: targetOn,
  });
  logTuya('info', `💡 Tuya [${contextLabel}] ${device.label || device.deviceId} ${actualOn == null ? '未知→' : (actualOn ? '開→' : '關→')}${targetOn ? '開' : '關'}`, {
    zoneId,
    zoneName,
    courtIds,
    reason,
    deviceId: device.deviceId,
    deviceLabel: device.label,
    switchCode,
    action: targetOn ? 'on' : 'off',
    actualOn,
    targetOn,
  });
  return {
    action: targetOn ? 'on' : 'off',
    targetOn,
    changed: 1,
    unchanged: 0,
    readFailed,
    device: {
      deviceId: device.deviceId,
      label: device.label,
      switchCode,
      action: targetOn ? 'on' : 'off',
      actualOn,
      targetOn,
      success: true,
      control,
    },
  };
}

/**
 * 對照目標狀態與硬件，僅對不一致的設備下指令（舊版場地綁定）
 */
async function reconcileCourtDevices(store, court, turnOn, { reason = 'reconcile' } = {}) {
  const devices = getActiveCourtDevices(court);
  if (!devices.length) {
    throw new Error('此場地未啟用智能家居或未設定設備');
  }

  const targetOn = Boolean(turnOn);
  const courtId = String(court._id);
  const courtName = court.name;
  const results = [];
  let changed = 0;
  let unchanged = 0;
  let readFailed = 0;

  for (const device of devices) {
    const row = await reconcileDevice(store, device, targetOn, {
      reason,
      contextLabel: courtName,
      courtIds: [courtId],
    });
    results.push(row.device);
    changed += row.changed;
    unchanged += row.unchanged;
    readFailed += row.readFailed;
  }

  let action = 'unchanged';
  if (changed > 0) action = targetOn ? 'on' : 'off';
  else if (readFailed > 0 && unchanged === 0) action = 'error';

  return {
    action,
    targetOn,
    changed,
    unchanged,
    readFailed,
    devices: results,
  };
}

/**
 * 對控制區所有設備下達同一開關狀態（不查硬件，供後台手動測試）
 */
async function setZoneDevices(store, devices, turnOn) {
  const active = (devices || []).filter((d) => d.enabled !== false && d.deviceId);
  if (!active.length) {
    throw new Error('控制區未設定設備');
  }
  const results = [];
  for (const device of active) {
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

/**
 * 對場地所有啟用設備下達同一開關狀態（不查硬件，供後台手動測試）
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
  parseSwitchFromStatus,
  getDeviceSwitchState,
  getCourtDevicesState,
  reconcileDevice,
  reconcileCourtDevices,
  setDeviceSwitch,
  setCourtDevices,
  setZoneDevices,
  getActiveCourtDevices,
  assertStoreTuyaReady,
  isTuyaConfigured,
};
