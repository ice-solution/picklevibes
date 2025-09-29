#!/usr/bin/env node

/**
 * 價格邏輯測試腳本
 * 測試高峰時段和非高峰時段的價格計算
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testPricingLogic() {
  try {
    console.log('🧪 測試價格邏輯...');
    console.log('---');

    // 測試不同時間段的價格
    const testCases = [
      {
        date: '2025-09-29', // 星期一
        startTime: '10:00',
        endTime: '11:00',
        expected: '非高峰時段 (工作日 10:00)'
      },
      {
        date: '2025-09-29', // 星期一
        startTime: '19:00',
        endTime: '20:00',
        expected: '高峰時段 (工作日 19:00)'
      },
      {
        date: '2025-09-28', // 星期日
        startTime: '10:00',
        endTime: '11:00',
        expected: '高峰時段 (週末全天)'
      },
      {
        date: '2025-09-28', // 星期日
        startTime: '19:00',
        endTime: '20:00',
        expected: '高峰時段 (週末全天)'
      }
    ];

    for (const testCase of testCases) {
      console.log(`📅 測試日期: ${testCase.date}`);
      console.log(`⏰ 時間: ${testCase.startTime} - ${testCase.endTime}`);
      console.log(`🎯 預期: ${testCase.expected}`);
      
      try {
        const response = await axios.get(`${API_BASE_URL}/courts/68ce811bada4aaf2c47a11ee/availability`, {
          params: {
            date: testCase.date,
            startTime: testCase.startTime,
            endTime: testCase.endTime
          }
        });

        if (response.data.available) {
          console.log(`💰 價格: HK$ ${response.data.pricing.totalPrice}`);
          console.log(`📊 基礎價格: HK$ ${response.data.pricing.basePrice}`);
          console.log(`🔥 高峰時段: ${response.data.pricing.isPeakHour ? '是' : '否'}`);
        } else {
          console.log(`❌ 不可用: ${response.data.reason}`);
        }
      } catch (error) {
        console.log(`❌ 錯誤: ${error.response?.data?.message || error.message}`);
      }
      
      console.log('---');
    }

    console.log('✅ 價格邏輯測試完成！');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

// 檢查服務器是否運行
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ 服務器未運行，請先啟動服務器：');
    console.log('   PORT=5001 node server/index.js');
    return;
  }
  
  await testPricingLogic();
}

main();
