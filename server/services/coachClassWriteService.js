const CoachClass = require('../models/CoachClass');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Court = require('../models/Court');
const Store = require('../models/Store');
const Activity = require('../models/Activity');
const AccountingTransaction = require('../models/AccountingTransaction');
const { createAdminBypassBooking } = require('./adminBypassBooking');
const {
  sessionHours,
  coachClassLocationLabel,
  sessionStartEnd,
} = require('./coachScheduleService');
const {
  normalizeBookingDateInput,
  resolveHKYmd,
} = require('../utils/bookingDateTime');

function uniqueIds(list) {
  return [...new Set((list || []).map((id) => String(id)).filter(Boolean))];
}

async function cancelBookings(bookingIds) {
  const ids = uniqueIds(bookingIds);
  if (!ids.length) return;
  await Booking.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  );
}

/**
 * 從 body 解析「連結既有預約」ID；有值則驗證存在並回傳，否則 null（走一般 hold 流程）
 */
async function resolveLinkedBookingIds(body) {
  const ids = uniqueIds(
    body.bookings || body.bookingIds || (body.booking ? [body.booking] : [])
  );
  if (!ids.length) return null;

  const found = await Booking.find({ _id: { $in: ids } }).select('_id status');
  if (found.length !== ids.length) {
    const err = new Error('連結的預約不存在');
    err.status = 400;
    throw err;
  }
  const cancelled = found.filter((b) => b.status === 'cancelled');
  if (cancelled.length) {
    const err = new Error('不可連結已取消的預約');
    err.status = 400;
    throw err;
  }
  return ids;
}

/** 是否應取消／重建 hold 預約（連結既有預約的課堂則否） */
function shouldManageHoldBookings(coachClassOrFlag) {
  if (coachClassOrFlag == null) return true;
  if (typeof coachClassOrFlag === 'boolean') return !coachClassOrFlag;
  return !coachClassOrFlag.linkExistingBookings;
}

/**
 * 驗證並組裝教練課堂欄位（建立／更新共用）
 */
async function buildCoachClassPayload(body, { existing = null } = {}) {
  const storeId = body.store || body.storeId;
  if (!storeId) {
    const err = new Error('請選擇店鋪');
    err.status = 400;
    throw err;
  }
  const storeDoc = await Store.findById(storeId).select('name slug');
  if (!storeDoc) {
    const err = new Error('店鋪不存在');
    err.status = 400;
    throw err;
  }

  let coachIds = uniqueIds(body.coachIds || body.coaches);
  if (!coachIds.length && body.coach) coachIds = [String(body.coach)];
  if (!coachIds.length) {
    const err = new Error('請至少選擇一位教練');
    err.status = 400;
    throw err;
  }

  const coachUsers = await User.find({ _id: { $in: coachIds }, role: 'coach' }).select(
    'name phone email coachHourlyRate coachPaymentInfo isActive'
  );
  if (coachUsers.length !== coachIds.length) {
    const err = new Error('請選擇有效的教練帳戶');
    err.status = 400;
    throw err;
  }
  for (const c of coachUsers) {
    if (!String(c.phone || '').trim()) {
      const err = new Error(`教練「${c.name}」尚未設定電話，請先補上以便 WhatsApp 通知`);
      err.status = 400;
      throw err;
    }
  }

  const locationType = body.locationType === 'custom' ? 'custom' : 'court';
  const customLocation = String(body.customLocation || '').trim();
  let courtIds = uniqueIds(body.courtIds || body.courts);
  if (!courtIds.length && body.court) courtIds = [String(body.court)];

  let courtDocs = [];
  if (locationType === 'court') {
    if (!courtIds.length) {
      const err = new Error('請至少選擇一個場地');
      err.status = 400;
      throw err;
    }
    courtDocs = await Court.find({ _id: { $in: courtIds } }).select('name number store isActive');
    if (courtDocs.length !== courtIds.length) {
      const err = new Error('部分場地不存在');
      err.status = 400;
      throw err;
    }
    for (const c of courtDocs) {
      if (String(c.store) !== String(storeId)) {
        const err = new Error(`場地「${c.name}」不屬於所選店鋪，多場必須同一店`);
        err.status = 400;
        throw err;
      }
    }
  } else if (!customLocation) {
    const err = new Error('請填寫地點');
    err.status = 400;
    throw err;
  }

  // 與預約一致：存 YYYY-MM-DD 的 UTC 午夜；牆鐘時間另用 startTime/endTime（香港）
  const ymd = resolveHKYmd(body.sessionDate);
  const dateObj = normalizeBookingDateInput(ymd);
  if (Number.isNaN(dateObj.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const err = new Error('日期無效');
    err.status = 400;
    throw err;
  }

  const startTime = body.startTime;
  const endTime = body.endTime;
  const hours = sessionHours(startTime, endTime);
  if (hours <= 0) {
    const err = new Error('結束時間必須晚於開始時間');
    err.status = 400;
    throw err;
  }

  const paymentInput = Array.isArray(body.coachPayments) ? body.coachPayments : [];
  const paymentMap = new Map(
    paymentInput.map((p) => [String(p.coach || p.coachId), p])
  );

  const coachPayments = coachUsers.map((u) => {
    const id = String(u._id);
    const input = paymentMap.get(id) || {};
    const hourlyRate =
      input.hourlyRate != null
        ? Math.max(0, Number(input.hourlyRate) || 0)
        : Math.max(0, Number(u.coachHourlyRate) || 0);
    const defaultAmount = Math.round(hourlyRate * hours * 100) / 100;
    const amount =
      input.amount != null ? Math.max(0, Number(input.amount) || 0) : defaultAmount;
    return { coach: u._id, hourlyRate, amount };
  });

  let activityId = body.activity || body.activityId || null;
  if (activityId === '' || activityId === 'null') activityId = null;
  let regularActivityId = body.regularActivity || body.regularActivityId || null;
  if (regularActivityId === '' || regularActivityId === 'null') regularActivityId = null;

  if (activityId) {
    const act = await Activity.findById(activityId).select('_id store');
    if (!act) {
      const err = new Error('連結的活動不存在');
      err.status = 400;
      throw err;
    }
  }

  return {
    storeId,
    storeDoc,
    coachIds,
    coachUsers,
    locationType,
    customLocation,
    courtIds: locationType === 'court' ? courtIds : [],
    courtDocs,
    dateObj,
    startTime,
    endTime,
    hours,
    coachPayments,
    title: String(body.title || '').trim() || '教練課堂',
    notes: String(body.notes || '').trim(),
    activityId,
    regularActivityId,
    existing,
  };
}

/** 連結恆常班時不主動 hold 場地；一般店內場地課堂仍 hold */
function shouldHoldCourtsForCoachClass(payload) {
  if (payload.locationType !== 'court') return false;
  if (payload.regularActivityId) return false;
  return true;
}

async function createHoldBookings({ coachIds, courtIds, dateObj, startTime, endTime, title, notes }) {
  const bookingIds = [];
  const primaryCoach = coachIds[0];
  for (const courtId of courtIds) {
    const booking = await createAdminBypassBooking({
      userId: primaryCoach,
      courtId,
      dateInput: dateObj,
      startTime,
      endTime,
      specialRequests: `教練課堂${title && title !== '教練課堂' ? ` - ${title}` : ''}${notes ? `｜${notes}` : ''}`,
    });
    bookingIds.push(booking._id);
  }
  return bookingIds;
}

/** 將課堂教練同步到活動中心（同 logic） */
async function syncLinkedActivity(coachClass) {
  if (!coachClass.activity) return;
  const { start, end } = sessionStartEnd(
    coachClass.sessionDate,
    coachClass.startTime,
    coachClass.endTime
  );

  let location = '';
  if (coachClass.locationType === 'custom') {
    location = coachClass.customLocation || '';
  } else {
    const full = await CoachClass.findById(coachClass._id)
      .populate({
        path: 'courts',
        select: 'name number store',
        populate: { path: 'store', select: 'name' },
      })
      .populate({
        path: 'court',
        select: 'name number store',
        populate: { path: 'store', select: 'name' },
      })
      .lean();
    location = coachClassLocationLabel(full || coachClass);
  }

  const update = {
    coaches: coachClass.coaches,
    store: coachClass.store,
    startDate: start,
    endDate: end,
  };
  if (location) update.location = location;
  await Activity.findByIdAndUpdate(coachClass.activity, { $set: update });
}

function totalPay(coachPayments) {
  return (coachPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

async function markClassPaid(coachClass, adminUserId) {
  if (coachClass.status === 'cancelled') {
    const err = new Error('已取消課堂不可標記付款');
    err.status = 400;
    throw err;
  }
  if (coachClass.paymentStatus === 'paid' && coachClass.accountingTransaction) {
    const err = new Error('此課堂已標記為已付款');
    err.status = 400;
    throw err;
  }

  const amount = totalPay(coachClass.coachPayments);
  const populated = await CoachClass.findById(coachClass._id)
    .populate('coaches', 'name')
    .populate('store', 'name');
  const coachLines = (populated.coachPayments || []).map((p) => {
    const name =
      (populated.coaches || []).find((c) => String(c._id) === String(p.coach))?.name || '教練';
    return `${name} $${Number(p.amount) || 0}`;
  });

  const note = [
    `教練課堂薪資：${populated.title || '教練課堂'}`,
    `${formatSessionNote(populated)}`,
    coachLines.join('；'),
  ]
    .filter(Boolean)
    .join('｜');

  const tx = await AccountingTransaction.create({
    store: coachClass.store,
    type: 'expense',
    amount: Math.max(0, amount),
    date: coachClass.sessionDate || new Date(),
    category: '薪資',
    note,
    createdBy: adminUserId,
  });

  coachClass.paymentStatus = 'paid';
  coachClass.paidAt = new Date();
  coachClass.paidBy = adminUserId;
  coachClass.accountingTransaction = tx._id;
  await coachClass.save();

  return { coachClass, accountingTransaction: tx };
}

function formatSessionNote(cc) {
  const d = cc.sessionDate
    ? new Date(cc.sessionDate).toLocaleDateString('zh-HK', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '';
  return `${d} ${cc.startTime || ''}–${cc.endTime || ''}`.trim();
}

module.exports = {
  uniqueIds,
  cancelBookings,
  resolveLinkedBookingIds,
  shouldManageHoldBookings,
  buildCoachClassPayload,
  shouldHoldCourtsForCoachClass,
  createHoldBookings,
  syncLinkedActivity,
  totalPay,
  markClassPaid,
  sessionHours,
};
