/**
 * Google Calendar 智能定時同步（已停用）
 * 伺服器啟動時不再呼叫；即使手動 require 亦不會註冊 cron。
 */
class ScheduledSync {
  constructor() {
    this.isRunning = false;
  }

  async initialize() {
    console.log('📅 Google Calendar 智能同步已停用，跳過定時任務初始化');
  }

  async stop() {
    this.isRunning = false;
    console.log('📅 Google Calendar 智能同步已停用');
  }
}

module.exports = ScheduledSync;
