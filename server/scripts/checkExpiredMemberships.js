/**
 * 手動執行與伺服器每日排程相同的會員任務：VIP 餘 1 整日續期 180 日 + 過期降級。
 * 用法：MONGODB_URI=... node server/scripts/checkExpiredMemberships.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { runDailyMembershipJobs } = require('../utils/membershipChecker');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('請設定 MONGODB_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log('✅ 已連線 MongoDB');
  const result = await runDailyMembershipJobs();
  console.log('📊 結果:', result);
  await mongoose.connection.close();
  console.log('🔌 已關閉連線');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main };
