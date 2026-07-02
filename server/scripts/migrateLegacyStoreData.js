/**
 * 將舊版無 store 的營運資料掛到預設店鋪（荔枝角）
 * 執行：npm run migrate-legacy-store-data
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const RedeemCode = require('../models/RedeemCode');
const Activity = require('../models/Activity');

const DEFAULT_SLUG = 'lai-chi-kok';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);

  const store = await Store.findOne({ slug: DEFAULT_SLUG, isActive: true });
  if (!store) {
    throw new Error(`找不到預設店鋪 slug=${DEFAULT_SLUG}`);
  }

  const missingStore = { $or: [{ store: { $exists: false } }, { store: null }] };

  const redeemResult = await RedeemCode.updateMany(missingStore, { $set: { store: store._id } });
  const activityResult = await Activity.updateMany(missingStore, { $set: { store: store._id } });

  console.log(`✅ 兌換碼：已更新 ${redeemResult.modifiedCount} 筆 → ${store.name}`);
  console.log(`✅ 活動：已更新 ${activityResult.modifiedCount} 筆 → ${store.name}`);
  console.log('完成');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
