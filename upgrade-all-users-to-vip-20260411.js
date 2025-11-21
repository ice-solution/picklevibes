// 一次性腳本：把所有會員的 VIP 期限統一設置到 2026-04-11
// 使用 .env 中的 MONGODB_URI 連接資料庫

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');

// 使用 .env 裏的 MONGODB_URI，如果沒有就退回本地預設
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';

async function main() {
  try {
    console.log('🚀 開始批量更新會員 VIP 期限到 2026-04-11 ...\n');
    console.log('📡 使用的資料庫連接字串:', MONGODB_URI, '\n');

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    // 目標到期日：2026-04-11 23:59:59（注意：月份從 0 開始，所以 3 代表 4 月）
    const targetExpiry = new Date(2026, 3, 11, 23, 59, 59);
    console.log('📅 目標 VIP 到期日期:', targetExpiry.toISOString(), '\n');

    // 這裡假設「會員」指所有非管理員用戶（role !== 'admin'）
    // 如需包含 admin，一併移除 role 條件即可
    const filter = {
      role: { $ne: 'admin' }
    };

    const totalBefore = await User.countDocuments(filter);
    console.log(`📊 符合條件的會員總數: ${totalBefore}`);

    if (totalBefore === 0) {
      console.log('✅ 沒有需要更新的會員，腳本結束。');
      return;
    }

    const result = await User.updateMany(filter, {
      $set: {
        membershipLevel: 'vip',
        membershipExpiry: targetExpiry
      }
    });

    console.log('\n✅ 更新完成！');
    console.log(`  ➜ 匹配的會員數量: ${result.matchedCount || result.n}`);
    console.log(`  ➜ 實際更新的會員數量: ${result.modifiedCount || result.nModified}`);

    const vipCount = await User.countDocuments({
      role: { $ne: 'admin' },
      membershipLevel: 'vip'
    });
    console.log(`\n📈 目前 VIP 會員總數（不含 admin）: ${vipCount}`);
  } catch (err) {
    console.error('❌ 更新過程中發生錯誤:', err);
  } finally {
    await mongoose.connection.close();
    console.log('\n📡 資料庫連接已關閉');
  }
}

console.log('⚠️  警告：此腳本會把所有非 admin 用戶的 VIP 到期日，統一設定為 2026-04-11。');
console.log('   3 秒後自動開始執行（如需取消，請立即按 Ctrl+C）...\n');

setTimeout(() => {
  main();
}, 3000);


