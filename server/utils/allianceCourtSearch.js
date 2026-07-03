const Store = require('../models/Store');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const {
  isValidBookingDateYmd,
  evaluateBookingDateWindow,
  getMaxAdvanceDaysForRole,
  buildBookingUrls,
} = require('./bookingDeepLink');
const { buildDistrictAddressFilter } = require('./hkDistricts');
const { typeCountsForCourts, effectiveCourtSlug } = require('./courtSlug');

function addMinutesToTime(startTime, minutes) {
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  if (endH > 24 || (endH === 24 && endM > 0)) return null;
  if (endH === 24 && endM === 0) return '24:00';
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 單人／特色場包含 solo 與 dink */
function resolveCourtTypes(courtType) {
  const t = String(courtType || '').trim();
  if (!t) return null;
  if (t === 'solo') return ['solo', 'dink'];
  return [t];
}

async function findStoresForDistrict(district) {
  const baseFilter = { isActive: true, allianceEnabled: true };
  const keyword = String(district || '').trim();
  if (!keyword) {
    return Store.find(baseFilter).sort({ sortOrder: 1, name: 1 }).lean();
  }

  const withDistrict = await Store.find({ ...baseFilter, district: keyword })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  const legacyFilter = {
    ...baseFilter,
    $or: [{ district: null }, { district: { $exists: false } }],
  };
  const addressFilter = buildDistrictAddressFilter(keyword);
  const legacy = addressFilter
    ? await Store.find({ ...legacyFilter, ...addressFilter })
        .sort({ sortOrder: 1, name: 1 })
        .lean()
    : [];

  const merged = new Map();
  for (const s of [...withDistrict, ...legacy]) {
    merged.set(String(s._id), s);
  }
  return Array.from(merged.values()).sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name))
  );
}

async function checkCourtSlot(court, store, { date, startTime, duration }, courtSlug) {
  const endTime = addMinutesToTime(startTime, duration);
  if (!endTime) {
    return { available: false, reason: '超出可預約時段' };
  }

  if (!court.isAvailable()) {
    return { available: false, reason: '場地維護或停用' };
  }

  const bookingDate = new Date(`${date}T12:00:00+08:00`);
  if (!court.isOpenAt(bookingDate, startTime, endTime)) {
    return { available: false, reason: '非營業時段' };
  }

  const hasConflict = await Booking.checkTimeConflict(
    court._id,
    date,
    startTime,
    endTime
  );
  if (hasConflict) {
    return { available: false, reason: '已預約' };
  }

  const basePrice = court.getPriceForTime(startTime, bookingDate);
  const totalPrice = Math.round((basePrice * duration) / 60);
  const slug = courtSlug || court.slug;
  const urls = buildBookingUrls(store.slug, slug, date);

  return {
    available: true,
    startTime,
    endTime,
    duration,
    pricing: {
      basePrice,
      totalPrice,
      slotName: court.getTimeSlotName(startTime, bookingDate),
    },
    bookingUrl: urls.booking,
    deepLink: urls.deepLink,
  };
}

/**
 * 聯盟跨店搜尋：地區 + 日期 + 開始時間 + 時長
 */
async function searchAllianceCourtAvailability({
  district = '',
  region = '',
  date,
  startTime,
  duration = 60,
  courtType = '',
}) {
  if (!isValidBookingDateYmd(date)) {
    const err = new Error('請提供有效日期 (YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime)) {
    const err = new Error('請提供有效開始時間 (HH:mm)');
    err.status = 400;
    throw err;
  }
  const durationNum = Number(duration);
  if (![60, 120].includes(durationNum)) {
    const err = new Error('時長僅支援 60 或 120 分鐘');
    err.status = 400;
    throw err;
  }

  const maxAdvanceDays = await getMaxAdvanceDaysForRole('user');
  const window = evaluateBookingDateWindow(date, maxAdvanceDays);
  if (!window.bookable) {
    const err = new Error(window.reason || '日期不可預約');
    err.status = 400;
    err.code = window.code;
    throw err;
  }

  const districtKey = String(district || region || '').trim();
  const stores = await findStoresForDistrict(districtKey);

  if (stores.length === 0) {
    return {
      query: { district: districtKey, region: districtKey, date, startTime, duration: durationNum, courtType },
      results: [],
      available: [],
      unavailable: [],
      meta: { storeCount: 0, courtCount: 0, availableCount: 0 },
    };
  }

  const storeIds = stores.map((s) => s._id);
  const storeMap = Object.fromEntries(stores.map((s) => [String(s._id), s]));

  const courtFilter = {
    store: { $in: storeIds },
    isActive: true,
    type: { $ne: 'full_venue' },
  };
  const types = resolveCourtTypes(courtType);
  if (types) {
    courtFilter.type = { $in: types };
  }

  const courts = await Court.find(courtFilter).sort({ store: 1, number: 1 });

  const courtsByStore = new Map();
  for (const court of courts) {
    const sid = String(court.store);
    if (!courtsByStore.has(sid)) courtsByStore.set(sid, []);
    courtsByStore.get(sid).push(court);
  }

  const results = [];
  for (const court of courts) {
    const store = storeMap[String(court.store)];
    if (!store) continue;
    const storeCourts = courtsByStore.get(String(court.store)) || [court];
    const typeCounts = typeCountsForCourts(storeCourts);
    const effectiveSlug = effectiveCourtSlug(court, typeCounts);
    const check = await checkCourtSlot(court, store, {
      date,
      startTime,
      duration: durationNum,
    }, effectiveSlug);
    results.push({
      store: {
        id: String(store._id),
        name: store.branding?.displayName || store.name,
        slug: store.slug,
        address: store.address,
        district: store.district || null,
        allianceEnabled: Boolean(store.allianceEnabled),
      },
      court: {
        id: String(court._id),
        name: court.name,
        slug: effectiveSlug,
        number: court.number,
        type: court.type,
      },
      ...check,
    });
  }

  const available = results.filter((r) => r.available);
  const unavailable = results.filter((r) => !r.available);

  available.sort((a, b) => {
    const priceA = a.pricing?.totalPrice ?? 999999;
    const priceB = b.pricing?.totalPrice ?? 999999;
    return priceA - priceB;
  });

  return {
    query: { district: districtKey, region: districtKey, date, startTime, duration: durationNum, courtType },
    results,
    available,
    unavailable,
    meta: {
      storeCount: stores.length,
      courtCount: courts.length,
      availableCount: available.length,
    },
  };
}

module.exports = {
  searchAllianceCourtAvailability,
  addMinutesToTime,
};
