/**
 * 將舊 role=admin（全站 super admin）遷移為 role=super_admin
 * 部署多店 RBAC 前請先執行一次：
 *   node server/scripts/migrateAdminRoles.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  console.log('✅ 已連接資料庫');

  const legacyAdmins = await User.find({ role: 'admin', managedStores: { $size: 0 } });
  console.log(`ℹ️  找到 ${legacyAdmins.length} 個未指派店鋪的舊 admin（將升級為 super_admin）`);

  if (legacyAdmins.length === 0) {
    console.log('✅ 無需遷移');
    await mongoose.disconnect();
    return;
  }

  for (const user of legacyAdmins) {
    user.role = 'super_admin';
    await user.save();
    console.log(`  ✓ ${user.email} → super_admin`);
  }

  console.log(`✅ 已遷移 ${legacyAdmins.length} 個帳戶`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
