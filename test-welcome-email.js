// 測試歡迎郵件功能
require('dotenv').config();
const emailService = require('./server/services/emailService');

async function testWelcomeEmail() {
  try {
    console.log('🧪 開始測試歡迎郵件功能...');
    
    // 測試數據
    const testUserData = {
      name: '測試用戶',
      email: 'itsukeith@gmail.com', // 請替換為您的測試郵箱
      password: 'TestPassword123',
      role: 'user',
      membershipLevel: 'vip',
      membershipExpiry: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) // 30天後過期
    };

    console.log('📧 發送測試歡迎郵件到:', testUserData.email);
    
    const result = await emailService.sendWelcomeEmail(testUserData);
    
    console.log('✅ 測試成功！');
    console.log('結果:', result);
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

// 運行測試
testWelcomeEmail();
