/**
 * 會計 API 除錯工具 — 在本機重現 production 的 finance 計算錯誤
 *
 * 1. 把 .env 的 MONGODB_URI 指向要測的 DB（建議先用 production 唯讀連線）
 * 2. 執行：
 *    node server/scripts/debugFinance.js
 *    node server/scripts/debugFinance.js --from 2026-01-01 --to 2026-06-11
 *    node server/scripts/debugFinance.js --from 2026-06-01 --to 2026-06-11 --store <storeId>
 *    node server/scripts/debugFinance.js --income-only   # 只測 income-lines 邏輯
 *    node server/scripts/debugFinance.js --summary-only    # 只測 summary 邏輯
 */
require('dotenv').config();
const mongoose = require('mongoose');
// 與 server 啟動時相同：先載入會被 populate 的 models
require('../models/Store');
require('../models/Court');
require('../models/User');
const {
  formatHkYmd,
  computeIncomeLines,
  computeFinanceSummary,
} = require('../utils/financeRevenue');

function parseArgs(argv) {
  const flags = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

async function timed(label, fn) {
  const t0 = Date.now();
  process.stdout.write(`→ ${label} ... `);
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    console.log(`OK (${ms}ms)`);
    return { ok: true, ms, result };
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`FAIL (${ms}ms)`);
    throw err;
  }
}

async function main() {
  const flags = parseArgs(process.argv);
  const today = formatHkYmd();
  const fromYmd = flags.from || `${today.slice(0, 4)}-01-01`;
  const toYmd = flags.to || today;
  const storeId = flags.store || undefined;
  const incomeOnly = Boolean(flags['income-only']);
  const summaryOnly = Boolean(flags['summary-only']);

  if (!process.env.MONGODB_URI) {
    console.error('❌ 請在 .env 設定 MONGODB_URI');
    process.exit(1);
  }

  console.log('=== Finance debug ===');
  console.log(`DB:     ${process.env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);
  console.log(`Period: ${fromYmd} → ${toYmd}`);
  console.log(`Store:  ${storeId || '(全部)'}`);
  console.log('');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected\n');

  try {
    if (!summaryOnly) {
      const { result: income } = await timed('computeIncomeLines', () =>
        computeIncomeLines({ fromYmd, toYmd, storeId })
      );
      const lines = income.lines || [];
      const recognized = lines.filter((l) => l.lineType === 'recognized');
      console.log(`   lines: ${lines.length} (recognized: ${recognized.length})`);
      console.log(
        `   recognized total: HK$ ${recognized.reduce((s, l) => s + l.recognized, 0).toFixed(2)}`
      );
    }

    if (!incomeOnly) {
      const { result: summary } = await timed('computeFinanceSummary', () =>
        computeFinanceSummary({ fromYmd, toYmd, storeId })
      );
      console.log(`   revenue recognized: HK$ ${summary.totals?.revenueRecognized ?? '—'}`);
      console.log(`   venue bookings: ${summary.venue?.bookingCount ?? '—'}`);
      console.log(`   shop orders: ${summary.shop?.orderCount ?? '—'}`);
    }

    console.log('\n✅ 計算完成，API 邏輯在本機可跑通');
  } catch (err) {
    console.error('\n❌ 錯誤（與 production API 500 應相同根因）：');
    console.error(err.stack || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
