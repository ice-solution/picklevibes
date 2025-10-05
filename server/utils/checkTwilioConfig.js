/**
 * Twilio 配置檢查工具
 * 用於診斷 Twilio WhatsApp 配置問題
 */

function checkTwilioConfig() {
  console.log('🔍 檢查 Twilio 配置...\n');

  // 檢查環境變量
  const requiredVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_FROM'
  ];

  let allConfigured = true;

  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (!value) {
      console.error(`❌ ${varName}: 未設置`);
      allConfigured = false;
    } else if (value.includes('your_') || value.includes('example')) {
      console.warn(`⚠️  ${varName}: 使用預設值，請設置實際值`);
      allConfigured = false;
    } else {
      // 隱藏敏感信息，只顯示前後幾位
      const maskedValue = value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : '***';
      console.log(`✅ ${varName}: ${maskedValue}`);
    }
  });

  console.log('\n📋 配置檢查結果:');
  if (allConfigured) {
    console.log('✅ 所有必要的環境變量都已正確設置');
  } else {
    console.log('❌ 部分環境變量未設置或使用預設值');
    console.log('\n🔧 請在 .env 文件中設置以下變量:');
    console.log('TWILIO_ACCOUNT_SID=your_actual_account_sid');
    console.log('TWILIO_AUTH_TOKEN=your_actual_auth_token');
    console.log('TWILIO_WHATSAPP_FROM=whatsapp:+14155238886');
  }

  // 檢查 WhatsApp Sandbox 設置
  console.log('\n📱 WhatsApp Sandbox 設置檢查:');
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  if (fromNumber === 'whatsapp:+14155238886') {
    console.log('⚠️  使用默認 Sandbox 號碼，請確保已設置 WhatsApp Sandbox');
    console.log('📋 設置步驟:');
    console.log('1. 訪問 https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
    console.log('2. 按照指示設置 WhatsApp Sandbox');
    console.log('3. 獲取您的專用 Sandbox 號碼');
    console.log('4. 更新 TWILIO_WHATSAPP_FROM 環境變量');
  } else {
    console.log(`✅ 使用自定義 WhatsApp 號碼: ${fromNumber}`);
  }

  return allConfigured;
}

/**
 * 測試 Twilio 客戶端初始化
 */
function testTwilioClient() {
  try {
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    console.log('✅ Twilio 客戶端初始化成功');
    return true;
  } catch (error) {
    console.error('❌ Twilio 客戶端初始化失敗:', error.message);
    return false;
  }
}

module.exports = {
  checkTwilioConfig,
  testTwilioClient
};
