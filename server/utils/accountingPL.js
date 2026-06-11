const mongoose = require('mongoose');
const AccountingTransaction = require('../models/AccountingTransaction');
const Store = require('../models/Store');
const { computeFinanceSummary } = require('./financeRevenue');

function buildDateRange(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function aggregateLedgerByCategory(match) {
  const rows = await AccountingTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { type: '$type', category: '$category' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.type': 1, total: -1 } },
  ]);

  const income = [];
  const expense = [];
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const row of rows) {
    const item = {
      category: row._id.category,
      amount: round2(row.total),
      count: row.count,
    };
    if (row._id.type === 'income') {
      income.push(item);
      incomeTotal += row.total;
    } else {
      expense.push(item);
      expenseTotal += row.total;
    }
  }

  return {
    income,
    expense,
    incomeTotal: round2(incomeTotal),
    expenseTotal: round2(expenseTotal),
    net: round2(incomeTotal - expenseTotal),
  };
}

async function aggregateLedgerByStore(match) {
  const rows = await AccountingTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { store: '$store', type: '$type' },
        total: { $sum: '$amount' },
      },
    },
  ]);

  const storeMap = new Map();
  for (const row of rows) {
    const sid = String(row._id.store);
    if (!storeMap.has(sid)) {
      storeMap.set(sid, { storeId: sid, income: 0, expense: 0, net: 0 });
    }
    const entry = storeMap.get(sid);
    if (row._id.type === 'income') entry.income += row.total;
    else entry.expense += row.total;
    entry.net = entry.income - entry.expense;
  }

  const stores = await Store.find({ _id: { $in: [...storeMap.keys()] } }).select('name').lean();
  const nameMap = new Map(stores.map((s) => [String(s._id), s.name]));

  return [...storeMap.values()]
    .map((r) => ({
      storeId: r.storeId,
      storeName: nameMap.get(r.storeId) || '—',
      income: round2(r.income),
      expense: round2(r.expense),
      net: round2(r.net),
    }))
    .sort((a, b) => b.net - a.net);
}

/**
 * 綜合損益：系統認列收入 + 手動收支登記
 */
async function computeAccountingPL({ fromYmd, toYmd, storeId } = {}) {
  const finance = await computeFinanceSummary({ fromYmd, toYmd, storeId });

  const ledgerMatch = {};
  if (storeId) {
    ledgerMatch.store = new mongoose.Types.ObjectId(storeId);
  }
  const dateRange = buildDateRange(fromYmd, toYmd);
  if (dateRange) ledgerMatch.date = dateRange;

  const ledger = await aggregateLedgerByCategory(ledgerMatch);
  const ledgerByStore = storeId ? null : await aggregateLedgerByStore(ledgerMatch);

  const systemVenueRevenue = round2(finance.venue?.recognizedTotal || 0);
  const systemShopRevenue = storeId ? 0 : round2(finance.shop?.recognizedTotal || 0);
  const systemRevenueTotal = round2(systemVenueRevenue + systemShopRevenue);
  const manualIncomeTotal = ledger.incomeTotal;
  const manualExpenseTotal = ledger.expenseTotal;

  const totalRevenue = round2(systemRevenueTotal + manualIncomeTotal);
  const totalExpenses = manualExpenseTotal;
  const netProfit = round2(totalRevenue - totalExpenses);

  const storeRows = [];
  if (!storeId && finance.byStoreBreakdown) {
    const ledgerStoreMap = new Map(
      (ledgerByStore || []).map((r) => [r.storeId, r])
    );
    for (const vs of finance.byStoreBreakdown) {
      const sid = vs.storeId ? String(vs.storeId) : null;
      const manual = sid ? ledgerStoreMap.get(sid) : null;
      const sysRev = round2(vs.recognized || 0);
      const manInc = manual?.income || 0;
      const manExp = manual?.expense || 0;
      storeRows.push({
        storeId: sid,
        storeName: vs.store,
        systemVenueRevenue: sysRev,
        manualIncome: manInc,
        manualExpense: manExp,
        totalRevenue: round2(sysRev + manInc),
        totalExpenses: manExp,
        netProfit: round2(sysRev + manInc - manExp),
        bookingCount: vs.count,
      });
    }
    if (!storeId && systemShopRevenue > 0) {
      storeRows.push({
        storeId: null,
        storeName: '全公司（網店）',
        systemVenueRevenue: 0,
        systemShopRevenue,
        manualIncome: 0,
        manualExpense: 0,
        totalRevenue: systemShopRevenue,
        totalExpenses: 0,
        netProfit: systemShopRevenue,
        orderCount: finance.shop?.orderCount || 0,
      });
    }
  } else if (storeId) {
    storeRows.push({
      storeId,
      storeName: finance.selectedStore?.name || '—',
      systemVenueRevenue,
      manualIncome: manualIncomeTotal,
      manualExpense: manualExpenseTotal,
      totalRevenue,
      totalExpenses,
      netProfit,
      bookingCount: finance.venue?.bookingCount || 0,
    });
  }

  return {
    period: { fromYmd, toYmd },
    storeId: storeId || null,
    selectedStore: finance.selectedStore,
    shopScopeNote: finance.shopScopeNote,
    revenue: {
      systemVenue: systemVenueRevenue,
      systemShop: systemShopRevenue,
      systemTotal: systemRevenueTotal,
      manualByCategory: ledger.income,
      manualTotal: manualIncomeTotal,
      total: totalRevenue,
    },
    expenses: {
      manualByCategory: ledger.expense,
      total: totalExpenses,
    },
    netProfit,
    storeBreakdown: storeRows.length ? storeRows : null,
    ledgerByStore,
    systemDetail: {
      venue: finance.venue,
      shop: finance.shop,
      rechargeInPeriod: finance.rechargeInPeriod,
      giftPointsExcluded: finance.totals?.giftPointsExcluded || 0,
    },
    notes: [
      '系統認列收入來自預約出租日及網店扣款日，已折算積分派送。',
      '手動收支來自「收支登記」；請避免與系統收入重複登記同一筆款項。',
      storeId ? '選定單一店鋪時不計入網店認列收入。' : null,
    ].filter(Boolean),
  };
}

module.exports = { computeAccountingPL };
