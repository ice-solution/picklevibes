const Store = require('../models/Store');
const Court = require('../models/Court');
const Booking = require('../models/Booking');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function getPublicWebBase() {
  const base = process.env.PUBLIC_WEB_URL || process.env.CLIENT_URL || 'https://picklevibes.hk';
  return base.replace(/\/$/, '');
}

function isValidBookingDateYmd(date) {
  if (!date || !DATE_RE.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

function buildBookingUrls(storeSlug, courtSlug, date) {
  const base = getPublicWebBase();
  let path = `/booking/${storeSlug}`;
  if (courtSlug) path += `/${courtSlug}`;
  if (date) path += `/${date}`;
  const full = `${base}${path}`;
  const deep =
    courtSlug && date ? `${base}/${storeSlug}/${courtSlug}/${date}` : null;
  return { booking: full, deepLink: deep };
}

function serializeStore(store) {
  if (!store) return null;
  return {
    id: String(store._id),
    name: store.name,
    slug: store.slug,
    address: store.address,
    phone: store.phone || '',
    primaryColor: store.primaryColor || null,
    logoUrl: store.logoUrl || null,
  };
}

function serializeCourt(court) {
  if (!court) return null;
  return {
    id: String(court._id),
    name: court.name,
    slug: court.slug,
    number: court.number,
    type: court.type,
    capacity: court.capacity,
    description: court.description || '',
    isActive: court.isActive,
    storeId: court.store ? String(court.store._id || court.store) : null,
  };
}

function slotHoursForCourtType(type) {
  if (type === 'solo') return { startHour: 8, endHour: 23 };
  return { startHour: 0, endHour: 24 };
}

async function computeDaySlots(court, dateYmd, durationMinutes = 60) {
  const { startHour, endHour } = slotHoursForCourtType(court.type);
  const bookingDate = new Date(`${dateYmd}T12:00:00+08:00`);
  const durationH = Math.floor(durationMinutes / 60);
  const slots = [];

  if (!court.isAvailable()) {
    return { durationMinutes, slots: [], unavailableReason: '場地維護或停用' };
  }

  for (let hour = startHour; hour < endHour; hour += 1) {
    const startTime = `${String(hour).padStart(2, '0')}:00`;
    const endH = hour + durationH;
    if (endH > endHour) continue;
    const endTime = `${String(endH).padStart(2, '0')}:00`;

    if (!court.isOpenAt(bookingDate, startTime, endTime)) {
      slots.push({
        start: startTime,
        end: endTime,
        available: false,
        reason: '非營業時段',
      });
      continue;
    }

    const hasConflict = await Booking.checkTimeConflict(
      court._id,
      dateYmd,
      startTime,
      endTime
    );

    if (hasConflict) {
      slots.push({
        start: startTime,
        end: endTime,
        available: false,
        reason: '已預約',
      });
      continue;
    }

    const basePrice = court.getPriceForTime(startTime, bookingDate);
    const totalPrice = Math.round((basePrice * durationMinutes) / 60);
    slots.push({
      start: startTime,
      end: endTime,
      available: true,
      price: totalPrice,
      slotName: court.getTimeSlotName(startTime, bookingDate),
    });
  }

  return { durationMinutes, slots };
}

/**
 * 解析 /booking/:storeSlug/:courtSlug?/:date?
 */
async function resolveBookingDeepLink({
  storeSlug,
  courtSlug,
  date,
  includeSlots = false,
  durationMinutes = 60,
}) {
  const normalizedStoreSlug = String(storeSlug || '').trim().toLowerCase();
  if (!normalizedStoreSlug) {
    const err = new Error('storeSlug 為必填');
    err.status = 400;
    throw err;
  }

  const store = await Store.findOne({ slug: normalizedStoreSlug, isActive: true }).lean();
  if (!store) {
    const err = new Error('店鋪不存在或已下線');
    err.status = 404;
    throw err;
  }

  const result = {
    store: serializeStore(store),
    court: null,
    date: null,
    urls: buildBookingUrls(store.slug, null, null),
    courts: null,
    timeSlots: null,
  };

  if (!courtSlug) {
    const courts = await Court.find({ store: store._id, isActive: true, type: { $ne: 'full_venue' } })
      .sort({ number: 1 })
      .select('name slug number type capacity description isActive store')
      .lean();
    result.courts = courts.map(serializeCourt);
    return result;
  }

  const normalizedCourtSlug = String(courtSlug).trim().toLowerCase();
  const court = await Court.findOne({
    store: store._id,
    slug: normalizedCourtSlug,
    isActive: true,
  }).lean();

  if (!court) {
    const err = new Error('場地不存在或已下線');
    err.status = 404;
    throw err;
  }

  result.court = serializeCourt(court);
  result.urls = buildBookingUrls(store.slug, court.slug, null);

  if (!date) {
    return result;
  }

  if (!isValidBookingDateYmd(date)) {
    const err = new Error('date 須為 YYYY-MM-DD');
    err.status = 400;
    throw err;
  }

  result.date = date;
  result.urls = buildBookingUrls(store.slug, court.slug, date);

  if (includeSlots) {
    const courtDoc = await Court.findById(court._id);
    result.timeSlots = await computeDaySlots(courtDoc, date, durationMinutes);
  }

  return result;
}

async function listBookableStores() {
  const stores = await Store.find({ isActive: true })
    .sort({ sortOrder: 1, name: 1 })
    .select('name slug address phone primaryColor logoUrl')
    .lean();
  return stores.map(serializeStore);
}

module.exports = {
  isValidBookingDateYmd,
  buildBookingUrls,
  resolveBookingDeepLink,
  listBookableStores,
  getPublicWebBase,
};
