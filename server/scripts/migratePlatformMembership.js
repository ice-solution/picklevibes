/**
 * 將 User.membershipLevel / membershipExpiry 遷移至 PlatformMembership（可重跑）
 * 執行：npm run migrate-platform-membership
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const PlatformMembership = require('../models/PlatformMembership');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== PlatformMembership 遷移 ===\n');
  console.log(`資料庫：${mongoose.connection.name}\n`);

  const users = await User.find().select('email membershipLevel membershipExpiry');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const tier = user.membershipLevel === 'vip' ? 'vip' : 'basic';
    const expiry = user.membershipExpiry || null;

    const existing = await PlatformMembership.findOne({ user: user._id });
    if (!existing) {
      await PlatformMembership.create({
        user: user._id,
        tier,
        expiry,
        source: 'legacy_picklevibes',
      });
      created += 1;
      console.log(`  + ${user.email} → ${tier}${expiry ? ` (至 ${expiry.toISOString().slice(0, 10)})` : ''}`);
    } else if (existing.tier !== tier || String(existing.expiry) !== String(expiry)) {
      existing.tier = tier;
      existing.expiry = expiry;
      if (!existing.source) existing.source = 'legacy_picklevibes';
      await existing.save();
      updated += 1;
      console.log(`  ~ ${user.email} 已同步`);
    } else {
      skipped += 1;
    }
  }

  const vipCount = await PlatformMembership.countDocuments({ tier: 'vip' });
  console.log(`\n完成：新增 ${created}、更新 ${updated}、略過 ${skipped}`);
  console.log(`PlatformMembership VIP 總數：${vipCount}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
