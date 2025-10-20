const cron = require('node-cron');
const SmartGoogleCalendarSync = require('../services/smartGoogleCalendarSync');
const mongoose = require('mongoose');
require('dotenv').config();

class ScheduledSync {
  constructor() {
    this.smartSync = new SmartGoogleCalendarSync();
    this.isRunning = false;
  }

  async initialize() {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ 定時同步服務已啟動');
      
      // 每5分鐘同步今天的預約
      cron.schedule('*/5 * * * *', async () => {
        if (this.isRunning) {
          console.log('⏳ 上次同步還在進行中，跳過此次同步');
          return;
        }
        
        this.isRunning = true;
        try {
          console.log('🕐 開始定時同步（今天）...');
          await this.smartSync.smartSync({
            startDate: new Date(new Date().setHours(0, 0, 0, 0)),
            endDate: new Date(new Date().setHours(23, 59, 59, 999))
          });
          console.log('✅ 定時同步完成');
        } catch (error) {
          console.error('❌ 定時同步失敗:', error);
        } finally {
          this.isRunning = false;
        }
      });

      // 每天凌晨2點同步本月的預約
      cron.schedule('0 2 * * *', async () => {
        if (this.isRunning) {
          console.log('⏳ 上次同步還在進行中，跳過此次同步');
          return;
        }
        
        this.isRunning = true;
        try {
          console.log('🕐 開始定時同步（本月）...');
          const today = new Date();
          const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
          const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          
          await this.smartSync.smartSync({
            startDate: firstDay,
            endDate: lastDay
          });
          console.log('✅ 定時同步完成');
        } catch (error) {
          console.error('❌ 定時同步失敗:', error);
        } finally {
          this.isRunning = false;
        }
      });

      console.log('📅 定時任務已設置:');
      console.log('- 每5分鐘: 同步今天的預約');
      console.log('- 每天凌晨2點: 同步本月的預約');

    } catch (error) {
      console.error('❌ 定時同步服務初始化失敗:', error);
    }
  }

  async stop() {
    try {
      await mongoose.disconnect();
      console.log('✅ 定時同步服務已停止');
    } catch (error) {
      console.error('❌ 停止定時同步服務失敗:', error);
    }
  }
}

module.exports = ScheduledSync;
