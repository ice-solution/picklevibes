const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/picklevibes';

async function checkExpiredMemberships() {
  try {
    // 檢查是否已經連接
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ 連接到 MongoDB Atlas 成功');
    } else {
      console.log('✅ 使用現有 MongoDB 連接');
    }

    // 獲取所有VIP會員
    const vipUsers = await User.find({ membershipLevel: 'vip' });
    console.log(`📋 找到 ${vipUsers.length} 個VIP會員`);

    let expiredCount = 0;
    const now = new Date();

    for (const user of vipUsers) {
      if (user.membershipExpiry && now > user.membershipExpiry) {
        console.log(`🔄 用戶 ${user.name} (${user.email}) 的VIP會籍已過期，降級為普通會員`);
        
        user.membershipLevel = 'basic';
        user.membershipExpiry = null;
        await user.save();
        
        expiredCount++;
      }
    }

    console.log(`✅ 檢查完成，${expiredCount} 個VIP會員已過期並降級為普通會員`);

    // 顯示當前VIP會員狀態
    const currentVipUsers = await User.find({ membershipLevel: 'vip' });
    console.log(`📊 當前還有 ${currentVipUsers.length} 個有效VIP會員`);

    if (currentVipUsers.length > 0) {
      console.log('📅 VIP會員到期情況:');
      currentVipUsers.forEach(user => {
        if (user.membershipExpiry) {
          const daysLeft = Math.ceil((user.membershipExpiry - now) / (1000 * 60 * 60 * 24));
          console.log(`  - ${user.name}: ${daysLeft}天後過期 (${user.membershipExpiry.toLocaleDateString('zh-TW')})`);
        }
      });
    }

  } catch (error) {
    console.error('❌ 檢查過期會員失敗:', error);
  }
  // 注意：不關閉連接，因為服務器需要保持連接
}

// 如果直接運行此腳本
if (require.main === module) {
  checkExpiredMemberships().then(() => {
    mongoose.connection.close();
    console.log('🔌 數據庫連接已關閉');
  });
}

module.exports = checkExpiredMemberships;
