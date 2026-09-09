/**
 * 回填：收款連結扣款關聯 + 清除收款連結中間充值上的 store
 *
 * 1) UserBalance.transactions「付款：…」spend → relatedPaymentLinkPayment
 * 2) paymentIntentId 以 paylink_ 開頭的 Recharge → $unset store（充值不分店）
 *
 * 預覽：
 *   node server/scripts/backfillPaymentLinkSpendLinks.js --dry-run
 *
 * 執行：
 *   node server/scripts/backfillPaymentLinkSpendLinks.js --yes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const UserBalance = require('../models/UserBalance');
const PaymentLinkPayment = require('../models/PaymentLinkPayment');
const Recharge = require('../models/Recharge');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_CONFIRM = args.has('--yes');

async function backfillSpendLinks() {
  const balances = await UserBalance.find({
    transactions: {
      $elemMatch: {
        type: 'spend',
        description: /^付款：/,
        relatedPaymentLinkPayment: { $exists: false }
      }
    }
  }).select('user transactions');

  let matched = 0;
  let skipped = 0;
  let ambiguous = 0;

  for (const bal of balances) {
    let dirty = false;
    for (const tx of bal.transactions) {
      if (tx.type !== 'spend') continue;
      if (!String(tx.description || '').startsWith('付款：')) continue;
      if (tx.relatedPaymentLinkPayment) continue;

      const txAt = tx.createdAt ? new Date(tx.createdAt) : null;
      if (!txAt) {
        skipped += 1;
        continue;
      }
      const from = new Date(txAt.getTime() - 2 * 60 * 1000);
      const to = new Date(txAt.getTime() + 2 * 60 * 1000);
      const absAmt = Math.abs(Number(tx.amount) || 0);

      const candidates = await PaymentLinkPayment.find({
        user: bal.user,
        status: 'completed',
        $or: [
          { 'payment.paidAt': { $gte: from, $lte: to } },
          { updatedAt: { $gte: from, $lte: to } }
        ]
      }).select('_id amount method pointsDebited payment.paidAt');

      const scored = candidates.filter((p) => {
        if (p.method === 'points') {
          return Math.abs(Number(p.amount) - absAmt) < 0.01;
        }
        return true;
      });

      if (scored.length === 0) {
        skipped += 1;
        continue;
      }

      if (scored.length > 1) {
        scored.sort((a, b) => {
          const at = (a.payment?.paidAt || a._id.getTimestamp()).getTime();
          const bt = (b.payment?.paidAt || b._id.getTimestamp()).getTime();
          return Math.abs(at - txAt.getTime()) - Math.abs(bt - txAt.getTime());
        });
        ambiguous += 1;
      }

      tx.relatedPaymentLinkPayment = scored[0]._id;
      dirty = true;
      matched += 1;
    }
    if (dirty && !DRY_RUN) {
      bal.markModified('transactions');
      await bal.save();
    }
  }

  return { scanned: balances.length, matched, skipped, ambiguous };
}

async function clearPaylinkRechargeStore() {
  const filter = { paymentIntentId: /^paylink_/ };
  const count = await Recharge.countDocuments(filter);
  if (!DRY_RUN) {
    await Recharge.updateMany(filter, { $unset: { store: 1 } });
  }
  return count;
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  console.log('✅ 已連接資料庫');
  console.log(DRY_RUN ? '🔍 DRY-RUN（不寫入）' : '✍️  將寫入資料庫');

  if (!DRY_RUN && !SKIP_CONFIRM) {
    console.log('加 --yes 確認執行，或先用 --dry-run 預覽');
    process.exit(1);
  }

  const spend = await backfillSpendLinks();
  console.log('收款連結 spend 回填:', spend);

  const cleared = await clearPaylinkRechargeStore();
  console.log(`paylink Recharge 清除 store：${cleared} 筆`);

  await mongoose.disconnect();
  console.log('✅ 完成');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
