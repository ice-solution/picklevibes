/**
 * 一次性：依 email 名單批量派送積分（等同後台「手動充值」）
 *
 * 1. cp server/scripts/batchManualRecharge.list.example.js server/scripts/batchManualRecharge.list.js
 * 2. 編輯 list 檔（email、points、reason）
 * 3. 確認 .env 的 MONGODB_URI 指向正確環境
 *
 * 預覽（不寫入）：
 *   node server/scripts/batchManualRecharge.js --dry-run
 *
 * 執行：
 *   node server/scripts/batchManualRecharge.js
 *   node server/scripts/batchManualRecharge.js --yes
 */
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');

const LIST_PATH = path.join(__dirname, 'batchManualRecharge.list.js');
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const SKIP_CONFIRM = args.has('--yes');

function loadList() {
  if (!fs.existsSync(LIST_PATH)) {
    console.error(`❌ 找不到名單檔：${LIST_PATH}`);
    console.error('   請先：cp server/scripts/batchManualRecharge.list.example.js server/scripts/batchManualRecharge.list.js');
    process.exit(1);
  }
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const data = require(LIST_PATH);
  if (!data || !Array.isArray(data.entries) || data.entries.length === 0) {
    throw new Error('名單檔需包含 entries: [{ email, points, reason }, ...]');
  }
  return data.entries;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function uniquePaymentIntentId(index) {
  return `batch_manual_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 11)}`;
}

async function manualRechargeForUser({ user, points, reason, index }) {
  let userBalance = await UserBalance.findOne({ user: user._id });
  if (!userBalance) {
    userBalance = new UserBalance({ user: user._id });
  }

  const adminLabel = 'batchManualRecharge.js';
  const paymentId = uniquePaymentIntentId(index);
  const recharge = new Recharge({
    user: user._id,
    points,
    amount: points,
    status: 'completed',
    paymentIntentId: paymentId,
    description: `管理員手動充值 - ${reason}`,
    payment: {
      status: 'paid',
      method: 'manual',
      paidAt: new Date(),
      transactionId: paymentId,
    },
    pointsAdded: true,
    pointsDeducted: false,
  });
  await recharge.save();

  await userBalance.addBalance(
    points,
    `管理員手動充值 - ${reason} (管理員: ${adminLabel})`
  );

  return {
    balance: userBalance.balance,
    rechargeId: recharge._id,
  };
}

async function main() {
  const entries = loadList();
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';

  console.log(DRY_RUN ? '🔍 預覽模式（不寫入資料庫）' : '⚠️  將寫入資料庫');
  console.log(`📦 名單筆數: ${entries.length}`);
  console.log(`🔗 MONGODB_URI: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}\n`);

  await mongoose.connect(uri);

  const results = { ok: [], skip: [], fail: [] };

  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    const email = normalizeEmail(row.email);
    const points = parseInt(row.points, 10);
    const reason = String(row.reason || '').trim();

    if (!email) {
      results.skip.push({ row: i + 1, email: '(空)', message: '缺少 email' });
      continue;
    }
    if (!Number.isFinite(points) || points < 1) {
      results.skip.push({ row: i + 1, email, message: 'points 須為正整數' });
      continue;
    }
    if (!reason) {
      results.skip.push({ row: i + 1, email, message: '缺少 reason' });
      continue;
    }

    try {
      const user = await User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      if (!user) {
        results.fail.push({ row: i + 1, email, message: '找不到用戶' });
        continue;
      }

      if (DRY_RUN) {
        const ub = await UserBalance.findOne({ user: user._id }).select('balance');
        results.ok.push({
          row: i + 1,
          email,
          name: user.name,
          points,
          reason,
          balanceAfter: (ub?.balance ?? 0) + points,
          dryRun: true,
        });
        continue;
      }

      const { balance, rechargeId } = await manualRechargeForUser({
        user,
        points,
        reason,
        index: i,
      });
      results.ok.push({
        row: i + 1,
        email,
        name: user.name,
        points,
        reason,
        balanceAfter: balance,
        rechargeId: String(rechargeId),
      });
    } catch (err) {
      results.fail.push({
        row: i + 1,
        email,
        message: err.message || String(err),
      });
    }
  }

  console.log('\n========== 結果 ==========');
  console.log(`✅ 成功: ${results.ok.length}`);
  for (const r of results.ok) {
    const extra = r.dryRun ? ' [dry-run]' : ` → 餘額 ${r.balanceAfter}`;
    console.log(`   #${r.row} ${r.email} (${r.name}) +${r.points} — ${r.reason}${extra}`);
  }
  console.log(`⏭️  略過: ${results.skip.length}`);
  for (const r of results.skip) {
    console.log(`   #${r.row} ${r.email}: ${r.message}`);
  }
  console.log(`❌ 失敗: ${results.fail.length}`);
  for (const r of results.fail) {
    console.log(`   #${r.row} ${r.email}: ${r.message}`);
  }

  await mongoose.disconnect();

  if (!DRY_RUN && results.fail.length > 0) {
    process.exit(1);
  }
}

(async () => {
  try {
    if (!DRY_RUN && !SKIP_CONFIRM) {
      console.log('即將寫入資料庫。若為預覽請加 --dry-run；確定執行請加 --yes\n');
      process.exit(0);
    }
    await main();
  } catch (err) {
    console.error('❌', err.message || err);
    process.exit(1);
  }
})();
