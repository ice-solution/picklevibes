const CoachClass = require('../models/CoachClass');
const {
  getHKCalendarYMD,
  resolveHKYmd,
  hkYmdToBookingUtcMidnight,
  addDaysToYmd,
  bookingRangeUtcMs,
} = require('../utils/bookingDateTime');

/** 教練課堂一律以香港牆鐘為準，勿用 server 本地 TZ / setHours */
const HK_TZ = 'Asia/Hong_Kong';

/**
 * 課堂開始／結束（絕對時間）＝ sessionDate 的香港日曆日 + start/end 香港牆鐘
 */
function sessionStartEnd(sessionDate, startTime, endTime) {
  const ymd = resolveHKYmd(sessionDate);
  const { startMs, endMs } = bookingRangeUtcMs(ymd, startTime, endTime);
  return { start: new Date(startMs), end: new Date(endMs) };
}

/** 課堂時數（小時）— 只看 HH:mm，與時區無關 */
function sessionHours(startTime, endTime) {
  const toMin = (t) => {
    if (t === '24:00') return 24 * 60;
    const [h, m] = String(t || '').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let mins = toMin(endTime) - toMin(startTime);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function overlapsRange(itemStart, itemEnd, rangeStart, rangeEnd) {
  return itemStart < rangeEnd && itemEnd > rangeStart;
}

function courtLocationLabel(court) {
  if (!court) return '';
  const storeName = court.store?.name;
  const courtName = court.name || `場地 ${court.number || ''}`.trim();
  return storeName ? `${storeName} · ${courtName}` : courtName;
}

function normalizeCoachIds(coachClass) {
  const fromArr = Array.isArray(coachClass.coaches)
    ? coachClass.coaches.map((c) => (c && c._id ? c._id : c)).filter(Boolean)
    : [];
  if (fromArr.length) return fromArr.map(String);
  if (coachClass.coach) {
    const id = coachClass.coach._id || coachClass.coach;
    return id ? [String(id)] : [];
  }
  return [];
}

function normalizeCourtDocs(coachClass) {
  if (Array.isArray(coachClass.courts) && coachClass.courts.length) {
    return coachClass.courts.filter(Boolean);
  }
  if (coachClass.court) return [coachClass.court];
  return [];
}

function coachClassLocationLabel(coachClass) {
  if (coachClass.locationType === 'custom' && coachClass.customLocation) {
    return coachClass.customLocation;
  }
  const courts = normalizeCourtDocs(coachClass);
  if (!courts.length) return '';
  return courts.map((c) => courtLocationLabel(c)).filter(Boolean).join('、');
}

function coachClassQueryForCoach(coachId) {
  return {
    status: 'scheduled',
    $or: [{ coaches: coachId }, { coach: coachId }],
  };
}

/**
 * 教練課表
 */
async function getCoachCalendarEvents(coachId, rangeStart, rangeEnd) {
  const events = [];
  const classQuery = coachClassQueryForCoach(coachId);
  if (rangeStart && rangeEnd) {
    // FullCalendar 傳入的 range 是 Instant；用香港日曆擴一點邊界再篩 overlaps
    const startYmd = getHKCalendarYMD(rangeStart);
    const endInstant = new Date(rangeEnd.getTime() - 1);
    const endYmd = getHKCalendarYMD(endInstant);
    classQuery.sessionDate = {
      $gte: hkYmdToBookingUtcMidnight(addDaysToYmd(startYmd, -1)),
      $lte: hkYmdToBookingUtcMidnight(addDaysToYmd(endYmd, 1)),
    };
  }

  const coachClasses = await CoachClass.find(classQuery)
    .populate({
      path: 'courts',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .populate('store', 'name slug')
    .populate('coaches', 'name')
    .populate('activity', 'title')
    .populate('regularActivity', 'title')
    .sort({ sessionDate: 1, startTime: 1 })
    .lean();

  for (const cc of coachClasses) {
    const { start, end } = sessionStartEnd(cc.sessionDate, cc.startTime, cc.endTime);
    if (rangeStart && rangeEnd && !overlapsRange(start, end, rangeStart, rangeEnd)) continue;
    const courtDocs = normalizeCourtDocs(cc);
    events.push({
      id: `coach-class-${cc._id}`,
      sourceId: String(cc._id),
      type: 'coach_class',
      title: cc.title || '教練課堂',
      start: start.toISOString(),
      end: end.toISOString(),
      location: coachClassLocationLabel(cc),
      status: 'scheduled',
      notes: cc.notes || '',
      storeName: cc.store?.name || '',
      activityTitle: cc.activity?.title || '',
      regularActivityTitle: cc.regularActivity?.title || '',
      coachNames: (cc.coaches || []).map((c) => c.name).filter(Boolean),
      court: courtDocs[0]
        ? {
            id: String(courtDocs[0]._id),
            name: courtDocs[0].name,
            number: courtDocs[0].number,
          }
        : null,
    });
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events;
}

/**
 * 教練「我的課堂」列表
 */
async function getCoachAssignments(coachId) {
  const coachClasses = await CoachClass.find(coachClassQueryForCoach(coachId))
    .populate({
      path: 'courts',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .populate('store', 'name slug')
    .populate('coaches', 'name')
    .populate('activity', 'title')
    .populate('regularActivity', 'title')
    .sort({ sessionDate: 1, startTime: 1 })
    .lean();

  return coachClasses.map((cc) => {
    const { start, end } = sessionStartEnd(cc.sessionDate, cc.startTime, cc.endTime);
    return {
      kind: 'coach_class',
      id: String(cc._id),
      title: cc.title || '教練課堂',
      start: start.toISOString(),
      end: end.toISOString(),
      location: coachClassLocationLabel(cc),
      status: 'scheduled',
      notes: cc.notes || '',
      startTime: cc.startTime,
      endTime: cc.endTime,
      sessionDate: cc.sessionDate,
      storeName: cc.store?.name || '',
      activityTitle: cc.activity?.title || '',
      regularActivityTitle: cc.regularActivity?.title || '',
      coachNames: (cc.coaches || []).map((c) => c.name).filter(Boolean),
      raw: cc,
    };
  });
}

module.exports = {
  HK_TZ,
  sessionStartEnd,
  sessionHours,
  getCoachCalendarEvents,
  getCoachAssignments,
  coachClassLocationLabel,
  normalizeCoachIds,
  normalizeCourtDocs,
};
