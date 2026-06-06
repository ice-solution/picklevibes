const TZ = 'Asia/Hong_Kong';
const MAX_ENTRIES = 500;

/** @type {Array<object>} */
const entries = [];
let seq = 0;

function formatHKTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const pick = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}:${pick('second')} HKT`;
}

function logPrefix() {
  return `[${formatHKTime()}]`;
}

/**
 * 寫入 console 並存入記憶體（供 debug API 查閱）
 * @param {object} [opts]
 * @param {boolean} [opts.silent] 僅存記憶體，不輸出 console
 */
function logTuya(level, message, meta = {}, opts = {}) {
  const at = new Date();
  const row = {
    id: ++seq,
    at: at.toISOString(),
    atHK: formatHKTime(at),
    level,
    message,
    ...meta,
  };

  entries.push(row);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  if (opts.silent) return row;

  const line = `${logPrefix()} ${message}`;
  if (level === 'error') {
    console.error(line, meta.detail || meta.error || '');
  } else if (level === 'warn') {
    console.warn(line, meta.detail || '');
  } else {
    console.log(line);
  }

  return row;
}

function getTuyaActionLog({ limit = 100, courtId, sinceId } = {}) {
  let list = [...entries];
  if (courtId) {
    list = list.filter((e) => e.courtId === String(courtId));
  }
  if (sinceId) {
    list = list.filter((e) => e.id > sinceId);
  }
  return list.slice(-Math.min(limit, MAX_ENTRIES));
}

function clearTuyaActionLog() {
  entries.length = 0;
}

module.exports = {
  TZ,
  formatHKTime,
  logPrefix,
  logTuya,
  getTuyaActionLog,
  clearTuyaActionLog,
  MAX_ENTRIES,
};
