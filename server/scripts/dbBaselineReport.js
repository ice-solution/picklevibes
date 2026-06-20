/**
 * SaaS 遷移前資料盤點（唯讀）
 * 執行：npm run db-baseline-report
 * 建議連線：MONGODB_URI=mongodb://127.0.0.1:27017/picklevibes-saas-dev
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Store = require('../models/Store');
const Booking = require('../models/Booking');
const Activity = require('../models/Activity');
const GameHall = require('../models/GameHall');
const Recharge = require('../models/Recharge');

const SAAS_DEV_DB = 'picklevibes-saas-dev';

function dbNameFromUri(uri) {
  if (!uri) return null;
  try {
    const path = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://')).pathname;
    const name = path.replace(/^\//, '').split('?')[0];
    return name || null;
  } catch {
    const m = uri.match(/\/([^/?]+)(\?|$)/);
    return m ? m[1] : null;
  }
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-HK');
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ 請在 .env 設定 MONGODB_URI');
    process.exit(1);
  }

  const dbName = dbNameFromUri(uri);
  if (dbName !== SAAS_DEV_DB) {
    console.warn(`⚠️  目前 DB 為「${dbName || '未知'}」，建議使用 ${SAAS_DEV_DB} 做 SaaS 開發盤點。`);
    console.warn('   若確定要盤點此庫，可忽略此警告。\n');
  }

  await mongoose.connect(uri);
  console.log('=== PickCourt / SaaS 資料盤點（唯讀）===\n');
  console.log(`資料庫：${mongoose.connection.name}`);
  console.log(`時間：${new Date().toISOString()}\n`);

  const [
    userTotal,
    userAdmins,
    userCoaches,
    userVip,
    balanceAgg,
    storeTotal,
    bookingTotal,
    bookingNoStore,
    activityTotal,
    gameHallTotal,
    rechargeTotal,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'coach' }),
    User.countDocuments({ membershipLevel: 'vip' }),
    UserBalance.aggregate([
      {
        $group: {
          _id: null,
          accounts: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          totalRecharged: { $sum: '$totalRecharged' },
          totalSpent: { $sum: '$totalSpent' },
        },
      },
    ]),
    Store.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ $or: [{ store: null }, { store: { $exists: false } }] }),
    Activity.countDocuments(),
    GameHall.countDocuments(),
    Recharge.countDocuments(),
  ]);

  const bal = balanceAgg[0] || { accounts: 0, totalBalance: 0, totalRecharged: 0, totalSpent: 0 };

  console.log('── 用戶與會籍 ──');
  console.log(`  用戶總數：     ${fmt(userTotal)}`);
  console.log(`  管理員：       ${fmt(userAdmins)}`);
  console.log(`  教練：         ${fmt(userCoaches)}`);
  console.log(`  VIP 會員：     ${fmt(userVip)}`);

  console.log('\n── 積分錢包（全域 UserBalance）──');
  console.log(`  有餘額帳戶：   ${fmt(bal.accounts)}`);
  console.log(`  總餘額：       ${fmt(bal.totalBalance)} 積分`);
  console.log(`  累計充值：     ${fmt(bal.totalRecharged)}`);
  console.log(`  累計消費：     ${fmt(bal.totalSpent)}`);

  console.log('\n── 店鋪（Tenant 候選）──');
  console.log(`  店鋪總數：     ${fmt(storeTotal)}`);
  const stores = await Store.find().select('name slug isActive openApiEnabled').sort({ sortOrder: 1, name: 1 }).lean();
  for (const s of stores) {
    const [bookings, activities] = await Promise.all([
      Booking.countDocuments({ store: s._id }),
      Activity.countDocuments({ store: s._id }),
    ]);
    const flags = [
      s.isActive ? 'active' : 'inactive',
      s.openApiEnabled ? 'openApi' : null,
    ].filter(Boolean).join(', ');
    console.log(`  - ${s.name} (${s.slug}) [${flags}]`);
    console.log(`      預約 ${fmt(bookings)}｜活動 ${fmt(activities)}`);
  }

  console.log('\n── 其他 ──');
  console.log(`  預約總數：     ${fmt(bookingTotal)}（無 store：${fmt(bookingNoStore)}）`);
  console.log(`  活動總數：     ${fmt(activityTotal)}`);
  console.log(`  計分廳：       ${fmt(gameHallTotal)}（尚未連 store）`);
  console.log(`  充值紀錄：     ${fmt(rechargeTotal)}`);

  console.log('\n── SaaS 開發建議下一步 ──');
  console.log('  1. Store 加 tenant / alliance 欄位');
  console.log('  2. resolveTenant middleware');
  console.log('  4. GameHall 加 store 關聯\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
