const Store = require('../models/Store');
const Booking = require('../models/Booking');
const weekendService = require('./weekendService');
const whatsappMessaging = require('./whatsappMessagingService');

const TZ = 'Asia/Hong_Kong';

/** YYYY-MM-DD in Asia/Hong_Kong */
function hkDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date instanceof Date ? date : new Date(date));
}

/** HH:mm in Asia/Hong_Kong */
function hkTimeHm(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date instanceof Date ? date : new Date(date));
}

function toMinutes(hm) {
  const m = String(hm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  if (h === 24) return 24 * 60;
  return h * 60 + min;
}

function toPlainBooking(booking) {
  if (!booking) return null;
  if (typeof booking.toObject === 'function') {
    return booking.toObject({ depopulate: false });
  }
  return booking;
}

function addDaysToHkDateString(dateStr, days) {
  const base = new Date(`${dateStr}T12:00:00+08:00`);
  base.setDate(base.getDate() + days);
  return hkDateString(base);
}

function daysBetweenHk(fromStr, toStr) {
  const a = new Date(`${fromStr}T12:00:00+08:00`);
  const b = new Date(`${toStr}T12:00:00+08:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** 相對「今日 00:00」的分鐘數，方便比較跨日窗口 */
function minutesFromToday(todayStr, dateStr, hmMinutes) {
  return daysBetweenHk(todayStr, dateStr) * 24 * 60 + hmMinutes;
}

/**
 * 當前加冷氣窗口：[From, To)。From>To 視為跨日（例今晚 20:00 → 明早 08:00）。
 * 只通知場次時間與這個窗口有重疊的預約，唔會發未來日子（例如 8/21）嘅場。
 */
function isBookingInCurrentNotifyWindow(booking, cfg, now = new Date()) {
  if (!booking) return false;
  const todayStr = hkDateString(now);
  const bookingDateStr = hkDateString(booking.date);
  const fromM = toMinutes(cfg.notifyPeriodFrom);
  const toM = toMinutes(cfg.notifyPeriodTo);
  const startM = toMinutes(booking.startTime);
  let endM = toMinutes(booking.endTime);
  if (fromM == null || toM == null || startM == null || endM == null) return false;
  if (booking.endTime === '24:00') endM = 24 * 60;

  const wrapsOvernight = fromM > toM;
  const windowEndDate = wrapsOvernight ? addDaysToHkDateString(todayStr, 1) : todayStr;

  const bStart = minutesFromToday(todayStr, bookingDateStr, startM);
  let bEnd = minutesFromToday(todayStr, bookingDateStr, endM);
  if (endM <= startM) {
    bEnd = minutesFromToday(todayStr, addDaysToHkDateString(bookingDateStr, 1), endM);
  }

  const wStart = minutesFromToday(todayStr, todayStr, fromM);
  const wEnd = minutesFromToday(todayStr, windowEndDate, toM);

  return bStart < wEnd && bEnd > wStart;
}

/**
 * 判斷現在是否在 from–to 時段內（支援跨日，例 20:00–08:00）
 */
function isNowInNotifyPeriod(fromHm, toHm, now = new Date()) {
  const nowM = toMinutes(hkTimeHm(now));
  const fromM = toMinutes(fromHm);
  const toM = toMinutes(toHm);
  if (nowM == null || fromM == null || toM == null) return false;
  if (fromM === toM) return true;
  if (fromM < toM) return nowM >= fromM && nowM < toM;
  return nowM >= fromM || nowM < toM;
}

function normalizeNotifyConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const phones = Array.isArray(cfg.notifyPhones)
    ? cfg.notifyPhones.map((p) => String(p || '').trim()).filter(Boolean)
    : [];
  return {
    enabled: cfg.enabled === true,
    notifyPhones: phones,
    notifyPeriodFrom: String(cfg.notifyPeriodFrom || '20:00').trim() || '20:00',
    notifyPeriodTo: String(cfg.notifyPeriodTo || '08:00').trim() || '08:00',
    holidayNotifyEnabled: cfg.holidayNotifyEnabled === true,
  };
}

function formatBookingLine(b, { includeDate = false } = {}) {
  const courtName = b.court?.name || '場地';
  const courtNo = b.court?.number != null ? `（${b.court.number}號）` : '';
  const userName = b.user?.name || b.players?.[0]?.name || '客人';
  const phone = b.players?.[0]?.phone || b.user?.phone || '';
  const datePart = includeDate && b.date ? `${hkDateString(b.date)} ` : '';
  return `• ${datePart}${b.startTime}-${b.endTime} ${courtName}${courtNo} · ${userName}${phone ? ` ${phone}` : ''}`;
}

/** v1 詳細格式已備份於 docs/OPENWA_DUTY_MESSAGE_FORMAT.md */

/** v2：僅時間 HH:mm-HH:mm（加冷氣用） */
function formatAcTimeOnly(b) {
  if (!b?.startTime || !b?.endTime) return null;
  return `${b.startTime}-${b.endTime}`;
}

/** v2：日期 + 時間（時段內新增預約） */
function formatAcDateTime(b) {
  if (!b?.startTime || !b?.endTime) return null;
  const dateStr = b._digestDate || (b.date ? hkDateString(b.date) : '');
  return dateStr ? `${dateStr} ${b.startTime}-${b.endTime}` : `${b.startTime}-${b.endTime}`;
}

/** 同一時段多場只保留一條時間 */
function uniqueAcTimeLines(bookings, lineFn) {
  const seen = new Set();
  const lines = [];
  for (const b of bookings) {
    if (!b?.startTime || !b?.endTime) continue;
    const key = `${b._digestDate || hkDateString(b.date) || ''}|${b.startTime}|${b.endTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const line = lineFn(b);
    if (line) lines.push(line);
  }
  return lines;
}

function buildAcHeader(storeName) {
  return `${storeName || 'PickleVibes'}需要加冷氣時間：`;
}

/**
 * 匯總當前加冷氣窗口內的場次（與窗口有時間重疊先算）
 */
async function loadBookingsInNotifyPeriod(storeId, cfg, now = new Date()) {
  const todayStr = hkDateString(now);
  const fromM = toMinutes(cfg.notifyPeriodFrom);
  const toM = toMinutes(cfg.notifyPeriodTo);
  if (fromM == null || toM == null) return { todayStr, nextStr: null, bookings: [] };

  const wrapsOvernight = fromM > toM;
  const nextStr = wrapsOvernight ? addDaysToHkDateString(todayStr, 1) : null;
  const dateStrs = wrapsOvernight ? [todayStr, nextStr] : [todayStr];

  const inPeriod = [];
  for (const dateStr of dateStrs) {
    const dayBookings = await loadStoreBookingsForDate(storeId, dateStr);
    for (const b of dayBookings) {
      if (!isBookingInCurrentNotifyWindow(b, cfg, now)) continue;
      inPeriod.push({ ...b, _digestDate: dateStr });
    }
  }

  inPeriod.sort((a, b) => {
    const da = a._digestDate || '';
    const db = b._digestDate || '';
    if (da !== db) return da.localeCompare(db);
    return String(a.startTime).localeCompare(String(b.startTime));
  });

  return { todayStr, nextStr, bookings: inPeriod, wrapsOvernight };
}

async function loadStoreBookingsForDate(storeId, dateStr) {
  const dayStart = new Date(`${dateStr}T00:00:00+08:00`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999+08:00`);
  return Booking.find({
    store: storeId,
    date: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['confirmed', 'pending'] },
  })
    .populate('court', 'name number')
    .populate('user', 'name phone')
    .sort({ startTime: 1 })
    .lean();
}

async function sendToStorePhones(store, message, templatePayload = null) {
  const cfg = normalizeNotifyConfig(store.overnightDutyNotify);
  if (!cfg.enabled || !cfg.notifyPhones.length) {
    return { skipped: true, reason: 'not_enabled_or_no_phones' };
  }
  if (!whatsappMessaging.isWhatsAppConfigured()) {
    console.warn('⚠️ WhatsApp 未設定，略過夜間值班通知');
    return { skipped: true, reason: 'whatsapp_not_configured' };
  }

  const provider = whatsappMessaging.resolveProvider();
  if (provider === 'cloud' && templatePayload) {
    const results = [];
    for (const phone of cfg.notifyPhones) {
      try {
        let r;
        if (templatePayload.kind === 'new') {
          r = await whatsappMessaging.sendOvernightNewBooking(
            phone,
            {
              storeName: templatePayload.storeName,
              dateTimeLine: templatePayload.dateTimeLine,
            },
            message
          );
        } else {
          r = await whatsappMessaging.sendOvernightAcSummary(
            phone,
            {
              storeName: templatePayload.storeName,
              timeLinesBlock: templatePayload.timeLinesBlock,
            },
            message
          );
        }
        results.push({ phone, ok: !!r.success, ...r });
      } catch (error) {
        results.push({ phone, ok: false, error: error.message });
      }
    }
    return { skipped: false, results };
  }

  const results = await whatsappMessaging.sendTextToMany(cfg.notifyPhones, message);
  return { skipped: false, results };
}

/**
 * 新建預約：而家喺 notifyPeriod 內，而且呢場本身落喺當前加冷氣窗口，先即時通知
 */
async function notifyOnBookingCreated(booking) {
  try {
    const storeId = booking.store?._id || booking.store;
    if (!storeId) return { skipped: true, reason: 'no_store' };

    const store = await Store.findById(storeId).lean();
    if (!store) return { skipped: true, reason: 'store_not_found' };

    const cfg = normalizeNotifyConfig(store.overnightDutyNotify);
    if (!cfg.enabled) return { skipped: true, reason: 'disabled' };
    if (!isNowInNotifyPeriod(cfg.notifyPeriodFrom, cfg.notifyPeriodTo)) {
      return { skipped: true, reason: 'outside_period' };
    }

    let populated = toPlainBooking(booking);
    if (!populated?.startTime || !populated?.endTime || !populated?.court?.name) {
      populated = await Booking.findById(booking._id)
        .populate('court', 'name number')
        .populate('user', 'name phone')
        .lean();
    }
    if (!populated) return { skipped: true, reason: 'booking_not_found' };
    if (!isBookingInCurrentNotifyWindow(populated, cfg)) {
      return { skipped: true, reason: 'booking_outside_window' };
    }

    const line = formatAcDateTime({
      ...populated,
      _digestDate: hkDateString(populated.date),
    });
    if (!line) return { skipped: true, reason: 'missing_times' };

    const msg = [buildAcHeader(store.name), line].join('\n');
    return sendToStorePhones(store, msg, {
      kind: 'new',
      storeName: store.name,
      dateTimeLine: line,
    });
  } catch (error) {
    console.error('❌ 夜間值班即時通知失敗:', error);
    return { skipped: true, error: error.message };
  }
}

/**
 * 時段開始整點（例 20:00）：匯總 notify period 內場次（含跨日凌晨）
 */
async function runEveningDigestForStore(store, now = new Date()) {
  const cfg = normalizeNotifyConfig(store.overnightDutyNotify);
  if (!cfg.enabled || !cfg.notifyPhones.length) return { skipped: true };

  const { bookings } = await loadBookingsInNotifyPeriod(store._id, cfg, now);
  if (!bookings.length) {
    return { skipped: true, reason: 'no_bookings_in_period' };
  }

  const timeLines = uniqueAcTimeLines(bookings, formatAcTimeOnly);
  if (!timeLines.length) {
    return { skipped: true, reason: 'no_valid_times' };
  }
  const msg = [buildAcHeader(store.name), ...timeLines].join('\n');

  return sendToStorePhones(store, msg, {
    kind: 'summary',
    storeName: store.name,
    timeLinesBlock: timeLines.join('\n'),
  });
}

/**
 * 每日 08:00：若啟用紅日通知且今日為紅日 → 發送當日全部場次
 */
async function runHolidayMorningDigestForStore(store, now = new Date()) {
  const cfg = normalizeNotifyConfig(store.overnightDutyNotify);
  if (!cfg.enabled || !cfg.holidayNotifyEnabled || !cfg.notifyPhones.length) {
    return { skipped: true, reason: 'holiday_notify_off' };
  }

  await weekendService.initialize();

  const dateStr = hkDateString(now);
  const checkDate = new Date(`${dateStr}T12:00:00+08:00`);
  if (!weekendService.isHoliday(checkDate)) {
    return { skipped: true, reason: 'not_holiday' };
  }

  const bookings = await loadStoreBookingsForDate(store._id, dateStr);
  const withDate = bookings.map((b) => ({ ...b, _digestDate: dateStr }));
  const timeLines = uniqueAcTimeLines(withDate, formatAcTimeOnly);
  if (!timeLines.length) {
    return { skipped: true, reason: 'no_bookings' };
  }
  const msg = [buildAcHeader(store.name), ...timeLines].join('\n');

  return sendToStorePhones(store, msg, {
    kind: 'summary',
    storeName: store.name,
    timeLinesBlock: timeLines.join('\n'),
  });
}

/** 防止同一分鐘重複發送 */
const _digestSentKeys = new Set();

function onceKey(parts) {
  return parts.join('|');
}

async function tickSchedulers(now = new Date()) {
  const hm = hkTimeHm(now);
  const dateStr = hkDateString(now);
  const stores = await Store.find({
    'overnightDutyNotify.enabled': true,
  }).lean();

  const results = [];

  for (const store of stores) {
    const cfg = normalizeNotifyConfig(store.overnightDutyNotify);

    // 晚間匯總：到 notifyPeriodFrom 整分觸發
    if (hm === cfg.notifyPeriodFrom) {
      const key = onceKey(['evening', store._id, dateStr, hm]);
      if (!_digestSentKeys.has(key)) {
        _digestSentKeys.add(key);
        results.push({
          type: 'evening',
          storeId: String(store._id),
          result: await runEveningDigestForStore(store, now),
        });
      }
    }

    // 紅日：每日 08:00
    if (hm === '08:00' && cfg.holidayNotifyEnabled) {
      const key = onceKey(['holiday', store._id, dateStr]);
      if (!_digestSentKeys.has(key)) {
        _digestSentKeys.add(key);
        results.push({
          type: 'holiday',
          storeId: String(store._id),
          result: await runHolidayMorningDigestForStore(store, now),
        });
      }
    }
  }

  // 簡單清理：超過約 2 日的 key
  if (_digestSentKeys.size > 500) {
    _digestSentKeys.clear();
  }

  return results;
}

module.exports = {
  normalizeNotifyConfig,
  isNowInNotifyPeriod,
  hkDateString,
  hkTimeHm,
  notifyOnBookingCreated,
  runEveningDigestForStore,
  runHolidayMorningDigestForStore,
  loadBookingsInNotifyPeriod,
  isBookingInCurrentNotifyWindow,
  tickSchedulers,
};
