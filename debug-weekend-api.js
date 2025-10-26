const axios = require('axios');

async function debugWeekendAPI() {
  const baseURL = 'http://localhost:5001/api';
  
  console.log('🔍 調試週末設定 API...\n');

  try {
    // 測試服務器是否運行
    console.log('1️⃣ 測試服務器連接...');
    try {
      const healthResponse = await axios.get(`${baseURL.replace('/api', '')}/health`);
      console.log('✅ 服務器運行正常');
    } catch (error) {
      console.log('❌ 服務器連接失敗:', error.message);
      return;
    }

    // 測試週末 API 端點
    console.log('\n2️⃣ 測試週末 API 端點...');
    try {
      const response = await axios.get(`${baseURL}/weekend/config`);
      console.log('✅ 週末 API 可訪問:', response.data);
    } catch (error) {
      console.log('❌ 週末 API 訪問失敗:');
      console.log('   狀態碼:', error.response?.status);
      console.log('   錯誤信息:', error.response?.data);
      console.log('   完整錯誤:', error.message);
      
      if (error.response?.status === 404) {
        console.log('\n💡 可能的原因:');
        console.log('   - 路由未正確註冊');
        console.log('   - 路徑不正確');
        console.log('   - 服務器未重啟');
      }
      
      if (error.response?.status === 401) {
        console.log('\n💡 認證問題:');
        console.log('   - 需要管理員權限');
        console.log('   - 請檢查 JWT token');
      }
    }

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  }
}

debugWeekendAPI();
