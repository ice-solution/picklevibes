/**
 * 簡化損益／場地收入認列
 * - 場地收入按預約出租日（香港時間）
 * - 積分消費依用戶累計「有價充值」vs「派送／贈送積分」比例折算認列收入
 */
const Recharge = require('../models/Recharge');
// populate booking.store / court.store 前須先註冊（否則 MissingSchemaError: Store）
require('../models/Store');
require('../models/Court');
require('../models/User');

const HK_TZ = 'Asia/Hong_Kong';
const PAID_RECHARGE_METHODS = ['stripe', 'alipay', 'wechat'];

/** 會計 API 預設查詢起日：當月 1 日（避免預設全年掃描） */
function defaultFinanceFromYmd(today = formatHkYmd()) {
  return `${today.slice(0, 7)}-01`;
}

/** 短暫快取：summary + income-lines 同時請求時避免重複掃描預約 */
const INCOME_LINES_CACHE_TTL_MS = 60_000;
const INCOME_LINES_CACHE_MAX = 24;
const incomeLinesCache = new Map();

function incomeLinesCacheKey(opts) {
  return `${opts.fromYmd}|${opts.toYmd}|${opts.storeId || ''}`;
}

async function getIncomeLines(opts) {
  const key = incomeLinesCacheKey(opts);
  const hit = incomeLinesCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data;
  }
  const data = await computeIncomeLines(opts);
  if (incomeLinesCache.size >= INCOME_LINES_CACHE_MAX) {
    const oldest = incomeLinesCache.keys().next().value;
    incomeLinesCache.delete(oldest);
  }
  incomeLinesCache.set(key, { expiresAt: Date.now() + INCOME_LINES_CACHE_TTL_MS, data });
  return data;
}

function addDaysToYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function hkStartOfDayInstant(ymd) {
  return new Date(`${ymd}T00:00:00+08:00`);
}

function hkEndOfDayInstant(ymd) {
  return new Date(`${ymd}T23:59:59.999+08:00`);
}

function formatHkYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: HK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** 單筆充值的「有價積分」與「派送積分」（單位：積分／港元 1:1） */
function classifyRechargePoints(recharge) {
  const points = Math.max(0, Number(recharge.points) || 0);
  const amount = Math.max(0, Number(recharge.amount) || 0);
  const method = recharge.payment?.method;

  if (method === 'manual') {
    return { economicPoints: 0, giftPoints: points, label: '管理員派送' };
  }

  if (PAID_RECHARGE_METHODS.includes(method)) {
    const economicPoints = amount;
    const giftPoints = Math.max(0, points - amount);
    return {
      economicPoints,
      giftPoints,
      label: giftPoints > 0 ? '付費充值（含贈送積分）' : '付費充值'
    };
  }

  return { economicPoints: amount, giftPoints: Math.max(0, points - amount), label: '其他充值' };
}

/**
 * 截至某時刻，用戶累計有價積分佔比（用於折算積分消費的認列收入）
 */
function userPaidPointsRatio(economicTotal, giftTotal) {
  const e = economicTotal || 0;
  const g = giftTotal || 0;
  const sum = e + g;
  if (sum <= 0) return 0;
  return e / sum;
}

function getBookingNominalCharge(booking) {
  if (booking.payment?.method === 'admin_waived') return 0;
  if (booking.noUserBalanceDebited) return 0;

  const method = booking.payment?.method;
  const pts =
    Number(booking.payment?.pointsDeducted) ||
    Number(booking.pricing?.pointsDeducted) ||
    0;
  const listPrice = Number(booking.pricing?.totalPrice) || 0;

  if (method === 'cash' || method === 'bank_transfer' || method === 'stripe') {
    return listPrice || pts;
  }

  if (method === 'points' || !method) {
    return pts > 0 ? pts : listPrice;
  }

  return pts || listPrice;
}

function isPointsLikePayment(booking) {
  const method = booking.payment?.method;
  return method === 'points' || (!method && getBookingNominalCharge(booking) > 0);
}

function getOrderRecognizedAmount(order, userRatio) {
  const charged = Number(order.pointsChargedAmount) || 0;
  if (charged <= 0) return { nominal: 0, recognized: 0 };
  return {
    nominal: charged,
    recognized: Math.round(charged * userRatio * 100) / 100
  };
}

/**
 * 預先載入用戶在 endInstant 前的已完成充值，建立累計有價／派送池
 */
async function buildUserRechargePools(userIds, endInstant) {
  const pools = new Map();
  userIds.forEach((id) => {
    pools.set(String(id), { economicPoints: 0, giftPoints: 0 });
  });

  if (userIds.length === 0) return pools;

  const recharges = await Recharge.find({
    user: { $in: userIds },
    status: 'completed',
    $or: [
      { 'payment.paidAt': { $lte: endInstant } },
      { updatedAt: { $lte: endInstant } }
    ]
  })
    .select('user points amount payment.method payment.paidAt updatedAt')
    .lean();

  for (const r of recharges) {
    const uid = String(r.user);
    if (!pools.has(uid)) {
      pools.set(uid, { economicPoints: 0, giftPoints: 0 });
    }
    const paidAt = r.payment?.paidAt || r.updatedAt;
    if (paidAt && new Date(paidAt) > endInstant) continue;

    const { economicPoints, giftPoints } = classifyRechargePoints(r);
    const pool = pools.get(uid);
    pool.economicPoints += economicPoints;
    pool.giftPoints += giftPoints;
  }

  return pools;
}

/** 預約店鋪：優先 booking.store，否則從 court.store 推斷（舊資料常缺 booking.store） */
function resolveBookingStore(booking) {
  const storeDoc =
    booking.store && typeof booking.store === 'object' && booking.store._id
      ? booking.store
      : booking.court &&
          typeof booking.court === 'object' &&
          booking.court.store &&
          typeof booking.court.store === 'object'
        ? booking.court.store
        : null;

  return {
    storeId: storeDoc?._id ? String(storeDoc._id) : null,
    storeName: storeDoc?.name || '未指定店鋪',
    inferredFromCourt: !booking.store?._id && !!storeDoc
  };
}

function paymentMethodLabel(method) {
  if (method === 'points') return '積分';
  if (method === 'admin_waived') return '管理員免扣款';
  if (method === 'cash') return '現金';
  if (method === 'bank_transfer') return '銀行轉帳';
  if (method === 'stripe') return 'Stripe';
  return method || '積分';
}

function filterLinesForStore(lines, storeId) {
  if (!storeId) return lines;
  return lines.filter((l) => {
    if (l.source === 'shop') return false;
    return l.storeId && String(l.storeId) === String(storeId);
  });
}

/**
 * 收入明細列（認列 + 不計收入）
 * @param {{ fromYmd: string, toYmd: string, storeId?: string }} opts
 */
async function computeIncomeLines(opts) {
  const { fromYmd, toYmd, storeId } = opts;
  const start = hkStartOfDayInstant(fromYmd);
  const end = hkEndOfDayInstant(toYmd);

  const Booking = require('../models/Booking');
  const Order = require('../models/Order');

  const bookingQuery = {
    status: { $in: ['confirmed', 'completed'] },
    date: { $gte: start, $lte: end }
  };
  if (storeId) {
    bookingQuery.store = storeId;
  }

  const bookings = await Booking.find(bookingQuery)
    .select(
      'user store court date startTime endTime duration status pricing payment noUserBalanceDebited bypassRestrictions isFullVenue venueBundleKind relatedActivity createdAt'
    )
    .populate('store', 'name slug code')
    .populate({
      path: 'court',
      select: 'name type store',
      populate: { path: 'store', select: 'name slug' }
    })
    .populate('user', 'name email')
    .sort({ date: 1, startTime: 1 })
    .lean();

  const orders = storeId
    ? []
    : await Order.find({
        pointsChargedAt: { $gte: start, $lte: end },
        pointsChargedAmount: { $gt: 0 },
        status: { $nin: ['cancelled'] }
      })
        .select('user orderNumber pointsChargedAmount pointsChargedAt status items subtotal total')
        .populate('user', 'name email')
        .sort({ pointsChargedAt: -1 })
        .lean();

  const userIds = new Set();
  bookings.forEach((b) => b.user && userIds.add(String(b.user._id || b.user)));
  orders.forEach((o) => o.user && userIds.add(String(o.user._id || o.user)));

  const pools = await buildUserRechargePools([...userIds], end);
  const lines = [];

  for (const b of bookings) {
    const method = b.payment?.method || 'points';
    const { storeId: storeIdLine, storeName } = resolveBookingStore(b);
    const courtName = b.court?.name || '';
    const user = b.user;
    const userName = user?.name || '';
    const userEmail = user?.email || '';
    const incomeDate = formatHkYmd(b.date);
    const timeSlot = `${b.startTime || ''}–${b.endTime || ''}`;
    const listPrice = Number(b.pricing?.totalPrice) || 0;
    const isExcluded = method === 'admin_waived' || b.noUserBalanceDebited === true;
    const referenceAmount = isExcluded ? listPrice : 0;

    if (isExcluded) {
      lines.push({
        id: String(b._id),
        source: 'venue',
        lineType: 'excluded',
        incomeDate,
        category: '場地租賃',
        description: `${courtName} ${timeSlot}`.trim(),
        storeId: storeIdLine,
        store: storeName,
        court: courtName,
        orderNumber: null,
        userName,
        userEmail,
        paymentMethod: paymentMethodLabel(method),
        statusLabel: b.status,
        nominal: round2(referenceAmount),
        recognized: 0,
        giftExcluded: 0,
        paidPointsRatio: null,
        excludeReason: '管理員 bypass／免扣款（不計收入）'
      });
      continue;
    }

    const nominal = getBookingNominalCharge(b);
    let recognized = nominal;
    let giftExcluded = 0;
    let paidPointsRatio = null;

    if (isPointsLikePayment(b) && nominal > 0) {
      const pool = pools.get(String(b.user?._id || b.user)) || { economicPoints: 0, giftPoints: 0 };
      paidPointsRatio = round4(userPaidPointsRatio(pool.economicPoints, pool.giftPoints));
      recognized = round2(nominal * paidPointsRatio);
      giftExcluded = round2(nominal - recognized);
    }

    lines.push({
      id: String(b._id),
      source: 'venue',
      lineType: 'recognized',
      incomeDate,
      category: '場地租賃',
      description: `${courtName} ${timeSlot}`.trim(),
      storeId: storeIdLine,
      store: storeName,
      court: courtName,
      orderNumber: null,
      userName,
      userEmail,
      paymentMethod: paymentMethodLabel(method),
      statusLabel: b.status,
      nominal: round2(nominal),
      recognized: round2(recognized),
      giftExcluded: round2(giftExcluded),
      paidPointsRatio,
      excludeReason: null
    });
  }

  for (const o of orders) {
    const pool = pools.get(String(o.user?._id || o.user)) || { economicPoints: 0, giftPoints: 0 };
    const paidPointsRatio = round4(userPaidPointsRatio(pool.economicPoints, pool.giftPoints));
    const { nominal, recognized } = getOrderRecognizedAmount(o, paidPointsRatio);
    const itemSummary = (o.items || [])
      .map((it) => `${it.name}×${it.quantity}`)
      .join('、');
    const user = o.user;

    lines.push({
      id: String(o._id),
      source: 'shop',
      lineType: 'recognized',
      incomeDate: formatHkYmd(o.pointsChargedAt),
      category: '網店銷售',
      description: itemSummary || o.orderNumber,
      storeId: null,
      store: '全公司（網店）',
      court: null,
      orderNumber: o.orderNumber,
      userName: user?.name || '',
      userEmail: user?.email || '',
      paymentMethod: '積分',
      statusLabel: o.status,
      nominal: round2(nominal),
      recognized: round2(recognized),
      giftExcluded: round2(nominal - recognized),
      paidPointsRatio,
      excludeReason: null
    });
  }

  lines.sort((a, b) => {
    if (a.incomeDate !== b.incomeDate) return a.incomeDate.localeCompare(b.incomeDate);
    if (a.lineType !== b.lineType) return a.lineType === 'recognized' ? -1 : 1;
    return (a.description || '').localeCompare(b.description || '');
  });

  return { fromYmd, toYmd, lines, pools };
}

function round4(n) {
  return Math.round((Number(n) || 0) * 10000) / 10000;
}

function aggregateFromLines(lines) {
  const recognized = lines.filter((l) => l.lineType === 'recognized');
  const excluded = lines.filter((l) => l.lineType === 'excluded');
  const venueRecognized = recognized.filter((l) => l.source === 'venue');
  const shopRecognized = recognized.filter((l) => l.source === 'shop');

  const sum = (arr, key) => arr.reduce((s, l) => s + (l[key] || 0), 0);

  const byStore = new Map();
  venueRecognized.forEach((l) => {
    const k = l.storeId || l.store || '未指定店鋪';
    if (!byStore.has(k)) {
      byStore.set(k, {
        storeId: l.storeId || null,
        store: l.store || '未指定店鋪',
        nominal: 0,
        recognized: 0,
        count: 0,
        excludedCount: 0,
        adminWaivedListPrice: 0
      });
    }
    const row = byStore.get(k);
    row.nominal += l.nominal;
    row.recognized += l.recognized;
    row.count += 1;
  });

  excluded.forEach((l) => {
    if (l.source !== 'venue') return;
    const k = l.storeId || l.store || '未指定店鋪';
    if (!byStore.has(k)) {
      byStore.set(k, {
        storeId: l.storeId || null,
        store: l.store || '未指定店鋪',
        nominal: 0,
        recognized: 0,
        count: 0,
        excludedCount: 0,
        adminWaivedListPrice: 0
      });
    }
    const row = byStore.get(k);
    row.excludedCount += 1;
    row.adminWaivedListPrice += l.nominal;
  });

  const byPaymentMethod = new Map();
  venueRecognized.forEach((l) => {
    const k = l.paymentMethod;
    if (!byPaymentMethod.has(k)) byPaymentMethod.set(k, { nominal: 0, recognized: 0, count: 0 });
    const row = byPaymentMethod.get(k);
    row.nominal += l.nominal;
    row.recognized += l.recognized;
    row.count += 1;
  });

  return {
    venue: {
      bookingCount: venueRecognized.length,
      excludedCount: excluded.length,
      nominalTotal: round2(sum(venueRecognized, 'nominal')),
      recognizedTotal: round2(sum(venueRecognized, 'recognized')),
      giftPointsExcluded: round2(sum(venueRecognized, 'giftExcluded')),
      adminWaivedListPrice: round2(sum(excluded, 'nominal')),
      cashLikeTotal: round2(
        venueRecognized
          .filter((l) => ['現金', '銀行轉帳', 'Stripe'].includes(l.paymentMethod))
          .reduce((s, l) => s + l.recognized, 0)
      ),
      pointsNominalTotal: round2(
        venueRecognized
          .filter((l) => l.paymentMethod === '積分')
          .reduce((s, l) => s + l.nominal, 0)
      ),
      byStore: [...byStore.values()]
        .map((v) => ({
          storeId: v.storeId,
          store: v.store,
          count: v.count,
          excludedCount: v.excludedCount,
          adminWaivedListPrice: round2(v.adminWaivedListPrice),
          nominal: round2(v.nominal),
          recognized: round2(v.recognized)
        }))
        .sort((a, b) => b.recognized - a.recognized),
      byPaymentMethod: [...byPaymentMethod.entries()].map(([method, v]) => ({
        method,
        count: v.count,
        nominal: round2(v.nominal),
        recognized: round2(v.recognized)
      }))
    },
    shop: {
      orderCount: shopRecognized.length,
      nominalTotal: round2(sum(shopRecognized, 'nominal')),
      recognizedTotal: round2(sum(shopRecognized, 'recognized')),
      giftPointsExcluded: round2(sum(shopRecognized, 'giftExcluded'))
    },
    totals: {
      revenueNominal: round2(sum(recognized, 'nominal')),
      revenueRecognized: round2(sum(recognized, 'recognized')),
      giftPointsExcluded: round2(sum(recognized, 'giftExcluded'))
    }
  };
}

/**
 * 各店鋪場地收入匯總（不含網店）
 */
async function computePerStoreSummaries(opts) {
  const { lines } = await computeIncomeLines({ fromYmd: opts.fromYmd, toYmd: opts.toYmd });
  const agg = aggregateFromLines(lines);
  return agg.venue.byStore;
}

/**
 * @param {{ fromYmd: string, toYmd: string, storeId?: string }} opts
 */
async function computeFinanceSummary(opts) {
  const { fromYmd, toYmd, storeId } = opts;
  const start = hkStartOfDayInstant(fromYmd);
  const end = hkEndOfDayInstant(toYmd);

  const Store = require('../models/Store');
  let selectedStore = null;
  if (storeId) {
    selectedStore = await Store.findById(storeId).select('name slug').lean();
  }

  const { lines } = await getIncomeLines({ fromYmd, toYmd, storeId });
  const agg = aggregateFromLines(lines);
  const byStoreAll = storeId ? null : agg.venue.byStore;

  const rechargeStats = await Recharge.aggregate([
    {
      $match: {
        status: 'completed',
        $or: [
          { 'payment.paidAt': { $gte: start, $lte: end } },
          {
            $and: [
              { $or: [{ 'payment.paidAt': null }, { 'payment.paidAt': { $exists: false } }] },
              { updatedAt: { $gte: start, $lte: end } },
            ],
          },
        ],
      },
    },
    {
      $group: {
        _id: '$payment.method',
        points: { $sum: '$points' },
        amount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);

  let periodPaidRechargeAmount = 0;
  let periodManualGiftPoints = 0;
  let periodBonusGiftPoints = 0;

  for (const row of rechargeStats) {
    const method = row._id;
    if (PAID_RECHARGE_METHODS.includes(method)) {
      periodPaidRechargeAmount += row.amount || 0;
      periodBonusGiftPoints += Math.max(0, (row.points || 0) - (row.amount || 0));
    } else if (method === 'manual') {
      periodManualGiftPoints += row.points || 0;
    }
  }

  return {
    timezone: HK_TZ,
    period: { fromYmd, toYmd },
    storeId: storeId || null,
    selectedStore: selectedStore
      ? { id: String(selectedStore._id), name: selectedStore.name, slug: selectedStore.slug }
      : null,
    byStoreBreakdown: byStoreAll,
    shopScopeNote: storeId
      ? '網店收入為全公司共用，選定單一店鋪時不計入網店。'
      : '網店收入不分店鋪，列於「全公司（網店）」。',
    methodology: {
      venueDateBasis: '預約出租日（香港時間）',
      venueStatuses: ['confirmed', 'completed'],
      pointsRecognition:
        '積分預約認列收入 = 扣款積分 × 用戶累計有價充值積分 ÷（有價 + 派送／贈送積分）',
      giftPointsDefinition:
        '派送積分 = 管理員手動充值（payment.method=manual）+ 付費充值中超出實付金額的贈送積分（points − amount）',
      excludedFromRecognized:
        '管理員免扣款（admin_waived / noUserBalanceDebited）不計入認列收入',
      shopDateBasis: '網店以 pointsChargedAt（後台確認扣款日）為準'
    },
    venue: agg.venue,
    shop: agg.shop,
    totals: agg.totals,
    rechargeInPeriod: {
      paidCashInHKD: round2(periodPaidRechargeAmount),
      manualGiftPoints: round2(periodManualGiftPoints),
      bonusGiftPointsFromOffers: round2(periodBonusGiftPoints)
    },
    incomeLineCount: lines.length
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = {
  HK_TZ,
  formatHkYmd,
  defaultFinanceFromYmd,
  addDaysToYmd,
  hkStartOfDayInstant,
  hkEndOfDayInstant,
  classifyRechargePoints,
  userPaidPointsRatio,
  getBookingNominalCharge,
  computeIncomeLines,
  getIncomeLines,
  aggregateFromLines,
  computeFinanceSummary,
  computePerStoreSummaries,
  filterLinesForStore
};
