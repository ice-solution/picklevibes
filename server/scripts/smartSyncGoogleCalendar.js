const mongoose = require('mongoose');
const SmartGoogleCalendarSync = require('../services/smartGoogleCalendarSync');
require('dotenv').config();

async function smartSyncGoogleCalendar() {
  console.log('📅 Google Calendar 智能同步已停用，此腳本不會執行同步');
  return;

  try {
    // 解析命令行參數
    const args = process.argv.slice(2);
    const isToday = args.includes('--today');
    const isMonth = args.includes('--month');

    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    // 初始化智能同步服務
    const smartSync = new SmartGoogleCalendarSync();
    await smartSync.initialize();

    console.log('🧠 開始智能Google Calendar同步...\n');

    // 根據參數設置同步範圍
    let syncOptions = {};
    if (isToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      syncOptions = { startDate: today, endDate: tomorrow };
      console.log('📅 同步範圍: 今天');
    } else if (isMonth) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      syncOptions = { startDate: firstDay, endDate: lastDay };
      console.log('📅 同步範圍: 本月');
    } else {
      console.log('📅 同步範圍: 全部');
    }

    // 獲取同步統計
    const stats = await smartSync.getSyncStats();
    console.log('📊 當前同步狀態:');
    console.log(`- 待同步: ${stats.pending} 個`);
    console.log(`- 已同步: ${stats.synced} 個`);
    console.log(`- 同步失敗: ${stats.failed} 個`);
    console.log(`- 總計: ${stats.total} 個\n`);

    // 智能同步
    const syncResult = await smartSync.smartSync(syncOptions);
    
    // 同步取消的預約
    const cancelResult = await smartSync.syncCancelledBookings();

    // 獲取最終統計
    const finalStats = await smartSync.getSyncStats();
    console.log('\n📊 同步後狀態:');
    console.log(`- 待同步: ${finalStats.pending} 個`);
    console.log(`- 已同步: ${finalStats.synced} 個`);
    console.log(`- 同步失敗: ${finalStats.failed} 個`);
    console.log(`- 總計: ${finalStats.total} 個`);

    console.log('\n🎯 智能同步任務完成');
    console.log(`✅ 新同步: ${syncResult.synced} 個`);
    console.log(`✅ 更新: ${syncResult.updated} 個`);
    console.log(`❌ 失敗: ${syncResult.failed} 個`);
    console.log(`🗑️ 刪除取消: ${cancelResult.deleted} 個`);

    // 關閉數據庫連接
    await mongoose.disconnect();
    console.log('\n📊 數據庫連接已關閉');
    console.log('🎯 智能同步任務執行完成');

  } catch (error) {
    console.error('❌ 智能同步失敗:', error);
    process.exit(1);
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  smartSyncGoogleCalendar();
}

module.exports = smartSyncGoogleCalendar;
