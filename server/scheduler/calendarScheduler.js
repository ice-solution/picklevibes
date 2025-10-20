const cron = require('node-cron');
const GoogleCalendarService = require('../services/googleCalendarService');

class CalendarScheduler {
  constructor() {
    this.isRunning = false;
    this.googleCalendarService = new GoogleCalendarService();
  }

  start() {
    if (this.isRunning) {
      console.log('📅 Google Calendar 定時任務已在運行');
      return;
    }

    console.log('🚀 啟動Google Calendar定時任務調度器...');

    // 每小時同步一次（在每小時的0分執行）
    cron.schedule('0 * * * *', async () => {
      console.log('⏰ 執行Google Calendar定時同步...');
      try {
        await this.googleCalendarService.syncAllBookings();
        await this.googleCalendarService.syncBookingChanges();
        console.log('✅ 定時同步完成');
      } catch (error) {
        console.error('❌ 定時同步失敗:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Hong_Kong'
    });

    // 每天凌晨2點進行完整同步
    cron.schedule('0 2 * * *', async () => {
      console.log('🌙 執行Google Calendar每日完整同步...');
      try {
        await this.googleCalendarService.syncAllBookings();
        await this.googleCalendarService.syncBookingChanges();
        console.log('✅ 每日完整同步完成');
      } catch (error) {
        console.error('❌ 每日完整同步失敗:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Hong_Kong'
    });

    // 每5分鐘檢查一次新預約（僅同步新預約）
    cron.schedule('*/5 * * * *', async () => {
      console.log('🔄 檢查新預約並同步到Google Calendar...');
      try {
        await this.googleCalendarService.syncAllBookings();
        console.log('✅ 新預約同步完成');
      } catch (error) {
        console.error('❌ 新預約同步失敗:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Hong_Kong'
    });

    this.isRunning = true;
    console.log('✅ Google Calendar定時任務調度器已啟動');
    console.log('📋 定時任務安排:');
    console.log('  - 每5分鐘: 檢查新預約');
    console.log('  - 每小時: 完整同步');
    console.log('  - 每天凌晨2點: 每日完整同步');
  }

  stop() {
    if (!this.isRunning) {
      console.log('📅 Google Calendar 定時任務未在運行');
      return;
    }

    cron.destroy();
    this.isRunning = false;
    console.log('⏹️ Google Calendar定時任務調度器已停止');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      tasks: [
        { name: '新預約檢查', schedule: '每5分鐘', description: '檢查並同步新預約到Google Calendar' },
        { name: '完整同步', schedule: '每小時', description: '同步所有預約和變更' },
        { name: '每日同步', schedule: '每天凌晨2點', description: '每日完整同步所有預約' }
      ]
    };
  }
}

module.exports = new CalendarScheduler();
