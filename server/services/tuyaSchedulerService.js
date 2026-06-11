const Booking = require('../models/Booking');
const Court = require('../models/Court');
const Store = require('../models/Store');
const tuyaService = require('./tuyaService');
const { getStoreTuyaConfig, isTuyaConfigured } = require('../utils/storeTuyaConfig');
const {
  getHKCalendarYMD,
  hkYmdToBookingUtcMidnight,
  addDaysToYmd,
} = require('../utils/bookingDateTime');
const { bookingsToLightWindows, isWithinLightWindows } = require('../utils/tuyaLightWindows');
const { logTuya, getTuyaActionLog, clearTuyaActionLog } = require('../utils/tuyaActionLog');
const { tuyaDeviceKey } = require('../utils/tuyaDevices');
const {
  resolveStoreZones,
  storeHasAutomationConfig,
} = require('../utils/tuyaZones');

const TZ = 'Asia/Hong_Kong';
const ACTIVE_STATUSES = ['confirmed', 'pending'];

/** deviceKey → { desiredOn, updatedAt, reason, zones } */
const deviceStateCache = new Map();

function getBookingQueryRange() {
  const ymdToday = getHKCalendarYMD(new Date());
  return {
    from: hkYmdToBookingUtcMidnight(addDaysToYmd(ymdToday, -1)),
    to: hkYmdToBookingUtcMidnight(addDaysToYmd(ymdToday, 2)),
  };
}

async function fetchBookingsForCourts(courtIds) {
  const ids = [...new Set((courtIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];

  const { from, to } = getBookingQueryRange();
  return Booking.find({
    court: { $in: ids },
    status: { $in: ACTIVE_STATUSES },
    date: { $gte: from, $lte: to },
  })
    .select('date startTime endTime status court')
    .lean();
}

/** @deprecated 保留給 tuyaTest plan 等工具 */
async function fetchCourtBookings(courtId) {
  return fetchBookingsForCourts([courtId]);
}

function isCourtAutomationReady(store, court) {
  return (
    store?.enableTuyaAutomation
    && isTuyaConfigured(store)
    && court?.enableTuyaAutomation
    && tuyaService.getActiveCourtDevices(court).length > 0
  );
}

/**
 * 依控制區計算每個唯一設備的目標狀態（多控制區 OR 合併）
 */
async function buildDeviceSyncPlanAsync(store, courts, { nowMs = Date.now() } = {}) {
  const cfg = getStoreTuyaConfig(store);
  const zones = resolveStoreZones(store, courts);
  const plan = new Map();

  for (const zone of zones) {
    if (!zone.enabled || !zone.devices.length || !zone.courtIds.length) continue;

    const bookings = await fetchBookingsForCourts(zone.courtIds);
    const windows = bookingsToLightWindows(bookings, cfg);
    const shouldOn = isWithinLightWindows(windows, nowMs);

    for (const device of zone.devices) {
      const key = tuyaDeviceKey(device);
      let entry = plan.get(key);
      if (!entry) {
        entry = {
          device,
          shouldOn: false,
          zones: [],
        };
        plan.set(key, entry);
      }
      entry.shouldOn = entry.shouldOn || shouldOn;
      entry.zones.push({
        zoneId: zone._id,
        zoneName: zone.name,
        legacy: zone.legacy,
        shouldOn,
        windowCount: windows.length,
        bookingCount: bookings.length,
        courtIds: zone.courtIds,
      });
    }
  }

  return { cfg, zones, plan, nowMs };
}

async function syncStore(store, { reason = 'scheduled', nowMs = Date.now() } = {}) {
  const storeId = String(store._id);

  if (!store?.enableTuyaAutomation || !isTuyaConfigured(store)) {
    return {
      skipped: true,
      reason: 'store_not_configured',
      storeId,
      storeName: store?.name,
    };
  }

  const courts = await Court.find({ store: store._id, isActive: true }).lean();
  if (!storeHasAutomationConfig(store, courts)) {
    logTuya('info', `💡 Tuya [${store.name}] 略過同步（未設定控制區）`, {
      storeId,
      reason,
      action: 'skipped',
      detail: 'no_zones',
    });
    return {
      skipped: true,
      reason: 'no_zones',
      storeId,
      storeName: store.name,
      synced: 0,
      results: [],
    };
  }

  const { plan } = await buildDeviceSyncPlanAsync(store, courts, { nowMs });
  const results = [];
  let changedDevices = 0;

  for (const [deviceKey, entry] of plan.entries()) {
    const contextLabel = entry.zones.map((z) => z.zoneName).join(' + ') || '設備';
    const zoneIds = entry.zones.map((z) => z.zoneId);
    const courtIds = [...new Set(entry.zones.flatMap((z) => z.courtIds))];

    let reconcile;
    try {
      reconcile = await tuyaService.reconcileDevice(store, entry.device, entry.shouldOn, {
        reason,
        contextLabel,
        zoneId: zoneIds.join(','),
        zoneName: contextLabel,
        courtIds,
      });
    } catch (err) {
      logTuya('error', `❌ Tuya [${contextLabel}] 設備同步失敗 (${reason})`, {
        storeId,
        deviceKey,
        zoneName: contextLabel,
        reason,
        action: 'error',
        desiredOn: entry.shouldOn,
        error: err.message,
      });
      results.push({
        deviceKey,
        deviceId: entry.device.deviceId,
        label: entry.device.label,
        action: 'error',
        desiredOn: entry.shouldOn,
        zones: entry.zones,
        error: err.message,
      });
      continue;
    }

    deviceStateCache.set(deviceKey, {
      desiredOn: entry.shouldOn,
      updatedAt: new Date(),
      reason,
      zones: entry.zones,
      lastReconcile: {
        changed: reconcile.changed,
        unchanged: reconcile.unchanged,
        readFailed: reconcile.readFailed,
      },
    });

    if (reconcile.changed > 0) changedDevices += 1;

    const result = {
      deviceKey,
      deviceId: entry.device.deviceId,
      label: entry.device.label,
      action: reconcile.action,
      desiredOn: entry.shouldOn,
      reason,
      zones: entry.zones,
      changedDeviceCount: reconcile.changed,
      device: reconcile.device,
    };
    results.push(result);

    if (reconcile.changed > 0) {
      logTuya('info', `💡 Tuya [${contextLabel}] ${entry.shouldOn ? '開燈' : '關燈'} (${reason}) · ${entry.device.label || entry.device.deviceId}`, {
        storeId,
        deviceKey,
        zoneName: contextLabel,
        reason,
        action: reconcile.action,
        desiredOn: entry.shouldOn,
        zones: entry.zones,
      });
    }
  }

  return {
    storeId,
    storeName: store.name,
    synced: plan.size,
    changedDevices,
    results,
    timezone: TZ,
  };
}

async function syncStoreById(storeId, options = {}) {
  const store = await Store.findById(storeId);
  if (!store) {
    return { skipped: true, reason: 'store_not_found' };
  }
  return syncStore(store, options);
}

async function syncAllCourts(options = {}) {
  const stores = await Store.find({ enableTuyaAutomation: true });
  if (!stores.length) {
    return { synced: 0, changed: 0, results: [], message: '無啟用 Tuya 的店鋪' };
  }

  const storeResults = [];
  let totalDevices = 0;
  let changedDevices = 0;

  for (const store of stores) {
    try {
      const result = await syncStore(store, options);
      storeResults.push(result);
      totalDevices += result.synced || 0;
      changedDevices += result.changedDevices || 0;
    } catch (err) {
      logTuya('error', `❌ Tuya 同步店鋪 ${store.name} 失敗`, {
        storeId: String(store._id),
        storeName: store.name,
        reason: options.reason || 'scheduled',
        action: 'error',
        error: err.message,
      });
      storeResults.push({
        storeId: String(store._id),
        storeName: store.name,
        action: 'error',
        error: err.message,
      });
    }
  }

  const changedStores = storeResults.filter((r) => (r.changedDevices || 0) > 0).length;
  return {
    synced: totalDevices,
    changed: changedStores,
    changedDevices,
    storeResults,
    results: storeResults,
    timezone: TZ,
  };
}

/** 預覽單一控制區（或舊版單場地）燈光時段 */
async function previewZonePlan(store, zone, { nowMs = Date.now() } = {}) {
  const cfg = getStoreTuyaConfig(store);
  const bookings = await fetchBookingsForCourts(zone.courtIds);
  const windows = bookingsToLightWindows(bookings, cfg);
  const shouldOn = isWithinLightWindows(windows, nowMs);
  return { bookings, windows, shouldOn, cfg };
}

async function syncCourtById(courtId, options = {}) {
  const court = await Court.findById(courtId);
  if (!court) {
    return { skipped: true, reason: 'court_not_found' };
  }
  return syncStoreById(court.store, {
    ...options,
    triggerCourtId: String(courtId),
  });
}

/**
 * 非阻塞：預約建立／取消後重算該店鋪所有控制區（OR 邏輯需整店重算）
 */
function scheduleTuyaCourtSync(courtId, reason = 'booking_event') {
  if (!courtId) return;
  const id = String(courtId);
  setImmediate(() => {
    Court.findById(id)
      .then((court) => {
        if (!court) return null;
        return syncStoreById(court.store, { reason, triggerCourtId: id });
      })
      .catch((err) => {
        logTuya('error', `❌ Tuya 即時同步失敗 (${id})`, {
          courtId: id,
          reason,
          action: 'error',
          error: err.message,
        });
      });
  });
}

function scheduleTuyaCourtsSync(courtIds, reason = 'booking_event') {
  const unique = [...new Set((courtIds || []).filter(Boolean).map(String))];
  if (!unique.length) return;

  setImmediate(() => {
    Court.find({ _id: { $in: unique } })
      .select('store')
      .lean()
      .then((courts) => {
        const storeIds = [...new Set(courts.map((c) => String(c.store)))];
        return Promise.all(
          storeIds.map((storeId) => syncStoreById(storeId, { reason, triggerCourtIds: unique }))
        );
      })
      .catch((err) => {
        logTuya('error', '❌ Tuya 即時同步失敗（多場地）', {
          courtIds: unique,
          reason,
          action: 'error',
          error: err.message,
        });
      });
  });
}

function getCourtStateCache() {
  return Object.fromEntries(deviceStateCache.entries());
}

function clearCourtStateCache(deviceKey) {
  if (deviceKey) {
    deviceStateCache.delete(String(deviceKey));
  } else {
    deviceStateCache.clear();
  }
}

module.exports = {
  syncStore,
  syncStoreById,
  syncCourt: syncCourtById,
  syncCourtById,
  syncAllCourts,
  scheduleTuyaCourtSync,
  scheduleTuyaCourtsSync,
  fetchCourtBookings,
  fetchBookingsForCourts,
  previewZonePlan,
  buildDeviceSyncPlanAsync,
  getCourtStateCache,
  clearCourtStateCache,
  getTuyaActionLog,
  clearTuyaActionLog,
  isCourtAutomationReady,
};
