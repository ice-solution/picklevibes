/**
 * 建立預設店鋪並為現有 Court / Booking 寫入 store
 * 執行：node server/scripts/migrateDefaultStore.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const Court = require('../models/Court');
const Booking = require('../models/Booking');

const DEFAULT_STORE = {
  name: 'PickleVibes 荔枝角',
  slug: 'lai-chi-kok',
  address: '荔枝角福源廣場8樓B C D室',
  phone: '',
  sortOrder: 0,
  isActive: true,
  enableHikAccess: true,
};

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  console.log('✅ 已連接資料庫');

  let store = await Store.findOne({ slug: DEFAULT_STORE.slug });
  if (!store) {
    store = await Store.create(DEFAULT_STORE);
    console.log('✅ 已建立預設店鋪:', store.name);
  } else {
    store.enableHikAccess = true;
    await store.save();
    console.log('ℹ️  預設店鋪已存在:', store.name);
  }

  const courtResult = await Court.updateMany(
    { $or: [{ store: { $exists: false } }, { store: null }] },
    { $set: { store: store._id } }
  );
  console.log(`✅ 已更新 ${courtResult.modifiedCount} 個場地的 store`);

  // 場地若仍無 store，一律掛預設店（舊資料）
  const courtOrphanResult = await Court.updateMany(
    { $or: [{ store: { $exists: false } }, { store: null }] },
    { $set: { store: store._id } }
  );
  if (courtOrphanResult.modifiedCount > 0) {
    console.log(`✅ 已補上 ${courtOrphanResult.modifiedCount} 個仍缺 store 的場地`);
  }

  const courts = await Court.find({}).select('_id store');
  const courtStoreMap = new Map(courts.map((c) => [String(c._id), c.store]));

  const bookingsMissingStore = await Booking.find({
    $or: [{ store: { $exists: false } }, { store: null }],
  }).select('_id court');

  const bulkOps = [];
  let bookingNoCourt = 0;
  for (const b of bookingsMissingStore) {
    const storeId = courtStoreMap.get(String(b.court));
    if (storeId) {
      bulkOps.push({
        updateOne: {
          filter: { _id: b._id },
          update: { $set: { store: storeId } }
        }
      });
    } else {
      bookingNoCourt += 1;
    }
  }

  if (bulkOps.length > 0) {
    const bulkResult = await Booking.bulkWrite(bulkOps, { ordered: false });
    console.log(`✅ 已更新 ${bulkResult.modifiedCount} 筆預約的 store（由場地推斷）`);
  }

  if (bookingNoCourt > 0) {
    console.log(`⚠️  ${bookingNoCourt} 筆預約找不到場地／店鋪，請人工檢查`);
  }

  const stillMissing = await Booking.countDocuments({
    $or: [{ store: { $exists: false } }, { store: null }],
    status: { $in: ['confirmed', 'completed'] }
  });
  if (stillMissing > 0) {
    console.log(`⚠️  仍有 ${stillMissing} 筆有效預約沒有 store（會計將顯示「未指定店鋪」）`);
  }

  try {
    await Court.collection.dropIndex('number_1');
    console.log('✅ 已移除舊的 number 唯一索引');
  } catch (e) {
    console.log('ℹ️  number 唯一索引不存在或已移除');
  }

  await Court.collection.createIndex({ store: 1, number: 1 }, { unique: true });
  console.log('✅ 已建立 store + number 複合唯一索引');

  await mongoose.disconnect();
  console.log('完成');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
