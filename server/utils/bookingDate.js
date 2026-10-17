/**
 * 香港日曆今日 YYYY-MM-DD
 */
function hongKongTodayYmd(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * 正規化訂場日期：
 * - LLM 常把「10月18號」寫成 2023-10-18 等過去年份 → 升到今年（或明年若已過）
 * @returns {{ date: string, adjusted: boolean, original: string|null }}
 */
function normalizeBookingDateYmd(input, now = new Date()) {
  const original = String(input || '').trim();
  let s = original.replace(/\//g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    return { date: original, adjusted: false, original: null };
  }
  let year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return { date: original, adjusted: false, original: null };
  }

  const today = hongKongTodayYmd(now);
  const currentYear = Number(today.slice(0, 4));

  if (year < currentYear) {
    year = currentYear;
  }

  const pad = (n) => String(n).padStart(2, '0');
  let date = `${year}-${pad(month)}-${pad(day)}`;

  // 同年但日子已過（例如今日 10/17、請求 10/10）→ 明年
  if (date < today) {
    year += 1;
    date = `${year}-${pad(month)}-${pad(day)}`;
  }

  return {
    date,
    adjusted: date !== original,
    original: date !== original ? original : null,
  };
}

module.exports = {
  hongKongTodayYmd,
  normalizeBookingDateYmd,
};
