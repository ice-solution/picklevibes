/**
 * Tier 周年窗口：以 User.createdAt 為起點，每滿一年重置消費計算。
 * Year N：createdAt+(N-1)years → createdAt+N years（option B）
 */

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/**
 * @param {Date|string} createdAt
 * @param {Date} [now]
 * @returns {{ start: Date, end: Date, yearIndex: number }}
 */
function getAnniversaryWindow(createdAt, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    const fallbackStart = new Date(now);
    fallbackStart.setFullYear(fallbackStart.getFullYear() - 1);
    return { start: fallbackStart, end: new Date(now), yearIndex: 1 };
  }

  const ref = new Date(now);
  let yearIndex = 1;
  let start = new Date(created);
  let end = addYears(created, 1);

  if (ref < start) {
    return { start, end, yearIndex: 1 };
  }

  while (ref >= end) {
    yearIndex += 1;
    start = end;
    end = addYears(created, yearIndex);
  }

  return { start, end, yearIndex };
}

/**
 * 窗口內淨消費 = spend 絕對值 − refund 絕對值
 * @param {Array} transactions
 * @param {Date} start inclusive
 * @param {Date} end exclusive
 */
function calcSpentInWindow(transactions, start, end) {
  if (!Array.isArray(transactions) || transactions.length === 0) return 0;
  const startMs = start.getTime();
  const endMs = end.getTime();

  let spent = 0;
  let refunded = 0;
  for (const tx of transactions) {
    const createdAt = tx?.createdAt ? new Date(tx.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
    const t = createdAt.getTime();
    if (t < startMs || t >= endMs) continue;

    if (tx.type === 'spend') {
      spent += Math.abs(Number(tx.amount) || 0);
    } else if (tx.type === 'refund') {
      refunded += Math.abs(Number(tx.amount) || 0);
    }
  }
  return Math.max(0, Math.round(spent - refunded));
}

/** 以周年窗口計算年度消費；若無 createdAt 則 fallback rolling 365 天 */
function calcAnnualSpentFromTransactions(transactions, now = new Date(), createdAt = null) {
  if (createdAt) {
    const { start, end } = getAnniversaryWindow(createdAt, now);
    return calcSpentInWindow(transactions, start, end);
  }
  if (!Array.isArray(transactions) || transactions.length === 0) return 0;
  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  return calcSpentInWindow(transactions, oneYearAgo, now);
}

function fulfillmentKey(userId, tierId, windowStart) {
  const ws = windowStart instanceof Date ? windowStart.toISOString() : new Date(windowStart).toISOString();
  return `${String(userId)}:${String(tierId)}:${ws}`;
}

module.exports = {
  addYears,
  getAnniversaryWindow,
  calcSpentInWindow,
  calcAnnualSpentFromTransactions,
  fulfillmentKey,
};
