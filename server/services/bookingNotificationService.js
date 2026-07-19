const Store = require('../models/Store');
const accessControlService = require('./accessControlService');
const emailService = require('./emailService');
const { getStoreHikConfig } = require('../utils/storeHikConfig');

function buildVisitorData(booking, userFallback) {
  return {
    name: booking.players?.[0]?.name || userFallback?.name,
    email: booking.players?.[0]?.email || userFallback?.email,
    phone: booking.players?.[0]?.phone || userFallback?.phone,
  };
}

function buildBookingEmailData(booking, court, store, overrides = {}) {
  return {
    bookingId: booking._id.toString(),
    date: booking.date,
    endDate: booking.endDate || null,
    startTime: booking.startTime,
    endTime: booking.endTime,
    courtName: overrides.courtName || court?.name || '場地',
    courtNumber: court?.number,
    storeName: store?.name || '',
    storeAddress: store?.address || '',
    storePhone: store?.phone || '',
    ...overrides,
  };
}

async function resolveStore(booking, courtDoc) {
  const storeId = booking.store || courtDoc?.store;
  if (!storeId) return null;
  return Store.findById(storeId).lean();
}

/**
 * 預約建立／重發：HIK 店發門禁郵件；非 HIK 店發純確認郵件
 */
async function sendBookingNotification({ booking, courtDoc, store: storeInput, userFallback, emailOverrides }) {
  const store = storeInput || await resolveStore(booking, courtDoc);
  const visitorData = buildVisitorData(booking, userFallback);
  const bookingData = buildBookingEmailData(booking, courtDoc, store, emailOverrides);

  if (store?.enableHikAccess) {
    const hikConfig = getStoreHikConfig(store);
    const accessControlResult = await accessControlService.processAccessControl(
      visitorData,
      bookingData,
      hikConfig
    );
    return { mode: 'hik', accessControlResult };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  return { mode: 'confirmation' };
}

async function applyTempAuthToBooking(booking, accessControlResult) {
  if (!accessControlResult?.tempAuth) return booking;
  booking.tempAuth = {
    code: accessControlResult.tempAuth.code || null,
    password: accessControlResult.tempAuth.password || null,
    startTime: accessControlResult.tempAuth.startTime || null,
    endTime: accessControlResult.tempAuth.endTime || null,
    createdAt: new Date(),
  };
  await booking.save();
  return booking;
}

/**
 * 管理員重發：HIK 店可重建 tempAuth；非 HIK 店重發確認信
 */
async function resendBookingNotification(booking) {
  const court = booking.court;
  const store = await resolveStore(booking, court);

  const visitorData = buildVisitorData(booking, booking.user);
  const bookingData = buildBookingEmailData(booking, court, store);

  if (store?.enableHikAccess) {
    const hikConfig = getStoreHikConfig(store);
    let qrCodeData = null;
    let password = null;
    let tempAuthCreated = false;

    if (!booking.tempAuth?.code) {
      const tempAuth = await accessControlService.createTempAuth(visitorData, bookingData, hikConfig);
      if (tempAuth?.code) {
        qrCodeData = tempAuth.code;
        password = tempAuth.password;
        const earlyStartTime = accessControlService.subtractMinutes(bookingData.startTime, 15);
        const usePreviousDayForEarly =
          accessControlService._timeToMinutes(earlyStartTime) >
          accessControlService._timeToMinutes(bookingData.startTime);
        const startTimeISO = accessControlService.convertToISOString(
          bookingData.date,
          earlyStartTime,
          null,
          null,
          usePreviousDayForEarly
        );
        const endTimeISO = accessControlService.convertToISOString(
          bookingData.date,
          bookingData.endTime,
          bookingData.endDate || null,
          earlyStartTime
        );
        booking.tempAuth = {
          code: tempAuth.code || null,
          password: tempAuth.password || null,
          startTime: startTimeISO || null,
          endTime: endTimeISO || null,
          createdAt: new Date(),
        };
        await booking.save();
        tempAuthCreated = true;
      } else {
        throw new Error('創建臨時授權失敗：未返回有效數據');
      }
    } else {
      qrCodeData = booking.tempAuth.code;
      password = booking.tempAuth.password;
    }

    await accessControlService.sendAccessEmail(visitorData, bookingData, qrCodeData, password);
    return {
      mode: 'hik',
      message: tempAuthCreated ? '臨時授權已重新創建，開門通知郵件已發送' : '開門通知郵件已重新發送',
      tempAuthCreated,
    };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  return {
    mode: 'confirmation',
    message: '預約確認郵件已重新發送',
    tempAuthCreated: false,
  };
}

module.exports = {
  sendBookingNotification,
  applyTempAuthToBooking,
  resendBookingNotification,
  buildVisitorData,
  buildBookingEmailData,
};
