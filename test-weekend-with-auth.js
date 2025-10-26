const axios = require('axios');

async function testWeekendWithAuth() {
  const baseURL = 'http://localhost:5001/api';
  
  console.log('🔍 測試週末 API 認證...\n');

  try {
    // 1. 測試無認證的請求
    console.log('1️⃣ 測試無認證請求...');
    try {
      const response = await axios.get(`${baseURL}/weekend/config`);
      console.log('✅ 無認證請求成功:', response.data);
    } catch (error) {
      console.log('❌ 無認證請求失敗 (預期):', error.response?.data?.message);
    }

    // 2. 測試錯誤的認證
    console.log('\n2️⃣ 測試錯誤認證...');
    try {
      const response = await axios.get(`${baseURL}/weekend/config`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('✅ 錯誤認證請求成功:', response.data);
    } catch (error) {
      console.log('❌ 錯誤認證請求失敗 (預期):', error.response?.data?.message);
    }

    // 3. 測試管理員認證 (需要有效的管理員 token)
    console.log('\n3️⃣ 測試管理員認證...');
    console.log('💡 請提供有效的管理員 JWT token 來測試');
    console.log('   可以在瀏覽器開發者工具中查看 localStorage.getItem("token")');
    
    // 這裡需要用戶提供有效的管理員 token
    const adminToken = process.env.ADMIN_TOKEN;
    if (adminToken) {
      try {
        const response = await axios.get(`${baseURL}/weekend/config`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });
        console.log('✅ 管理員認證請求成功:', response.data);
      } catch (error) {
        console.log('❌ 管理員認證請求失敗:', error.response?.data?.message);
      }
    } else {
      console.log('⚠️  未設置 ADMIN_TOKEN 環境變數');
    }

    console.log('\n📋 調試建議:');
    console.log('1. 檢查用戶是否已登入');
    console.log('2. 檢查用戶是否有管理員權限');
    console.log('3. 檢查 JWT token 是否有效');
    console.log('4. 檢查 CORS 設置');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

testWeekendWithAuth();
