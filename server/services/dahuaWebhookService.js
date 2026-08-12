/**
 * 大華 PictureHttpUpload webhook：掃自訂 QR → 驗預約時段 → 遠端開門
 */
const Store = require('../models/Store');
const Booking = require('../models/Booking');
const {
  getStoreAccessControlConfig,
  getAccessControlVendor,
  isAccessControlEnabled,
} = require('../utils/storeAccessControlConfig');
const dahuaAccessControlService = require('./dahuaAccessControlService');
const { parseAccessToken, buildTimeWindowMs } = dahuaAccessControlService;
const { resolveHKYmd } = require('../utils/bookingDateTime');

/** 短時內同一 TransmissionUuid 只開一次 */
const recentOpens = new Map();
const DEDUP_TTL_MS = 2 * 60 * 1000;

function pruneDedup(now = Date.now()) {
  for (const [k, t] of recentOpens) {
    if (now - t > DEDUP_TTL_MS) recentOpens.delete(k);
  }
}

function extractQrEvent(body) {
  if (!body || typeof body !== 'object') return null;
  if (body.Code !== 'AccessControl') return null;
  const data = body.Data || {};
  const method = Number(data.Method);
  if (method !== 14) return null;
  const qr = String(data.QRCode || data.QRCodeEx || '').trim();
  if (!qr) return null;
  return {
    qr,
    sn: String(data.SN || '').trim(),
    uuid: String(data.TransmissionUuid || `${qr}-${data.RealUTC || Date.now()}`),
    errorCode: data.ErrorCode,
    raw: data,
  };
}

async function resolveStoreFromHook({ storeIdOrSlug, sn }) {
  if (storeIdOrSlug) {
    const q = /^[a-f0-9]{24}$/i.test(storeIdOrSlug)
      ? { _id: storeIdOrSlug }
      : { slug: String(storeIdOrSlug).toLowerCase() };
    const store = await Store.findOne(q).lean();
    if (store) return store;
  }
  if (sn) {
    const store = await Store.findOne({
      dahuaDeviceSerial: sn,
      enableHikAccess: true,
      accessControlVendor: 'dahua',
    }).lean();
    if (store) return store;
  }
  // 單店／開發：唯一一間已啟用大華
  const stores = await Store.find({
    enableHikAccess: true,
    accessControlVendor: 'dahua',
  })
    .limit(2)
    .lean();
  if (stores.length === 1) return stores[0];
  return null;
}

function isBookingStatusOk(status) {
  return ['confirmed', 'pending', 'completed'].includes(String(status || ''));
}

/**
 * @returns {{ handled: boolean, opened?: boolean, reason?: string, bookingId?: string }}
 */
async function handleDahuaUpload({ body, storeIdOrSlug }) {
  const evt = extractQrEvent(body);
  if (!evt) {
    return { handled: false, reason: 'ignored_event' };
  }

  pruneDedup();
  if (recentOpens.has(evt.uuid)) {
    return { handled: true, opened: false, reason: 'duplicate', uuid: evt.uuid };
  }

  const store = await resolveStoreFromHook({ storeIdOrSlug, sn: evt.sn });
  if (!store) {
    console.warn('⚠️ 大華 webhook：找不到對應店鋪', { sn: evt.sn, storeIdOrSlug });
    return { handled: true, opened: false, reason: 'store_not_found', sn: evt.sn };
  }

  if (!isAccessControlEnabled(store) || getAccessControlVendor(store) !== 'dahua') {
    return { handled: true, opened: false, reason: 'store_dahua_disabled', storeId: store._id };
  }

  const config = getStoreAccessControlConfig(store);
  if (config.deviceSerial && evt.sn && config.deviceSerial !== evt.sn) {
    return {
      handled: true,
      opened: false,
      reason: 'sn_mismatch',
      expected: config.deviceSerial,
      got: evt.sn,
    };
  }

  const parsed = parseAccessToken(evt.qr, config);
  if (!parsed) {
    console.log('ℹ️ 大華 webhook：QR 非 PickCourt token', { qr: evt.qr.slice(0, 48), sn: evt.sn });
    return { handled: true, opened: false, reason: 'invalid_token', qr: evt.qr };
  }

  const booking = await Booking.findById(parsed.bookingId).lean();
  if (!booking) {
    return { handled: true, opened: false, reason: 'booking_not_found', bookingId: parsed.bookingId };
  }

  const bookingStoreId = String(booking.store || '');
  if (bookingStoreId && bookingStoreId !== String(store._id)) {
    return {
      handled: true,
      opened: false,
      reason: 'store_mismatch',
      bookingId: parsed.bookingId,
    };
  }

  if (!isBookingStatusOk(booking.status)) {
    return {
      handled: true,
      opened: false,
      reason: 'booking_status',
      status: booking.status,
      bookingId: parsed.bookingId,
    };
  }

  // 優先用預約時寫入的 tempAuth 時窗；否則用現時 buffer 重算
  let windowStartMs;
  let windowEndMs;
  if (booking.tempAuth?.startTime && booking.tempAuth?.endTime) {
    windowStartMs = new Date(booking.tempAuth.startTime).getTime();
    windowEndMs = new Date(booking.tempAuth.endTime).getTime();
  } else {
    const ymd = resolveHKYmd(booking.date);
    const win = buildTimeWindowMs(
      {
        date: ymd,
        startTime: booking.startTime,
        endTime: booking.endTime,
      },
      config.preBufferMinutes,
      config.postBufferMinutes
    );
    windowStartMs = win.windowStartMs;
    windowEndMs = win.windowEndMs;
  }

  const now = Date.now();
  if (Number.isNaN(windowStartMs) || Number.isNaN(windowEndMs) || now < windowStartMs || now > windowEndMs) {
    return {
      handled: true,
      opened: false,
      reason: 'outside_window',
      bookingId: parsed.bookingId,
      now: new Date(now).toISOString(),
      start: new Date(windowStartMs).toISOString(),
      end: new Date(windowEndMs).toISOString(),
    };
  }

  if (!config.deviceHost || !config.devicePassword) {
    return { handled: true, opened: false, reason: 'device_not_configured', storeId: store._id };
  }

  recentOpens.set(evt.uuid, now);

  try {
    const openRes = await dahuaAccessControlService.openDoorForConfig(config);
    if (!openRes.ok) {
      recentOpens.delete(evt.uuid);
      console.error('❌ 大華 openDoor 失敗', openRes);
      return {
        handled: true,
        opened: false,
        reason: 'open_failed',
        bookingId: parsed.bookingId,
        open: openRes,
      };
    }
    console.log('✅ 大華遠端開門成功', {
      bookingId: parsed.bookingId,
      store: store.slug || store.name,
      sn: evt.sn,
    });
    return {
      handled: true,
      opened: true,
      reason: 'opened',
      bookingId: parsed.bookingId,
      storeId: String(store._id),
      uuid: evt.uuid,
    };
  } catch (err) {
    recentOpens.delete(evt.uuid);
    console.error('❌ 大華 openDoor 例外', err.message);
    return {
      handled: true,
      opened: false,
      reason: 'open_exception',
      bookingId: parsed.bookingId,
      error: err.message,
    };
  }
}

module.exports = {
  handleDahuaUpload,
  extractQrEvent,
  resolveStoreFromHook,
};
