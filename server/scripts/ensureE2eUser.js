/**
 * 確保 E2E 測試用戶存在（可重跑、idempotent）
 * 執行：node server/scripts/ensureE2eUser.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const E2E_EMAIL = process.env.E2E_USER_EMAIL || 'e2e-test@pickcourt.hk';
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'E2eTestPassword1';
const E2E_NAME = process.env.E2E_USER_NAME || 'E2E 測試用戶';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ 請設定 MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  let user = await User.findOne({ email: E2E_EMAIL });
  if (!user) {
    user = new User({
      name: E2E_NAME,
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      phone: '90000001',
      role: 'user',
      isActive: true,
    });
    await user.save();
    console.log(`✅ 已建立 E2E 測試用戶：${E2E_EMAIL}`);
  } else {
    user.password = E2E_PASSWORD;
    user.isActive = true;
    await user.save();
    console.log(`✅ 已更新 E2E 測試用戶密碼：${E2E_EMAIL}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ensureE2eUser 失敗:', err);
  process.exit(1);
});
