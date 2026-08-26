const cron = require('node-cron');
const coachClassNotifyService = require('../services/coachClassNotifyService');

/** 固定香港時區：cron「18:00」= 香港 18:00，唔跟 server UTC */
const HK_TZ = 'Asia/Hong_Kong';
/** 預設每日香港 18:00 通知「明日（香港日曆）」課堂；可用 COACH_CLASS_REMINDER_CRON 覆寫 */
const CRON_EXPR = process.env.COACH_CLASS_REMINDER_CRON || '0 18 * * *';

class CoachClassReminderScheduler {
  constructor() {
    this.task = null;
    this.isRunning = false;
  }

  start() {
    if (this.task) return;
    this.task = cron.schedule(
      CRON_EXPR,
      async () => {
        if (this.isRunning) return;
        this.isRunning = true;
        try {
          const result = await coachClassNotifyService.sendDayBeforeReminders();
          console.log('📨 教練課堂前一日提醒（香港時間）:', result);
        } catch (error) {
          console.error('❌ 教練課堂前一日提醒失敗:', error);
        } finally {
          this.isRunning = false;
        }
      },
      { timezone: HK_TZ }
    );
    console.log(
      `⏰ 教練課堂 OpenWA 前一日提醒已啟動（cron=${CRON_EXPR} · timezone=${HK_TZ}；「明日」=香港日曆）`
    );
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }
}

module.exports = new CoachClassReminderScheduler();
