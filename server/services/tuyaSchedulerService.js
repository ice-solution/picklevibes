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

const TZ = 'Asia/Hong_Kong';
const ACTIVE_STATUSES = ['confirmed', 'pending'];

/** courtId → { desiredOn, actualOn, updatedAt, reason } */
const courtStateCache = new Map();

function isCourtAutomationReady(store, court) {
  return (
    store?.enableTuyaAutomation
    && isTuyaConfigured(store)
    && court?.enableTuyaAutomation
    && tuyaService.getActiveCourtDevices(court).length > 0
  );
}

function getBookingQueryRange() {
  const ymdToday = getHKCalendarYMD(new Date());
  return {
    from: hkYmdToBookingUtcMidnight(addDaysToYmd(ymdToday, -1)),
    to: hkYmdToBookingUtcMidnight(addDaysToYmd(ymdToday, 2)),
  };
}

async function fetchCourtBookings(courtId) {
  const { from, to } = getBookingQueryRange();
  return Booking.find({
    court: courtId,
    status: { $in: ACTIVE_STATUSES },
    date: { $gte: from, $lte: to },
  })
    .select('date startTime endTime status court')
    .lean();
}

async function syncCourt(store, court, { reason = 'scheduled', nowMs = Date.now() } = {}) {
  const cacheKey = String(court._id);

  if (!isCourtAutomationReady(store, court)) {
    logTuya('info', `💡 Tuya [${court.name}] 略過同步（未啟用或未綁設備）`, {
      courtId: cacheKey,
      courtName: court.name,
      reason,
      action: 'skipped',
      detail: 'not_configured',
    });
    return { skipped: true, reason: 'not_configured', courtId: cacheKey, courtName: court.name };
  }

  const cfg = getStoreTuyaConfig(store);
  const bookings = await fetchCourtBookings(court._id);
  const windows = bookingsToLightWindows(bookings, cfg);
  const shouldOn = isWithinLightWindows(windows, nowMs);

  let reconcile;
  try {
    reconcile = await tuyaService.reconcileCourtDevices(store, court, shouldOn, { reason });
  } catch (err) {
    logTuya('error', `❌ Tuya [${court.name}] 同步失敗 (${reason})`, {
      courtId: cacheKey,
      courtName: court.name,
      reason,
      action: 'error',
      desiredOn: shouldOn,
      error: err.message,
    });
    throw err;
  }

  courtStateCache.set(cacheKey, {
    desiredOn: shouldOn,
    updatedAt: new Date(),
    reason,
    lastReconcile: {
      changed: reconcile.changed,
      unchanged: reconcile.unchanged,
      readFailed: reconcile.readFailed,
    },
  });

  const result = {
    courtId: cacheKey,
    courtName: court.name,
    action: reconcile.action,
    desiredOn: shouldOn,
    windowCount: windows.length,
    bookingCount: bookings.length,
    reason,
    devices: reconcile.devices,
    changedDeviceCount: reconcile.changed,
  };

  if (reconcile.changed > 0) {
    logTuya('info', `💡 Tuya [${court.name}] ${shouldOn ? '開燈' : '關燈'} (${reason}) · 修正 ${reconcile.changed} 設備 · ${windows.length} 時段 · ${bookings.length} 預約`, {
      courtId: cacheKey,
      courtName: court.name,
      reason,
      action: reconcile.action,
      desiredOn: shouldOn,
      windowCount: windows.length,
      bookingCount: bookings.length,
      changedDeviceCount: reconcile.changed,
      devices: reconcile.devices,
    });
  } else if (reconcile.readFailed > 0) {
    logTuya('warn', `⚠️ Tuya [${court.name}] 讀取部分設備失敗 (${reason}) · 目標 ${shouldOn ? '開' : '關'}`, {
      courtId: cacheKey,
      courtName: court.name,
      reason,
      action: reconcile.action,
      desiredOn: shouldOn,
      readFailed: reconcile.readFailed,
      devices: reconcile.devices,
    });
  } else {
    logTuya('info', `💡 Tuya [${court.name}] 狀態符合 (${reason}) · 目標 ${shouldOn ? '開' : '關'} · ${reconcile.unchanged} 設備 · ${windows.length} 時段`, {
      courtId: cacheKey,
      courtName: court.name,
      reason,
      action: 'unchanged',
      desiredOn: shouldOn,
      windowCount: windows.length,
      bookingCount: bookings.length,
      unchangedDeviceCount: reconcile.unchanged,
      devices: reconcile.devices,
    }, { silent: true });
  }

  return result;
}

async function syncCourtById(courtId, options = {}) {
  const court = await Court.findById(courtId);
  if (!court) {
    return { skipped: true, reason: 'court_not_found' };
  }
  const store = await Store.findById(court.store);
  if (!store) {
    return { skipped: true, reason: 'store_not_found' };
  }
  return syncCourt(store, court, options);
}

async function syncAllCourts(options = {}) {
  const stores = await Store.find({ enableTuyaAutomation: true }).lean();
  const storeMap = new Map(stores.map((s) => [String(s._id), s]));
  const storeIds = stores.map((s) => s._id);

  if (!storeIds.length) {
    return { synced: 0, results: [], message: '無啟用 Tuya 的店鋪' };
  }

  const courts = await Court.find({
    store: { $in: storeIds },
    enableTuyaAutomation: true,
    isActive: true,
  });

  const results = [];
  for (const court of courts) {
    const store = storeMap.get(String(court.store));
    try {
      const result = await syncCourt(store, court, options);
      results.push(result);
    } catch (err) {
      logTuya('error', `❌ Tuya 同步場地 ${court.name} 失敗`, {
        courtId: String(court._id),
        courtName: court.name,
        reason: options.reason || 'scheduled',
        action: 'error',
        error: err.message,
      });
      results.push({
        courtId: String(court._id),
        courtName: court.name,
        action: 'error',
        error: err.message,
      });
    }
  }

  const changed = results.filter((r) => (r.changedDeviceCount || 0) > 0).length;
  return {
    synced: courts.length,
    changed,
    results,
    timezone: TZ,
  };
}

/**
 * 非阻塞：預約建立／取消後立即重算該場地（臨時插單可即時開燈）
 */
function scheduleTuyaCourtSync(courtId, reason = 'booking_event') {
  if (!courtId) return;
  const id = String(courtId);
  setImmediate(() => {
    syncCourtById(id, { reason }).catch((err) => {
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
  unique.forEach((id) => scheduleTuyaCourtSync(id, reason));
}

function getCourtStateCache() {
  return Object.fromEntries(courtStateCache.entries());
}

function clearCourtStateCache(courtId) {
  if (courtId) {
    courtStateCache.delete(String(courtId));
  } else {
    courtStateCache.clear();
  }
}

module.exports = {
  syncCourt,
  syncCourtById,
  syncAllCourts,
  scheduleTuyaCourtSync,
  scheduleTuyaCourtsSync,
  fetchCourtBookings,
  getCourtStateCache,
  clearCourtStateCache,
  getTuyaActionLog,
  clearTuyaActionLog,
  isCourtAutomationReady,
};
