// 批量升級所有用戶為 VIP 會員的腳本
require('dotenv').config();
const mongoose = require('mongoose');

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = require('./server/models/User');

async function upgradeAllUsersToVip() {
  try {
    console.log('🚀 開始批量升級所有用戶為 VIP 會員...\n');

    // 獲取所有普通用戶
    const basicUsers = await User.find({ 
      membershipLevel: 'basic',
      role: { $ne: 'admin' } // 排除管理員
    });

    console.log(`📊 找到 ${basicUsers.length} 個普通用戶需要升級`);

    if (basicUsers.length === 0) {
      console.log('✅ 沒有需要升級的用戶');
      return;
    }

    // 設置 VIP 期限（30天）
    const vipExpiryDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    
    let successCount = 0;
    let errorCount = 0;

    console.log('\n🔄 開始升級用戶...\n');

    for (const user of basicUsers) {
      try {
        console.log(`👤 升級用戶: ${user.name} (${user.email})`);
        
        user.membershipLevel = 'vip';
        user.membershipExpiry = vipExpiryDate;
        
        await user.save();
        
        console.log(`  ✅ 成功升級為 VIP 會員，到期日期: ${vipExpiryDate.toLocaleDateString('zh-TW')}`);
        successCount++;
        
      } catch (error) {
        console.error(`  ❌ 升級失敗: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 升級結果統計:');
    console.log(`  ✅ 成功升級: ${successCount} 個用戶`);
    console.log(`  ❌ 升級失敗: ${errorCount} 個用戶`);
    console.log(`  📅 VIP 到期日期: ${vipExpiryDate.toLocaleDateString('zh-TW')}`);

    // 顯示當前 VIP 會員統計
    const totalVipUsers = await User.countDocuments({ membershipLevel: 'vip' });
    console.log(`\n📈 當前總 VIP 會員數量: ${totalVipUsers}`);

    console.log('\n✅ 批量升級完成！');

  } catch (error) {
    console.error('❌ 批量升級失敗:', error);
  } finally {
    mongoose.connection.close();
    console.log('📡 數據庫連接已關閉');
  }
}

// 確認執行
console.log('⚠️  警告：此腳本將把所有普通用戶升級為 VIP 會員');
console.log('📅 VIP 會員期限：30天');
console.log('🔄 是否繼續執行？(按 Ctrl+C 取消)');

// 3秒後自動執行
setTimeout(() => {
  console.log('\n🚀 開始執行...\n');
  upgradeAllUsersToVip();
}, 3000);
