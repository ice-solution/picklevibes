const Activity = require('../models/Activity');
const ActivityRegistration = require('../models/ActivityRegistration');
const CoachClass = require('../models/CoachClass');
const CoachScheduleRequest = require('../models/CoachScheduleRequest');

function sessionStartEnd(sessionDate, startTime, endTime) {
  const base = new Date(sessionDate);
  const [sh, sm] = startTime.split(':').map(Number);
  const start = new Date(base);
  start.setHours(sh, sm, 0, 0);

  let end;
  if (endTime === '24:00') {
    end = new Date(base);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
  } else {
    const [eh, em] = endTime.split(':').map(Number);
    end = new Date(base);
    end.setHours(eh, em, 0, 0);
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
  }
  return { start, end };
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

function coachClassLocationLabel(coachClass) {
  if (coachClass.locationType === 'custom' && coachClass.customLocation) {
    return coachClass.customLocation;
  }
  return courtLocationLabel(coachClass.court);
}

/**
 * 合併教練課表：活動指派、管理員建立的教練課堂、已批核學校要請
 */
async function getCoachCalendarEvents(coachId, rangeStart, rangeEnd) {
  const events = [];

  const activityQuery = {
    isActive: true,
    coaches: coachId,
  };
  if (rangeStart && rangeEnd) {
    activityQuery.startDate = { $lt: rangeEnd };
    activityQuery.endDate = { $gt: rangeStart };
  }

  const activities = await Activity.find(activityQuery)
    .select('title startDate endDate location status poster')
    .sort({ startDate: 1 })
    .lean();

  for (const a of activities) {
    const start = new Date(a.startDate);
    const end = new Date(a.endDate);
    if (rangeStart && rangeEnd && !overlapsRange(start, end, rangeStart, rangeEnd)) continue;
    events.push({
      id: `activity-${a._id}`,
      sourceId: String(a._id),
      type: 'activity',
      title: a.title,
      start: start.toISOString(),
      end: end.toISOString(),
      location: a.location || '',
      status: a.status,
      poster: a.poster || null,
    });
  }

  const classQuery = {
    coach: coachId,
    status: 'scheduled',
  };
  if (rangeStart && rangeEnd) {
    classQuery.sessionDate = {
      $gte: new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()),
      $lt: rangeEnd,
    };
  }

  const coachClasses = await CoachClass.find(classQuery)
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .sort({ sessionDate: 1, startTime: 1 })
    .lean();

  for (const cc of coachClasses) {
    const { start, end } = sessionStartEnd(cc.sessionDate, cc.startTime, cc.endTime);
    if (rangeStart && rangeEnd && !overlapsRange(start, end, rangeStart, rangeEnd)) continue;
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
      court: cc.court
        ? { id: String(cc.court._id), name: cc.court.name, number: cc.court.number }
        : null,
    });
  }

  const requestQuery = {
    coach: coachId,
    status: 'approved',
  };

  const approvedRequests = await CoachScheduleRequest.find(requestQuery)
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .sort({ requestDate: 1, startTime: 1 })
    .lean();

  for (const req of approvedRequests) {
    const { start, end } = sessionStartEnd(req.requestDate, req.startTime, req.endTime);
    if (rangeStart && rangeEnd && !overlapsRange(start, end, rangeStart, rangeEnd)) continue;
    events.push({
      id: `request-${req._id}`,
      sourceId: String(req._id),
      type: 'schedule_request',
      title: '學校要請（已批核）',
      start: start.toISOString(),
      end: end.toISOString(),
      location: courtLocationLabel(req.court),
      status: 'approved',
      notes: req.message || '',
      court: req.court
        ? { id: String(req.court._id), name: req.court.name, number: req.court.number }
        : null,
    });
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events;
}

/**
 * 教練「我的課程」列表用：活動 + 教練課堂 + 已批核要請
 */
async function getCoachAssignments(coachId) {
  const activities = await Activity.find({ coaches: coachId })
    .populate('coaches', 'name email')
    .sort({ startDate: 1 })
    .lean();

  const activityItems = await Promise.all(
    activities.map(async (a) => {
      const totalRegistered = await ActivityRegistration.countDocuments({ activity: a._id });
      return {
        kind: 'activity',
        id: String(a._id),
        title: a.title,
        start: a.startDate,
        end: a.endDate,
        location: a.location || '',
        status: a.status,
        poster: a.poster || null,
        raw: {
          ...a,
          totalRegistered,
          availableSpots: (a.maxParticipants || 0) - totalRegistered,
        },
      };
    })
  );

  const coachClasses = await CoachClass.find({ coach: coachId, status: 'scheduled' })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .sort({ sessionDate: 1, startTime: 1 })
    .lean();

  const classItems = coachClasses.map((cc) => {
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
      raw: cc,
    };
  });

  const approvedRequests = await CoachScheduleRequest.find({
    coach: coachId,
    status: 'approved',
  })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name' },
    })
    .sort({ requestDate: 1, startTime: 1 })
    .lean();

  const requestItems = approvedRequests.map((req) => {
    const { start, end } = sessionStartEnd(req.requestDate, req.startTime, req.endTime);
    return {
      kind: 'schedule_request',
      id: String(req._id),
      title: '學校要請（已批核）',
      start: start.toISOString(),
      end: end.toISOString(),
      location: courtLocationLabel(req.court),
      status: 'approved',
      notes: req.message || '',
      raw: req,
    };
  });

  const all = [...activityItems, ...classItems, ...requestItems];
  all.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return all;
}

module.exports = {
  sessionStartEnd,
  getCoachCalendarEvents,
  getCoachAssignments,
  coachClassLocationLabel,
};
