const mongoose = require('mongoose');
const GoogleCalendarService = require('../services/googleCalendarService');
require('dotenv').config();

async function syncGoogleCalendar() {
  console.log('📅 Google Calendar 同步已停用，此腳本不會執行同步');
  return;

  try {
    console.log('🔄 開始Google Calendar同步任務...');
    
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    // 初始化Google Calendar服務
    const googleCalendarService = new GoogleCalendarService();
    const initialized = await googleCalendarService.initialize();
    if (!initialized) {
      console.log('❌ Google Calendar服務初始化失敗，跳過同步');
      return;
    }

    // 同步所有預約
    await googleCalendarService.syncAllBookings();
    
    // 同步預約變更
    await googleCalendarService.syncBookingChanges();

    console.log('✅ Google Calendar同步任務完成');
  } catch (error) {
    console.error('❌ Google Calendar同步任務失敗:', error);
  } finally {
    // 關閉數據庫連接
    await mongoose.connection.close();
    console.log('📊 數據庫連接已關閉');
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  syncGoogleCalendar()
    .then(() => {
      console.log('🎯 同步任務執行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 同步任務執行失敗:', error);
      process.exit(1);
    });
}

module.exports = syncGoogleCalendar;
