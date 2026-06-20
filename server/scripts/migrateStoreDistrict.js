/**
 * 為現有店鋪補上 district（依地址推斷香港 18 區）
 * 執行：npm run migrate-store-district
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const { inferDistrictFromAddress, HK_DISTRICTS } = require('../utils/hkDistricts');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('請設定 MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('已連線 MongoDB');

  const stores = await Store.find({}).select('name address district');
  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const store of stores) {
    if (store.district && HK_DISTRICTS.includes(store.district)) {
      skipped += 1;
      continue;
    }
    const inferred = inferDistrictFromAddress(store.address);
    if (!inferred) {
      unresolved += 1;
      console.warn(`⚠ 無法推斷: ${store.name} | ${store.address}`);
      continue;
    }
    store.district = inferred;
    await store.save();
    updated += 1;
    console.log(`✓ ${store.name} → ${inferred}`);
  }

  console.log('\n完成');
  console.log(`  已更新: ${updated}`);
  console.log(`  已有設定: ${skipped}`);
  console.log(`  待手動設定: ${unresolved}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
