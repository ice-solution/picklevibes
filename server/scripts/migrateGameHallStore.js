/**
 * 為現有 GameHall 補上 store 關聯（依名稱關鍵字推斷加盟店鋪）
 * 執行：npm run migrate-game-hall-store
 */
require('dotenv').config();
const mongoose = require('mongoose');
const GameHall = require('../models/GameHall');
const Store = require('../models/Store');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('請設定 MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('已連線 MongoDB');

  const stores = await Store.find({ allianceEnabled: true, isActive: true })
    .select('name slug')
    .lean();
  const halls = await GameHall.find({ $or: [{ store: null }, { store: { $exists: false } }] });

  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const hall of halls) {
    const hallName = String(hall.name || '').toLowerCase();
    const match = stores.find((s) => {
      const sn = String(s.name || '').toLowerCase();
      const slug = String(s.slug || '').toLowerCase();
      return hallName.includes(slug) || hallName.includes(sn) || sn.includes(hallName);
    });

    if (!match) {
      unresolved += 1;
      console.warn(`⚠ 無法推斷店鋪: GameHall「${hall.name}」`);
      continue;
    }

    hall.store = match._id;
    await hall.save();
    updated += 1;
    console.log(`✓ ${hall.name} → ${match.name} (${match.slug})`);
  }

  const already = await GameHall.countDocuments({ store: { $ne: null } });
  skipped = already - updated;

  console.log('\n完成');
  console.log(`  新關聯: ${updated}`);
  console.log(`  已有 store: ${already}`);
  console.log(`  待手動設定: ${unresolved}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
