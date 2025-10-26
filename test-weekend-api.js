const axios = require('axios');

// 測試週末設定 API
async function testWeekendAPI() {
  const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  
  console.log('🧪 測試週末設定 API...\n');

  try {
    // 1. 測試獲取設定
    console.log('1️⃣ 測試獲取週末設定...');
    const configResponse = await axios.get(`${baseURL}/weekend/config`, {
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'your-admin-token-here'}`
      }
    });
    console.log('✅ 獲取設定成功:', configResponse.data);

    // 2. 測試檢查日期
    console.log('\n2️⃣ 測試檢查日期...');
    const checkResponse = await axios.post(`${baseURL}/weekend/check`, {
      date: '2024-10-30'
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'your-admin-token-here'}`
      }
    });
    console.log('✅ 檢查日期成功:', checkResponse.data);

    // 3. 測試添加國定假日
    console.log('\n3️⃣ 測試添加國定假日...');
    const addResponse = await axios.post(`${baseURL}/weekend/holidays`, {
      dates: ['2024-12-31', '2025-01-01']
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'your-admin-token-here'}`
      }
    });
    console.log('✅ 添加國定假日成功:', addResponse.data);

    // 4. 測試更新設定
    console.log('\n4️⃣ 測試更新週末設定...');
    const updateResponse = await axios.put(`${baseURL}/weekend/config`, {
      weekendDays: [0, 6],
      includeFridayEvening: true,
      fridayEveningHour: 18
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'your-admin-token-here'}`
      }
    });
    console.log('✅ 更新設定成功:', updateResponse.data);

    console.log('\n🎉 所有 API 測試通過！');

  } catch (error) {
    console.error('❌ API 測試失敗:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 提示: 請設置 ADMIN_TOKEN 環境變數');
      console.log('   export ADMIN_TOKEN="your-admin-jwt-token"');
    }
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  testWeekendAPI();
}

module.exports = testWeekendAPI;
