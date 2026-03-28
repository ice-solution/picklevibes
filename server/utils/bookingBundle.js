const Booking = require('../models/Booking');

const ACTIVE = ['pending', 'confirmed'];

/**
 * 取得與此預約同一「包場／活動佔用」組內、仍為有效狀態的所有預約 _id（含自身）。
 * 優先 venueBundleId，其次 relatedActivity（活動中心），再來舊版 isFullVenue / fullVenueBookings。
 */
async function collectBundledBookingIds(bookingDoc) {
  const id = bookingDoc._id;

  if (bookingDoc.venueBundleId) {
    const rows = await Booking.find({
      venueBundleId: bookingDoc.venueBundleId,
      status: { $in: ACTIVE }
    })
      .select('_id')
      .lean();
    return rows.length ? rows.map((r) => r._id) : [id];
  }

  if (bookingDoc.relatedActivity) {
    const rows = await Booking.find({
      relatedActivity: bookingDoc.relatedActivity,
      status: { $in: ACTIVE }
    })
      .select('_id')
      .lean();
    return rows.length ? rows.map((r) => r._id) : [id];
  }

  if (bookingDoc.isFullVenue && bookingDoc.fullVenueBookings?.length) {
    const rows = await Booking.find({
      _id: { $in: [id, ...bookingDoc.fullVenueBookings] },
      status: { $in: ACTIVE }
    })
      .select('_id')
      .lean();
    return rows.length ? rows.map((r) => r._id) : [id];
  }

  const parent = await Booking.findOne({
    fullVenueBookings: id,
    status: { $in: ACTIVE }
  })
    .select('_id fullVenueBookings')
    .lean();

  if (parent) {
    const allIds = [parent._id, ...(parent.fullVenueBookings || [])];
    const rows = await Booking.find({
      _id: { $in: allIds },
      status: { $in: ACTIVE }
    })
      .select('_id')
      .lean();
    return rows.length ? rows.map((r) => r._id) : [id];
  }

  return [id];
}

module.exports = {
  collectBundledBookingIds
};
