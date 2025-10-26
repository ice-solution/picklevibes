const axios = require('axios');

async function debugWeekendDetailed() {
  const baseURL = 'http://localhost:5001/api';
  
  console.log('🔍 詳細調試週末 API...\n');

  try {
    // 1. 檢查服務器狀態
    console.log('1️⃣ 檢查服務器狀態...');
    try {
      const response = await axios.get('http://localhost:5001/api/bookings?limit=1');
      console.log('✅ 服務器運行正常，API 可訪問');
    } catch (error) {
      console.log('❌ 服務器或 API 有問題:', error.message);
      return;
    }

    // 2. 測試週末 API 端點存在性
    console.log('\n2️⃣ 測試週末 API 端點...');
    try {
      const response = await axios.get(`${baseURL}/weekend/config`);
      console.log('✅ 週末 API 端點存在且可訪問');
    } catch (error) {
      console.log('❌ 週末 API 端點問題:');
      console.log('   狀態碼:', error.response?.status);
      console.log('   錯誤信息:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.log('\n💡 認證問題:');
        console.log('   - 需要管理員權限');
        console.log('   - 請檢查用戶是否已登入');
        console.log('   - 請檢查用戶是否有管理員權限');
      }
      
      if (error.response?.status === 404) {
        console.log('\n💡 路由問題:');
        console.log('   - 路由未正確註冊');
        console.log('   - 請檢查 server/index.js 中的路由註冊');
        console.log('   - 請重啟服務器');
      }
    }

    // 3. 測試其他需要認證的 API
    console.log('\n3️⃣ 測試其他認證 API...');
    try {
      const response = await axios.get(`${baseURL}/users`);
      console.log('✅ 其他認證 API 可訪問');
    } catch (error) {
      console.log('❌ 其他認證 API 也有問題:', error.response?.status);
    }

    // 4. 提供調試建議
    console.log('\n📋 調試建議:');
    console.log('1. 檢查瀏覽器開發者工具中的 Network 標籤');
    console.log('2. 檢查 Console 標籤中的錯誤信息');
    console.log('3. 檢查用戶是否已登入 (localStorage.getItem("token"))');
    console.log('4. 檢查用戶是否有管理員權限');
    console.log('5. 檢查 JWT token 是否有效');
    console.log('6. 檢查 CORS 設置是否正確');

    // 5. 提供測試命令
    console.log('\n🧪 測試命令:');
    console.log('1. 在瀏覽器中打開開發者工具');
    console.log('2. 查看 Console 標籤中的錯誤');
    console.log('3. 查看 Network 標籤中的請求');
    console.log('4. 檢查 localStorage 中的 token');

  } catch (error) {
    console.error('❌ 調試失敗:', error.message);
  }
}

debugWeekendDetailed();
