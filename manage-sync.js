const mongoose = require('mongoose');
const SmartGoogleCalendarSync = require('./server/services/smartGoogleCalendarSync');
require('dotenv').config();

async function manageSync() {
  try {
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功');

    const smartSync = new SmartGoogleCalendarSync();
    await smartSync.initialize();

    // 獲取命令行參數
    const command = process.argv[2];
    const args = process.argv.slice(3);

    switch (command) {
      case 'stats':
        // 顯示同步統計
        const stats = await smartSync.getSyncStats();
        console.log('\n📊 Google Calendar 同步統計:');
        console.log(`- 待同步: ${stats.pending} 個`);
        console.log(`- 已同步: ${stats.synced} 個`);
        console.log(`- 同步失敗: ${stats.failed} 個`);
        console.log(`- 總計: ${stats.total} 個`);
        break;

      case 'sync-today':
        // 同步今天的預約
        console.log('🔄 同步今天的預約...');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayResult = await smartSync.smartSync({
          startDate: today,
          endDate: tomorrow
        });
        console.log(`✅ 今天同步完成: 新同步 ${todayResult.synced} 個，更新 ${todayResult.updated} 個，失敗 ${todayResult.failed} 個`);
        break;

      case 'sync-month':
        // 同步本月的預約
        console.log('🔄 同步本月的預約...');
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const monthResult = await smartSync.smartSync({
          startDate: firstDay,
          endDate: lastDay
        });
        console.log(`✅ 本月同步完成: 新同步 ${monthResult.synced} 個，更新 ${monthResult.updated} 個，失敗 ${monthResult.failed} 個`);
        break;

      case 'sync-all':
        // 同步所有預約
        console.log('🔄 同步所有預約...');
        const allResult = await smartSync.smartSync();
        console.log(`✅ 全部同步完成: 新同步 ${allResult.synced} 個，更新 ${allResult.updated} 個，失敗 ${allResult.failed} 個`);
        break;

      case 'force-sync':
        // 強制同步所有預約
        console.log('🔄 強制同步所有預約...');
        const forceResult = await smartSync.smartSync({ forceSync: true });
        console.log(`✅ 強制同步完成: 新同步 ${forceResult.synced} 個，更新 ${forceResult.updated} 個，失敗 ${forceResult.failed} 個`);
        break;

      case 'clean-cancelled':
        // 清理取消的預約
        console.log('🔄 清理取消的預約...');
        const cancelResult = await smartSync.syncCancelledBookings();
        console.log(`✅ 清理完成: 刪除 ${cancelResult.deleted} 個，失敗 ${cancelResult.failed} 個`);
        break;

      case 'reset-status':
        // 重置同步狀態
        console.log('🔄 重置所有預約的同步狀態...');
        const Booking = require('./server/models/Booking');
        const result = await Booking.updateMany(
          {},
          {
            $unset: {
              googleEventId: 1,
              googlePrivateEventId: 1,
              googleSyncStatus: 1,
              googleSyncAt: 1
            }
          }
        );
        console.log(`✅ 已重置 ${result.modifiedCount} 個預約的同步狀態`);
        break;

      default:
        console.log('\n📖 Google Calendar 同步管理工具');
        console.log('\n可用命令:');
        console.log('  stats           - 顯示同步統計');
        console.log('  sync-today      - 同步今天的預約');
        console.log('  sync-month      - 同步本月的預約');
        console.log('  sync-all        - 同步所有預約');
        console.log('  force-sync      - 強制同步所有預約');
        console.log('  clean-cancelled - 清理取消的預約');
        console.log('  reset-status    - 重置所有同步狀態');
        console.log('\n使用範例:');
        console.log('  node manage-sync.js stats');
        console.log('  node manage-sync.js sync-today');
        console.log('  node manage-sync.js sync-month');
        break;
    }

    // 關閉數據庫連接
    await mongoose.disconnect();
    console.log('\n📊 數據庫連接已關閉');

  } catch (error) {
    console.error('❌ 管理同步失敗:', error);
    process.exit(1);
  }
}

// 如果直接運行此腳本
if (require.main === module) {
  manageSync();
}

module.exports = manageSync;
