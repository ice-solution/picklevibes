const Store = require('../models/Store');
const emailService = require('./emailService');
const { getStoreAccessControlConfig, isAccessControlEnabled } = require('../utils/storeAccessControlConfig');
const { processAccessControl, createAccessPass } = require('./accessControlRouter');
const accessControlService = require('./accessControlService');

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
 * 預約建立／重發：門禁店（HIK / 大華）發門禁郵件；非門禁店發純確認郵件
 */
async function sendBookingNotification({ booking, courtDoc, store: storeInput, userFallback, emailOverrides }) {
  const store = storeInput || await resolveStore(booking, courtDoc);
  const visitorData = buildVisitorData(booking, userFallback);
  const bookingData = buildBookingEmailData(booking, courtDoc, store, emailOverrides);

  if (isAccessControlEnabled(store)) {
    const acConfig = getStoreAccessControlConfig(store);
    const accessControlResult = await processAccessControl(acConfig, visitorData, bookingData);
    return { mode: acConfig.vendor, accessControlResult };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  return { mode: 'confirmation' };
}

/**
 * WhatsApp 預約確認（預留，尚未啟用）
 */
async function sendWhatsAppBookingConfirmationStub(booking, store) {
  if (process.env.WHATSAPP_BOOKING_ENABLED !== '1') {
    return { skipped: true, reason: 'not_enabled' };
  }
  // TODO: 依 store 發送不同 WhatsApp 模板
  return { skipped: true, reason: 'not_implemented', storeId: store?._id };
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
 * 管理員重發：門禁店可重建 tempAuth；非門禁店重發確認信
 */
async function resendBookingNotification(booking) {
  const court = booking.court;
  const store = await resolveStore(booking, court);

  const visitorData = buildVisitorData(booking, booking.user);
  const bookingData = buildBookingEmailData(booking, court, store);

  if (isAccessControlEnabled(store)) {
    const acConfig = getStoreAccessControlConfig(store);
    let qrCodeData = null;
    let password = null;
    let tempAuthCreated = false;

    if (!booking.tempAuth?.code) {
      const tempAuth = await createAccessPass(acConfig, visitorData, bookingData);
      if (tempAuth?.code) {
        qrCodeData = tempAuth.code;
        password = tempAuth.password;
        booking.tempAuth = {
          code: tempAuth.code || null,
          password: tempAuth.password || null,
          startTime: tempAuth.startTime || null,
          endTime: tempAuth.endTime || null,
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

    const vendorLabel = acConfig.vendor === 'dahua' ? '大華' : 'HIK';
    return {
      mode: acConfig.vendor,
      message: tempAuthCreated
        ? `${vendorLabel} 臨時授權已重新創建，開門通知郵件已發送`
        : '開門通知郵件已重新發送',
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
  sendWhatsAppBookingConfirmationStub,
  applyTempAuthToBooking,
  resendBookingNotification,
  buildVisitorData,
  buildBookingEmailData,
};
