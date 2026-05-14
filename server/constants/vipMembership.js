/** 新註冊／自動續期 VIP 週期（日） */
const VIP_PERIOD_DAYS = 180;
const VIP_PERIOD_MS = VIP_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/** 每日會員任務時區（與 node-cron 一致） */
const VIP_MEMBERSHIP_CRON_TZ = process.env.VIP_MEMBERSHIP_CRON_TZ || 'Asia/Hong_Kong';

module.exports = {
  VIP_PERIOD_DAYS,
  VIP_PERIOD_MS,
  VIP_MEMBERSHIP_CRON_TZ
};
