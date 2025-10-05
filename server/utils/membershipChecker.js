const User = require('../models/User');

// 檢查過期VIP會員的函數
async function checkExpiredMemberships() {
  try {
    console.log('🕐 開始檢查過期的VIP會員...');
    
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

    return { expiredCount, totalVipUsers: currentVipUsers.length };
  } catch (error) {
    console.error('❌ 檢查過期會員失敗:', error);
    throw error;
  }
}

module.exports = { checkExpiredMemberships };
