/**
 * 遷移全域 UserBalance → 店鋪 StoreBalance，並補齊 RechargeOffer.store
 *
 * 執行：
 *   npm run migrate-store-balance              # 預覽（dry-run）
 *   npm run migrate-store-balance -- --apply   # 實際寫入
 *
 * 選項：
 *   --apply              實際寫入（預設僅預覽）
 *   --strategy=default   全部遷到預設店（lai-chi-kok）
 *   --strategy=last-booking  依用戶最近一筆預約的店鋪遷移
 *   --slug=<slug>        覆寫預設店鋪 slug（strategy=default 時）
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const UserBalance = require('../models/UserBalance');
const RechargeOffer = require('../models/RechargeOffer');
const Booking = require('../models/Booking');
const { addStoreBalance } = require('../services/storeBalanceService');

const MIGRATION_MARKER = '系統遷移自全域餘額';
const DEFAULT_SLUG = process.env.LEGACY_DEFAULT_STORE_SLUG || 'lai-chi-kok';

function parseArgs(argv) {
  const args = { apply: false, strategy: 'default', slug: DEFAULT_SLUG };
  for (const raw of argv) {
    if (raw === '--apply') args.apply = true;
    else if (raw.startsWith('--strategy=')) args.strategy = raw.split('=')[1];
    else if (raw.startsWith('--slug=')) args.slug = raw.split('=')[1];
  }
  return args;
}

async function resolveTargetStoreId(userId, defaultStore, strategy) {
  if (strategy !== 'last-booking') return defaultStore._id;

  const lastBooking = await Booking.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select('store court')
    .populate('court', 'store')
    .lean();

  const storeId = lastBooking?.store || lastBooking?.court?.store;
  return storeId || defaultStore._id;
}

async function migrateRechargeOffers(defaultStore, apply) {
  const missingStore = { $or: [{ store: { $exists: false } }, { store: null }] };
  const count = await RechargeOffer.countDocuments(missingStore);
  if (!count) {
    console.log('充值優惠：無需補齊 store');
    return 0;
  }
  if (apply) {
    const result = await RechargeOffer.updateMany(missingStore, { $set: { store: defaultStore._id } });
    console.log(`充值優惠：已更新 ${result.modifiedCount} 筆 → ${defaultStore.name}`);
    return result.modifiedCount;
  }
  console.log(`充值優惠：將更新 ${count} 筆 → ${defaultStore.name}（dry-run）`);
  return count;
}

async function migrateUserBalances({ defaultStore, strategy, apply }) {
  const userBalances = await UserBalance.find({
    $or: [{ balance: { $gt: 0 } }, { totalRecharged: { $gt: 0 } }, { 'transactions.0': { $exists: true } }],
  }).populate('user', 'email name');

  let moved = 0;
  let skipped = 0;

  for (const ub of userBalances) {
    const userId = ub.user?._id || ub.user;
    if (!userId) {
      skipped += 1;
      continue;
    }

    const targetStoreId = await resolveTargetStoreId(userId, defaultStore, strategy);
    const wallet = (ub.storeWallets || []).find((w) => String(w.store) === String(targetStoreId));
    const alreadyMigrated = wallet?.transactions?.some((t) =>
      String(t.description || '').includes(MIGRATION_MARKER)
    );
    if (alreadyMigrated) {
      skipped += 1;
      continue;
    }

    const balanceToMove = ub.balance || 0;
    if (balanceToMove <= 0) {
      skipped += 1;
      continue;
    }

    const store = await Store.findById(targetStoreId).select('name slug');
    const email = ub.user?.email || String(userId);

    if (!apply) {
      console.log(
        `  [dry-run] ${email} → ${store?.name || targetStoreId}: 餘額 ${balanceToMove}`
      );
      moved += 1;
      continue;
    }

    await addStoreBalance(
      userId,
      targetStoreId,
      balanceToMove,
      `${MIGRATION_MARKER}（${balanceToMove} 分）`
    );

    ub.balance = Math.max(0, ub.balance - balanceToMove);
    ub.transactions.push({
      type: 'spend',
      amount: -balanceToMove,
      description: `${MIGRATION_MARKER} → ${store?.name || store?.slug || targetStoreId}`,
      createdAt: new Date(),
    });
    await ub.save();

    console.log(`  ✅ ${email} → ${store?.name}: 已遷移 ${balanceToMove} 分`);
    moved += 1;
  }

  return { moved, skipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);

  console.log('=== 全域餘額 → UserBalance.storeWallets 遷移 ===\n');
  console.log(`資料庫：${mongoose.connection.name}`);
  console.log(`模式：${args.apply ? '實際寫入 (--apply)' : '預覽 (dry-run)'}`);
  console.log(`策略：${args.strategy}`);
  console.log(`預設店鋪 slug：${args.slug}\n`);

  const defaultStore = await Store.findOne({ slug: args.slug, isActive: true });
  if (!defaultStore) {
    throw new Error(`找不到預設店鋪 slug=${args.slug}`);
  }
  console.log(`預設店鋪：${defaultStore.name} (${defaultStore._id})\n`);

  await migrateRechargeOffers(defaultStore, args.apply);
  const { moved, skipped } = await migrateUserBalances({
    defaultStore,
    strategy: args.strategy,
    apply: args.apply,
  });

  console.log(`\n完成：遷移 ${moved} 筆、略過 ${skipped} 筆`);
  if (!args.apply) {
    console.log('\n⚠️  以上為預覽。實際執行請加：npm run migrate-store-balance -- --apply');
  } else {
    console.log('\n⚠️  網店訂單仍使用全域 UserBalance.balance；店鋪預約使用 storeWallets。');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
