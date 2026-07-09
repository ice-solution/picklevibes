#!/usr/bin/env node
/**
 * 測試 Wonder 憑證（echo auth，與 checkinSystem 相同）
 * 用法: node server/scripts/test-wonder-echo.js
 */
require('dotenv').config();

const wonderPaymentService = require('../services/wonderPaymentService');
const { isPaymentDev } = require('../config/paymentProvider');

async function main() {
  console.log('🔐 測試 Wonder echo auth…');
  console.log('   PAYMENT_DEV:', isPaymentDev());
  console.log('   Gateway:', wonderPaymentService.getPaymentBaseUrl());
  console.log('   WONDER_APP_ID:', process.env.WONDER_APP_ID || '(未設定)');

  try {
    const res = await wonderPaymentService.echoTest();
    console.log('✅ Auth 成功:', res);
  } catch (err) {
    console.error('❌ Auth 失敗:', err.message);
    console.error('\n請檢查 WONDER_APP_ID / WONDER_PRIVATE_KEY 及 PAYMENT_DEV');
    process.exit(1);
  }
}

main();
