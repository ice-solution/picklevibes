#!/usr/bin/env node

/**
 * 支付測試腳本
 * 用於測試支付狀態更新功能
 * 
 * 使用方法:
 * node test-payment.js <bookingId> <status>
 * 
 * 範例:
 * node test-payment.js 68ce811bada4aaf2c47a11ee success
 * node test-payment.js 68ce811bada4aaf2c47a11ee failed
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5001/api';

async function testPaymentCallback(bookingId, status) {
  try {
    console.log(`🧪 測試支付回調...`);
    console.log(`📋 預約ID: ${bookingId}`);
    console.log(`💳 支付狀態: ${status}`);
    console.log('---');

    const response = await axios.post(`${API_BASE_URL}/payments/test-callback`, {
      bookingId,
      status,
      paymentIntentId: `test_${Date.now()}`
    });

    console.log('✅ 測試成功!');
    console.log('📊 結果:', response.data);
    
    // 驗證更新結果
    console.log('---');
    console.log('📋 預約狀態已更新為:', response.data.booking.status);
    console.log('💳 支付狀態已更新為:', response.data.booking.paymentStatus);
    if (response.data.booking.paidAt) {
      console.log('⏰ 支付時間:', new Date(response.data.booking.paidAt).toLocaleString('zh-TW'));
    }

  } catch (error) {
    console.error('❌ 測試失敗:', error.response?.data || error.message);
  }
}

// 命令行參數處理
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('❌ 使用方法: node test-payment.js <bookingId> <status>');
  console.log('');
  console.log('📋 範例:');
  console.log('  node test-payment.js 68ce811bada4aaf2c47a11ee success');
  console.log('  node test-payment.js 68ce811bada4aaf2c47a11ee failed');
  console.log('');
  console.log('💡 提示: 您可以從預約 API 獲取有效的 bookingId');
  process.exit(1);
}

const [bookingId, status] = args;

if (!['success', 'failed'].includes(status)) {
  console.error('❌ 狀態必須是 "success" 或 "failed"');
  process.exit(1);
}

testPaymentCallback(bookingId, status);



