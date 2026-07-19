const cron = require('node-cron');
const overnightDutyNotifyService = require('../services/overnightDutyNotifyService');

const TZ = process.env.VIP_MEMBERSHIP_CRON_TZ || 'Asia/Hong_Kong';

class OvernightDutyScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  start() {
    if (this.task) return;
    // 每分鐘檢查：晚間匯總（notifyPeriodFrom）＋紅日 08:00
    this.task = cron.schedule(
      '* * * * *',
      async () => {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
          const results = await overnightDutyNotifyService.tickSchedulers();
          if (results.length) {
            console.log('📨 夜間值班排程已執行:', results.map((r) => `${r.type}:${r.storeId}`).join(', '));
          }
        } catch (error) {
          console.error('❌ 夜間值班排程失敗:', error);
        } finally {
          this.isRunning = false;
        }
      },
      { timezone: TZ }
    );
    console.log(`⏰ 夜間值班 OpenWA 排程已啟動（每分鐘 · ${TZ}）`);
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}

module.exports = new OvernightDutyScheduler();
