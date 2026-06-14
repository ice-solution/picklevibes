/**
 * 為現有場地產生 slug（store 內唯一）
 * 執行：node server/scripts/migrateCourtSlugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Court = require('../models/Court');
const { buildCourtSlug } = require('../utils/courtSlug');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  console.log('✅ 已連接資料庫');

  const courts = await Court.find({}).sort({ store: 1, type: 1, number: 1 });
  const byStoreType = new Map();

  for (const court of courts) {
    const key = `${court.store}:${court.type}`;
    byStoreType.set(key, (byStoreType.get(key) || 0) + 1);
  }

  let updated = 0;
  for (const court of courts) {
    const key = `${court.store}:${court.type}`;
    const count = byStoreType.get(key) || 1;
    const slug = buildCourtSlug(court.type, court.number, count);
    if (court.slug === slug) continue;
    court.slug = slug;
    await court.save();
    console.log(`  ✓ ${court.name} → ${slug}`);
    updated += 1;
  }

  console.log(updated ? `✅ 已更新 ${updated} 個場地 slug` : '✅ 所有場地 slug 已是最新');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
