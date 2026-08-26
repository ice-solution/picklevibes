const CoachClass = require('../models/CoachClass');
const openWaService = require('./openWaService');
const { coachClassLocationLabel, sessionStartEnd, HK_TZ } = require('./coachScheduleService');
const {
  getHKCalendarYMD,
  addDaysToYmd,
  hkYmdToBookingUtcMidnight,
} = require('../utils/bookingDateTime');

/** 教練課堂提醒一律香港時間（勿用 server UTC / 本地 TZ） */
const TZ = HK_TZ;

/** 前一日提醒：每則 OpenWA 之間隨機間隔（毫秒），降低連發被鎖風險 */
const REMINDER_GAP_MIN_MS = Math.max(
  5000,
  parseInt(process.env.COACH_CLASS_REMINDER_GAP_MIN_MS || '20000', 10) || 20000
);
const REMINDER_GAP_MAX_MS = Math.max(
  REMINDER_GAP_MIN_MS,
  parseInt(process.env.COACH_CLASS_REMINDER_GAP_MAX_MS || '60000', 10) || 60000
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomGapMs(minMs = REMINDER_GAP_MIN_MS, maxMs = REMINDER_GAP_MAX_MS) {
  const min = Math.max(0, Number(minMs) || 0);
  const max = Math.max(min, Number(maxMs) || min);
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hkDateString(date = new Date()) {
  return getHKCalendarYMD(date);
}

function addDaysToHkDateString(dateStr, days) {
  return addDaysToYmd(dateStr, days);
}

function formatDateLabel(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString('zh-HK', {
    timeZone: TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function buildClassMessage({ greeting, title, dateLabel, timeRange, location, notes }) {
  const lines = [
    greeting,
    '',
    `課堂：${title || '教練課堂'}`,
    `日期：${dateLabel}`,
    `時間：${timeRange}`,
    `地點：${location || '—'}`,
  ];
  if (notes) lines.push(`備註：${notes}`);
  return lines.join('\n');
}

/**
 * 前一日提醒：三套風格隨機（正式／簡潔／跳皮），避開固定模板連發
 */
function buildDayBeforeReminderMessage({
  coachName,
  title,
  dateLabel,
  timeRange,
  location,
  notes,
}) {
  const name = coachName || '教練';
  const loc = location || '—';
  const classTitle = title || '教練課堂';

  const templates = [
    // 正式
    () =>
      buildClassMessage({
        greeting: `你好${name}，這是你明天的課堂：`,
        title: classTitle,
        dateLabel,
        timeRange,
        location: loc,
        notes,
      }),
    // 簡潔
    () => {
      const lines = [
        `hello～ ${name}`,
        `明天 ${timeRange}`,
        loc,
      ];
      if (classTitle && classTitle !== '教練課堂') lines.splice(1, 0, classTitle);
      if (notes) lines.push(notes);
      return lines.join('\n');
    },
    // 跳皮
    () => {
      const lines = [
        `yoo~ ${name}，明日有課記得嚟呀～`,
        `${dateLabel} ${timeRange}`,
        `📍 ${loc}`,
      ];
      if (classTitle && classTitle !== '教練課堂') lines.splice(1, 0, `課堂：${classTitle}`);
      if (notes) lines.push(`備註：${notes}`);
      return lines.join('\n');
    },
  ];

  const pick = templates[Math.floor(Math.random() * templates.length)];
  return pick();
}

function resolveCoachUsers(populated) {
  if (Array.isArray(populated?.coaches) && populated.coaches.length) {
    return populated.coaches.filter(Boolean);
  }
  if (populated?.coach) return [populated.coach];
  return [];
}

async function loadPopulatedForNotify(coachClassDoc) {
  if (coachClassDoc?.coaches?.[0]?.phone != null || coachClassDoc?.coach?.phone != null) {
    return coachClassDoc;
  }
  return CoachClass.findById(coachClassDoc._id)
    .populate('coaches', 'name phone isActive')
    .populate('coach', 'name phone isActive')
    .populate({
      path: 'courts',
      select: 'name number store',
      populate: { path: 'store', select: 'name' },
    })
    .populate({
      path: 'court',
      select: 'name number store',
      populate: { path: 'store', select: 'name' },
    });
}

/**
 * 課堂指派後即時 OpenWA 通知所有教練
 * （多教練時同樣加隨機間隔，避免一次連發）
 */
async function notifyCoachClassAssigned(coachClassDoc) {
  const populated = await loadPopulatedForNotify(coachClassDoc);
  if (!openWaService.isOpenWaConfigured()) {
    return { success: false, skipped: true, reason: 'openwa_not_configured', sent: 0 };
  }

  const coaches = resolveCoachUsers(populated);
  if (!coaches.length) {
    return { success: false, skipped: true, reason: 'no_coach', sent: 0 };
  }

  let sent = 0;
  const errors = [];
  let isFirstOutbound = true;

  for (const coach of coaches) {
    const phone = coach.phone;
    if (!phone || coach.isActive === false) continue;
    try {
      if (!isFirstOutbound) {
        await sleep(randomGapMs());
      }
      isFirstOutbound = false;

      const text = buildClassMessage({
        greeting: `${coach.name || '教練'}，您好：管理員已為您安排課堂。`,
        title: populated.title,
        dateLabel: formatDateLabel(populated.sessionDate),
        timeRange: `${populated.startTime} – ${populated.endTime}`,
        location: coachClassLocationLabel(populated),
        notes: populated.notes,
      });
      await openWaService.sendTextMessage(phone, text);
      sent += 1;
    } catch (err) {
      errors.push({ coachId: String(coach._id), error: err.message });
    }
  }

  return {
    success: sent > 0,
    sent,
    skipped: sent === 0,
    reason: sent === 0 ? 'no_phone' : undefined,
    errors,
  };
}

/**
 * 每日：通知「明日」（香港日曆）有課且尚未提醒的課堂（每位教練）
 * - Cron 以 Asia/Hong_Kong 觸發；「今日／明日」亦用香港日曆，唔跟 server UTC
 * - 隨機 3 套文案模板
 * - 每則實際送出後，下一則前隨機等 20–60 秒（可用 env 調）
 */
async function sendDayBeforeReminders(now = new Date()) {
  if (!openWaService.isOpenWaConfigured()) {
    return { sent: 0, skipped: 0, reason: 'openwa_not_configured' };
  }

  const todayStr = hkDateString(now);
  const tomorrowStr = addDaysToHkDateString(todayStr, 1);
  // 與預約／課堂存檔一致：YYYY-MM-DD → UTC 午夜；同時包容舊資料落在該香港日內的任何 instant
  const dayKey = hkYmdToBookingUtcMidnight(tomorrowStr);
  const dayStart = new Date(`${tomorrowStr}T00:00:00+08:00`);
  const dayEnd = new Date(`${tomorrowStr}T23:59:59.999+08:00`);

  const classes = await CoachClass.find({
    status: 'scheduled',
    reminderSentAt: null,
    $or: [
      { sessionDate: dayKey },
      { sessionDate: { $gte: dayStart, $lte: dayEnd } },
    ],
  })
    .populate('coaches', 'name phone isActive')
    .populate('coach', 'name phone isActive')
    .populate({
      path: 'courts',
      select: 'name number store',
      populate: { path: 'store', select: 'name' },
    })
    .populate({
      path: 'court',
      select: 'name number store',
      populate: { path: 'store', select: 'name' },
    });

  let sent = 0;
  let skipped = 0;
  const errors = [];
  let isFirstOutbound = true;

  for (const cc of classes) {
    const coaches = resolveCoachUsers(cc);
    let classSent = 0;
    let classAttempted = 0;

    for (const coach of coaches) {
      const phone = coach?.phone;
      if (!phone || coach?.isActive === false) {
        skipped += 1;
        continue;
      }
      classAttempted += 1;
      try {
        if (!isFirstOutbound) {
          const gap = randomGapMs();
          console.log(`⏳ 教練課堂提醒間隔 ${Math.round(gap / 1000)}s 後發送…`);
          await sleep(gap);
        }
        isFirstOutbound = false;

        const text = buildDayBeforeReminderMessage({
          coachName: coach.name,
          title: cc.title,
          dateLabel: formatDateLabel(cc.sessionDate),
          timeRange: `${cc.startTime} – ${cc.endTime}`,
          location: coachClassLocationLabel(cc),
          notes: cc.notes,
        });
        await openWaService.sendTextMessage(phone, text);
        sent += 1;
        classSent += 1;
      } catch (err) {
        errors.push({ id: String(cc._id), coachId: String(coach._id), error: err.message });
      }
    }

    // 至少成功一則、或沒有可發送對象時標記，避免無限重試；全部失敗則留 null 下次 cron 再試
    if (classSent > 0 || (coaches.length > 0 && classAttempted === 0)) {
      cc.reminderSentAt = new Date();
      await cc.save();
    }
  }

  return {
    sent,
    skipped,
    errors,
    timezone: TZ,
    todayHk: todayStr,
    tomorrowHk: tomorrowStr,
    gapMs: { min: REMINDER_GAP_MIN_MS, max: REMINDER_GAP_MAX_MS },
  };
}

module.exports = {
  notifyCoachClassAssigned,
  sendDayBeforeReminders,
  formatDateLabel,
  sessionStartEnd,
  buildDayBeforeReminderMessage,
  REMINDER_GAP_MIN_MS,
  REMINDER_GAP_MAX_MS,
};
