/**
 * Google Calendar 定時同步（已停用）
 * 保留檔案以免舊部署／腳本引用報錯；start() 不會再註冊任何 cron。
 */
class CalendarScheduler {
  constructor() {
    this.isRunning = false;
  }

  start() {
    console.log('📅 Google Calendar 同步已停用，跳過定時任務啟動');
    this.isRunning = false;
  }

  stop() {
    this.isRunning = false;
    console.log('📅 Google Calendar 定時任務未在運行（功能已停用）');
  }

  getStatus() {
    return {
      isRunning: false,
      disabled: true,
      tasks: [],
    };
  }
}

module.exports = new CalendarScheduler();
