const Recharge = require('../models/Recharge');
const {
  hkStartOfDayInstant,
  hkEndOfDayInstant,
  formatHkYmd,
  defaultFinanceFromYmd,
  PAID_RECHARGE_METHODS,
  applyStoreIdFilter,
  resolveQueryStoreIds,
} = require('../utils/financeRevenue');

function parseYmd(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  const s = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

/** 與會計 period 充值統計一致：paidAt（fallback updatedAt） */
function buildRechargePeriodDateMatch(fromYmd, toYmd) {
  const start = hkStartOfDayInstant(fromYmd);
  const end = hkEndOfDayInstant(toYmd);
  return {
    $or: [
      { 'payment.paidAt': { $gte: start, $lte: end } },
      {
        $and: [
          { $or: [{ 'payment.paidAt': null }, { 'payment.paidAt': { $exists: false } }] },
          { updatedAt: { $gte: start, $lte: end } },
        ],
      },
    ],
  };
}

function buildCompletedRechargePeriodMatch(fromYmd, toYmd) {
  return {
    status: 'completed',
    ...buildRechargePeriodDateMatch(fromYmd, toYmd),
  };
}

function buildPeriodReportQuery(opts) {
  const today = formatHkYmd();
  const fromYmd = parseYmd(opts.fromYmd, defaultFinanceFromYmd(today));
  const toYmd = parseYmd(opts.toYmd, today);
  if (fromYmd > toYmd) {
    return { error: '開始日期不可晚於結束日期', status: 400 };
  }

  const match = buildRechargePeriodDateMatch(fromYmd, toYmd);
  match.status = opts.status && String(opts.status).trim() !== 'all'
    ? String(opts.status).trim()
    : 'completed';

  const storeIds = resolveQueryStoreIds(opts);
  if (storeIds) {
    applyStoreIdFilter(match, 'store', storeIds);
  }

  if (opts.method && String(opts.method).trim()) {
    match['payment.method'] = String(opts.method).trim();
  }

  return { fromYmd, toYmd, match, storeIds };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function computePeriodSummary(match) {
  const rows = await Recharge.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$payment.method',
        count: { $sum: 1 },
        points: { $sum: '$points' },
        amount: { $sum: '$amount' },
      },
    },
  ]);

  let totalCount = 0;
  let totalPoints = 0;
  let totalAmount = 0;
  let paidCashHKD = 0;
  let manualGiftPoints = 0;
  let bonusGiftPoints = 0;
  const byMethod = [];

  for (const row of rows) {
    const method = row._id || 'unknown';
    const count = row.count || 0;
    const points = row.points || 0;
    const amount = row.amount || 0;
    totalCount += count;
    totalPoints += points;
    totalAmount += amount;
    byMethod.push({ method, count, points, amount: round2(amount) });

    if (PAID_RECHARGE_METHODS.includes(method)) {
      paidCashHKD += amount;
      bonusGiftPoints += Math.max(0, points - amount);
    } else if (method === 'manual') {
      manualGiftPoints += points;
    }
  }

  byMethod.sort((a, b) => b.count - a.count);

  return {
    count: totalCount,
    totalPoints: round2(totalPoints),
    totalAmountHKD: round2(totalAmount),
    paidCashHKD: round2(paidCashHKD),
    manualGiftPoints: round2(manualGiftPoints),
    bonusGiftPointsFromOffers: round2(bonusGiftPoints),
    byMethod,
  };
}

async function listRechargesInPeriod(opts) {
  const built = buildPeriodReportQuery(opts);
  if (built.error) return built;

  const page = Math.max(parseInt(opts.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 50, 1), 200);
  const skip = (page - 1) * limit;

  const [summary, records, total] = await Promise.all([
    computePeriodSummary(built.match),
    Recharge.find(built.match)
      .populate('user', 'name email phone')
      .populate('store', 'name slug')
      .populate('court', 'name number')
      .populate('rechargeOffer', 'name points amount')
      .populate('redeemCode', 'code name')
      .populate('adjustedBy', 'name email')
      .sort({ 'payment.paidAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Recharge.countDocuments(built.match),
  ]);

  return {
    period: { fromYmd: built.fromYmd, toYmd: built.toYmd },
    storeScope: built.storeIds ? { storeIds: built.storeIds } : { unrestricted: true },
    summary,
    records,
    pagination: {
      current: page,
      pages: Math.ceil(total / limit) || 1,
      total,
      limit,
    },
  };
}

function methodLabel(method) {
  if (method === 'stripe') return 'Stripe';
  if (method === 'wonder') return 'Wonder';
  if (method === 'manual') return '手動';
  if (method === 'alipay') return '支付寶';
  if (method === 'wechat') return '微信';
  return method || '—';
}

function serializeRecordForExport(r) {
  const paidAt = r.payment?.paidAt || r.updatedAt || r.createdAt;
  return {
    日期: paidAt ? new Date(paidAt).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' }) : '',
    用戶: r.user?.name || '',
    電郵: r.user?.email || '',
    電話: r.user?.phone || '',
    積分: r.points ?? '',
    金額HKD: r.amount ?? '',
    方式: methodLabel(r.payment?.method),
    狀態: r.status || '',
    店鋪: r.store?.name || '',
    場地: r.court?.name || '',
    優惠: r.rechargeOffer?.name || '',
    兌換碼: r.redeemCode?.code || '',
    說明: r.description || '',
    操作人: r.adjustedBy?.name || '',
  };
}

async function exportRechargesInPeriod(opts) {
  const built = buildPeriodReportQuery(opts);
  if (built.error) return built;

  const records = await Recharge.find(built.match)
    .populate('user', 'name email phone')
    .populate('store', 'name slug')
    .populate('court', 'name number')
    .populate('rechargeOffer', 'name')
    .populate('redeemCode', 'code')
    .populate('adjustedBy', 'name')
    .sort({ 'payment.paidAt': -1, createdAt: -1 })
    .lean();

  return {
    period: { fromYmd: built.fromYmd, toYmd: built.toYmd },
    rows: records.map(serializeRecordForExport),
  };
}

module.exports = {
  parseYmd,
  buildCompletedRechargePeriodMatch,
  listRechargesInPeriod,
  exportRechargesInPeriod,
  methodLabel,
};
