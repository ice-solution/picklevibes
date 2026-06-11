/**
 * 建立會計相關 MongoDB 索引（production deploy 後執行一次）
 *
 *   MONGODB_URI=... node server/scripts/ensureFinanceIndexes.js
 *
 * 只建立會計查詢用複合索引，不觸碰既有 unique 索引。
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Order = require('../models/Order');
const Recharge = require('../models/Recharge');
const AccountingTransaction = require('../models/AccountingTransaction');

const INDEX_SPECS = [
  {
    label: 'Booking.store_status_date',
    collection: () => Booking.collection,
    spec: { store: 1, status: 1, date: 1 },
    options: { name: 'finance_store_status_date' },
  },
  {
    label: 'Order.status_pointsChargedAt',
    collection: () => Order.collection,
    spec: { status: 1, pointsChargedAt: 1 },
    options: { name: 'finance_status_pointsChargedAt' },
  },
  {
    label: 'Order.pointsChargedAt (partial)',
    collection: () => Order.collection,
    spec: { pointsChargedAt: 1, status: 1 },
    options: {
      name: 'finance_pointsChargedAt_status',
      partialFilterExpression: {
        pointsChargedAmount: { $gt: 0 },
        pointsChargedAt: { $type: 'date' },
      },
    },
  },
  {
    label: 'Recharge.status_paidAt',
    collection: () => Recharge.collection,
    spec: { status: 1, 'payment.paidAt': 1 },
    options: { name: 'finance_status_paidAt' },
  },
  {
    label: 'Recharge.user_status_paidAt',
    collection: () => Recharge.collection,
    spec: { user: 1, status: 1, 'payment.paidAt': 1 },
    options: { name: 'finance_user_status_paidAt' },
  },
  {
    label: 'AccountingTransaction.store_date_type',
    collection: () => AccountingTransaction.collection,
    spec: { store: 1, date: -1, type: 1 },
    options: { name: 'finance_store_date_type' },
  },
];

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ 請設定 MONGODB_URI');
    process.exit(1);
  }

  console.log('=== 會計索引建立 ===\n');
  await mongoose.connect(process.env.MONGODB_URI);

  for (const row of INDEX_SPECS) {
    process.stdout.write(`${row.label} ... `);
    try {
      const name = await row.collection().createIndex(row.spec, row.options);
      console.log(`OK (${name})`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log('已存在（略過）');
      } else {
        console.log(`失敗: ${err.message}`);
      }
    }
  }

  console.log('\n✅ 完成');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
