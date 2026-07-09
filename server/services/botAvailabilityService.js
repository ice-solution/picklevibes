const Court = require('../models/Court');
const Booking = require('../models/Booking');
const Store = require('../models/Store');

function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startTotalMin = startHour * 60 + startMin;
  let endTotalMin = endHour * 60 + endMin;

  if (endTotalMin <= startTotalMin) {
    endTotalMin += 24 * 60;
  }

  return endTotalMin - startTotalMin;
}

async function checkCourtSlotAvailability(court, date, startTime, endTime) {
  if (!court.isAvailable()) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '場地正在維護中',
    };
  }

  const bookingDate = new Date(date);
  if (!court.isOpenAt(bookingDate, startTime, endTime)) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '場地在該時間段不開放',
    };
  }

  const hasConflict = await Booking.checkTimeConflict(court._id, date, startTime, endTime);
  if (hasConflict) {
    return {
      courtId: court._id,
      courtName: court.name,
      courtNumber: court.number,
      courtType: court.type,
      available: false,
      reason: '該時間段已被預約',
    };
  }

  const duration = calculateDuration(startTime, endTime);
  const basePrice = court.getPriceForTime(startTime, bookingDate);
  const totalPrice = Math.round(basePrice * (duration / 60));
  const slotName = court.getTimeSlotName(startTime, bookingDate);
  const hour = parseInt(startTime.split(':')[0], 10);
  const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
  const isPeakHour = isWeekend || (hour >= 18 && hour < 23);

  return {
    courtId: court._id,
    courtName: court.name,
    courtNumber: court.number,
    courtType: court.type,
    available: true,
    pricing: {
      basePrice,
      totalPrice,
      duration,
      isPeakHour,
      slotName,
    },
  };
}

/**
 * 查詢指定店鋪、日期、時段內所有場地空缺
 */
async function searchAvailability({ storeId, date, startTime, endTime, courtType }) {
  const store = await Store.findById(storeId).select('name slug isActive');
  if (!store) {
    const err = new Error('店鋪不存在');
    err.code = 'STORE_NOT_FOUND';
    throw err;
  }
  if (store.isActive === false) {
    const err = new Error('店鋪已停用');
    err.code = 'STORE_INACTIVE';
    throw err;
  }

  const query = { store: storeId, isActive: true };
  if (courtType) {
    query.type = courtType;
  }

  const courts = await Court.find(query)
    .populate('store', 'name slug')
    .sort({ number: 1 });

  const results = await Promise.all(
    courts.map((court) => checkCourtSlotAvailability(court, date, startTime, endTime))
  );

  const availableCourts = results.filter((r) => r.available);
  const unavailableCourts = results.filter((r) => !r.available);

  return {
    store: {
      id: store._id,
      name: store.name,
      slug: store.slug,
    },
    date,
    startTime,
    endTime,
    duration: calculateDuration(startTime, endTime),
    summary: {
      total: results.length,
      available: availableCourts.length,
      unavailable: unavailableCourts.length,
    },
    availableCourts,
    unavailableCourts,
  };
}

module.exports = {
  searchAvailability,
  checkCourtSlotAvailability,
  calculateDuration,
};
