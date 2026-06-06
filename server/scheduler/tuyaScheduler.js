const cron = require('node-cron');
const tuyaSchedulerService = require('../services/tuyaSchedulerService');
const { logTuya } = require('../utils/tuyaActionLog');

const TZ = 'Asia/Hong_Kong';

class TuyaScheduler {
  constructor() {
    this.isRunning = false;
    this.task = null;
    this.isSyncing = false;
  }

  async runSync(reason = 'cron') {
    if (this.isSyncing) {
      logTuya('info', '⏳ Tuya 燈控同步進行中，略過此次', { reason, action: 'skipped_busy' });
      return;
    }
    this.isSyncing = true;
    logTuya('info', `🔄 Tuya 燈控開始同步 (${reason})`, { reason, action: 'sync_start' });
    try {
      const result = await tuyaSchedulerService.syncAllCourts({ reason });
      logTuya('info', `✅ Tuya 燈控同步完成 (${reason}) · ${result.synced} 場地 · ${result.changed} 場有變更`, {
        reason,
        action: 'sync_done',
        synced: result.synced,
        changedCourts: result.changed,
      });
    } catch (error) {
      logTuya('error', `❌ Tuya 燈控定時同步失敗 (${reason})`, {
        reason,
        action: 'sync_error',
        error: error.message,
      });
    } finally {
      this.isSyncing = false;
    }
  }

  start() {
    if (this.isRunning) {
      console.log('💡 Tuya 燈控排程已在運行');
      return;
    }

    logTuya('info', '🚀 啟動 Tuya 燈控自動排程 (Phase 2)', { action: 'scheduler_start' });

    // 每 2 分鐘掃描預約並開關燈
    this.task = cron.schedule(
      '*/2 * * * *',
      () => this.runSync('cron'),
      { scheduled: true, timezone: TZ }
    );

    this.isRunning = true;
    logTuya('info', '✅ Tuya 燈控排程已啟動（每 2 分鐘 · Asia/Hong_Kong）', { action: 'scheduler_ready' });

    // 服務啟動後延遲執行一次
    setTimeout(() => this.runSync('startup'), 15000);
  }

  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.isRunning = false;
    console.log('⏹️ Tuya 燈控排程已停止');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isSyncing: this.isSyncing,
      schedule: '每 2 分鐘',
      timezone: TZ,
      courtStates: tuyaSchedulerService.getCourtStateCache(),
      recentLogs: tuyaSchedulerService.getTuyaActionLog({ limit: 50 }),
    };
  }
}

module.exports = new TuyaScheduler();
