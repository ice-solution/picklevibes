const {
  getHKCalendarYMD,
  bookingRangeUtcMs,
} = require('./bookingDateTime');

/**
 * 單筆預約 → 燈光時段（含預熱／緩衝）
 */
function bookingToLightWindow(ymdHk, startTime, endTime, buffers) {
  const pre = Math.max(0, Number(buffers.preBufferMinutes) || 0);
  const post = Math.max(0, Number(buffers.postBufferMinutes) || 0);
  const { startMs, endMs } = bookingRangeUtcMs(ymdHk, startTime, endTime);
  return {
    startMs: startMs - pre * 60 * 1000,
    endMs: endMs + post * 60 * 1000,
  };
}

/**
 * 合併空隙：兩時段間隔 ≤ mergeGapMinutes 則視為連續，不關燈
 */
function mergeLightWindows(windows, mergeGapMinutes = 0) {
  if (!windows.length) return [];
  const gapMs = Math.max(0, Number(mergeGapMinutes) || 0) * 60 * 1000;
  const sorted = [...windows].sort((a, b) => a.startMs - b.startMs);
  const merged = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.startMs - last.endMs <= gapMs) {
      last.endMs = Math.max(last.endMs, cur.endMs);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function isWithinLightWindows(windows, nowMs = Date.now()) {
  return windows.some((w) => nowMs >= w.startMs && nowMs < w.endMs);
}

function bookingsToLightWindows(bookings, buffers) {
  const windows = [];
  for (const booking of bookings || []) {
    const ymdHk = getHKCalendarYMD(booking.date);
    windows.push(
      bookingToLightWindow(ymdHk, booking.startTime, booking.endTime, buffers)
    );
  }
  return mergeLightWindows(windows, buffers.mergeGapMinutes);
}

module.exports = {
  bookingToLightWindow,
  mergeLightWindows,
  isWithinLightWindows,
  bookingsToLightWindows,
};
