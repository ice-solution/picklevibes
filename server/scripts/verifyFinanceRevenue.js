/**
 * 驗證會計收入認列邏輯（無需 DB）
 * 執行：node server/scripts/verifyFinanceRevenue.js
 */
const assert = require('assert');
const {
  classifyRechargePoints,
  userPaidPointsRatio,
  getBookingNominalCharge,
  aggregateFromLines,
} = require('../utils/financeRevenue');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('=== financeRevenue 邏輯驗證 ===\n');

console.log('1. 充值分類（有價 vs 派送）');
test('Stripe 付 $100 得 120 積分 → 有價 100、贈送 20', () => {
  const r = classifyRechargePoints({ points: 120, amount: 100, payment: { method: 'stripe' } });
  assert.strictEqual(r.economicPoints, 100);
  assert.strictEqual(r.giftPoints, 20);
});
test('管理員 manual 派送 → 全屬贈送、有價 0', () => {
  const r = classifyRechargePoints({ points: 500, amount: 500, payment: { method: 'manual' } });
  assert.strictEqual(r.economicPoints, 0);
  assert.strictEqual(r.giftPoints, 500);
});
test('Alipay / Wechat 計入 payment gateway 有價積分', () => {
  const a = classifyRechargePoints({ points: 50, amount: 50, payment: { method: 'alipay' } });
  const w = classifyRechargePoints({ points: 50, amount: 50, payment: { method: 'wechat' } });
  assert.strictEqual(a.economicPoints, 50);
  assert.strictEqual(w.economicPoints, 50);
});

console.log('\n2. 用戶有價積分比例');
test('僅 gateway 充值 → ratio = 1', () => {
  assert.strictEqual(userPaidPointsRatio(100, 0), 1);
});
test('僅 manual 派送 → ratio = 0', () => {
  assert.strictEqual(userPaidPointsRatio(0, 200), 0);
});
test('混合 100 有價 + 100 贈送 → ratio = 0.5', () => {
  assert.strictEqual(userPaidPointsRatio(100, 100), 0.5);
});

console.log('\n3. 預約名目金額（須為實際扣積分）');
test('積分預約扣 80 → nominal 80', () => {
  const n = getBookingNominalCharge({
    payment: { method: 'points', pointsDeducted: 80 },
    pricing: { totalPrice: 100, pointsDeducted: 80 },
  });
  assert.strictEqual(n, 80);
});
test('積分預約未扣款 → nominal 0（不用牌價充數）', () => {
  const n = getBookingNominalCharge({
    payment: { method: 'points', pointsDeducted: 0 },
    pricing: { totalPrice: 100, pointsDeducted: 0 },
  });
  assert.strictEqual(n, 0);
});
test('admin_waived → nominal 0', () => {
  const n = getBookingNominalCharge({
    payment: { method: 'admin_waived', pointsDeducted: 0 },
    noUserBalanceDebited: true,
    pricing: { totalPrice: 200 },
  });
  assert.strictEqual(n, 0);
});

console.log('\n4. 認列收入試算（積分 × 有價比例）');
test('扣 100 積分、ratio 0.5 → 認列 50', () => {
  const nominal = 100;
  const ratio = 0.5;
  const recognized = Math.round(nominal * ratio * 100) / 100;
  assert.strictEqual(recognized, 50);
});
test('扣 100 積分、僅贈送積分池 ratio 0 → 認列 0', () => {
  const nominal = 100;
  const ratio = userPaidPointsRatio(0, 500);
  const recognized = Math.round(nominal * ratio * 100) / 100;
  assert.strictEqual(recognized, 0);
});

console.log('\n5. 匯總');
test('aggregateFromLines 加總 recognized', () => {
  const agg = aggregateFromLines([
    {
      lineType: 'recognized',
      source: 'venue',
      paymentMethod: '積分',
      nominal: 100,
      recognized: 50,
      giftExcluded: 50,
      storeId: 's1',
      store: 'A店',
    },
    {
      lineType: 'excluded',
      source: 'venue',
      paymentMethod: '管理員免扣款',
      nominal: 200,
      recognized: 0,
      giftExcluded: 0,
      storeId: 's1',
      store: 'A店',
    },
  ]);
  assert.strictEqual(agg.totals.revenueRecognized, 50);
  assert.strictEqual(agg.venue.excludedCount, 1);
  assert.strictEqual(agg.venue.bookingCount, 1);
});

console.log(`\n✅ 全部 ${passed} 項通過`);
console.log(`
說明（與 production 一致）：
• 場地／網店以「積分消費」認列時：收入 = 實際扣積分 × 用戶累計有價積分比例
• 有價積分 = Stripe / Alipay / Wechat 實付金額（HKD）；manual 派送與充值贈送為非有價
• 管理員免扣款（admin_waived）不計收入
• 比例為用戶截至查詢期末的累計充值結構（比例分攤法，非逐筆 FIFO）
• 實際 DB 驗證：npm run debug-finance -- --from YYYY-MM-DD --to YYYY-MM-DD
`);
