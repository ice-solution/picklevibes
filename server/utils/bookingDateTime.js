/**
 * 預約日期／時間與前台 BookingCalendar、活動佔場一致（香港牆鐘 + date 存 UTC 午夜 YYYY-MM-DD）
 */

function getHKCalendarYMD(dateObj) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(dateObj);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  return `${y}-${m}-${d}`;
}

/** 與 POST /bookings、活動佔場相同：YYYY-MM-DD 的 UTC 午夜 */
function hkYmdToBookingUtcMidnight(ymdStr) {
  if (!ymdStr || !/^\d{4}-\d{2}-\d{2}$/.test(ymdStr)) return new Date(ymdStr);
  return new Date(`${ymdStr}T00:00:00.000Z`);
}

function hkWallTimeToUtcMs(ymd, hhmm) {
  const parts = String(hhmm).split(':');
  const h = Number(parts[0]);
  const min = Number(parts[1] ?? 0);
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+08:00`).getTime();
}

function addDaysToYmd(ymd, days) {
  const noonMs = hkWallTimeToUtcMs(ymd, '12:00');
  return getHKCalendarYMD(new Date(noonMs + days * 86400000));
}

function hkBookingEndToUtcMs(ymd, endTime, startMs) {
  if (endTime === '24:00') {
    return hkWallTimeToUtcMs(addDaysToYmd(ymd, 1), '00:00');
  }
  let endMs = hkWallTimeToUtcMs(ymd, endTime);
  if (endMs <= startMs) {
    endMs = hkWallTimeToUtcMs(addDaysToYmd(ymd, 1), endTime);
  }
  return endMs;
}

/**
 * 將 API／表單傳入的 date 正規化為 Booking.date 儲存格式（UTC 午夜）
 */
function normalizeBookingDateInput(dateInput) {
  if (!dateInput) return new Date(dateInput);
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return hkYmdToBookingUtcMidnight(dateInput);
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return d;
  return hkYmdToBookingUtcMidnight(getHKCalendarYMD(d));
}

/**
 * 從 date 輸入取得香港日曆 YYYY-MM-DD
 */
function resolveHKYmd(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return getHKCalendarYMD(d);
}

/**
 * 香港牆鐘下的預約時段 [startMs, endMs)
 */
function bookingRangeUtcMs(ymdHk, startTime, endTime) {
  const startMs = hkWallTimeToUtcMs(ymdHk, startTime);
  const endMs = hkBookingEndToUtcMs(ymdHk, endTime, startMs);
  return { startMs, endMs };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

module.exports = {
  getHKCalendarYMD,
  hkYmdToBookingUtcMidnight,
  hkWallTimeToUtcMs,
  addDaysToYmd,
  hkBookingEndToUtcMs,
  normalizeBookingDateInput,
  resolveHKYmd,
  bookingRangeUtcMs,
  rangesOverlap
};
