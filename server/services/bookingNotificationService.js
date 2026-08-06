const Store = require('../models/Store');
const emailService = require('./emailService');
const { getStoreAccessControlConfig, isAccessControlEnabled } = require('../utils/storeAccessControlConfig');
const { processAccessControl, createAccessPass } = require('./accessControlRouter');
const accessControlService = require('./accessControlService');
const metaWhatsAppService = require('./metaWhatsAppService');

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
 * PickCourt 共用 Meta WhatsApp 號發送（有門禁→QR+密碼；否則→預約內容）
 */
async function sendMetaWhatsAppForBooking({
  phone,
  store,
  bookingData,
  withAccess,
  password,
  qrCodeData,
}) {
  if (!metaWhatsAppService.isConfigured()) {
    return { skipped: true, reason: 'not_configured' };
  }
  if (!phone) {
    return { skipped: true, reason: 'no_phone' };
  }

  try {
    const result = await metaWhatsAppService.notifyBooking({
      phone,
      withAccess: !!withAccess,
      storeName: store?.branding?.displayName || store?.name || bookingData.storeName,
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      courtName: bookingData.courtName,
      storeAddress: store?.address || bookingData.storeAddress,
      password: password || null,
      qrCodeData: qrCodeData || null,
      qrPayload: password || null,
    });
    if (result.success) {
      console.log('✅ Meta WhatsApp 已發送:', {
        to: result.to,
        messageId: result.messageId,
        withAccess: !!withAccess,
      });
    } else if (result.skipped) {
      console.log('⚠️ Meta WhatsApp 略過:', result.reason);
    }
    return result;
  } catch (err) {
    console.error('❌ Meta WhatsApp 發送失敗:', err.message, err.details || '');
    return { success: false, error: err.message, details: err.details };
  }
}

/**
 * 預約建立／重發：門禁店發門禁郵件；非門禁店發確認郵件；並經 Meta WhatsApp 通知
 */
async function sendBookingNotification({ booking, courtDoc, store: storeInput, userFallback, emailOverrides }) {
  const store = storeInput || (await resolveStore(booking, courtDoc));
  const visitorData = buildVisitorData(booking, userFallback);
  const bookingData = buildBookingEmailData(booking, courtDoc, store, emailOverrides);

  if (isAccessControlEnabled(store)) {
    const acConfig = getStoreAccessControlConfig(store);
    const accessControlResult = await processAccessControl(acConfig, visitorData, bookingData);

    const wa = await sendMetaWhatsAppForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password: accessControlResult?.password || accessControlResult?.tempAuth?.password,
      qrCodeData: accessControlResult?.qrCodeData || accessControlResult?.tempAuth?.code,
    });

    return { mode: acConfig.vendor, accessControlResult, whatsapp: wa };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  const wa = await sendMetaWhatsAppForBooking({
    phone: visitorData.phone,
    store,
    bookingData,
    withAccess: false,
  });
  return { mode: 'confirmation', whatsapp: wa };
}

/**
 * 相容舊呼叫：已有 tempAuth 時可再發 Meta WhatsApp
 */
async function sendWhatsAppBookingConfirmationStub(booking, store) {
  if (!metaWhatsAppService.isConfigured()) {
    return { skipped: true, reason: 'not_configured' };
  }
  const phone = booking.players?.[0]?.phone || booking.user?.phone;
  const bookingData = buildBookingEmailData(booking, booking.court, store);
  const withAccess =
    isAccessControlEnabled(store) && Boolean(booking.tempAuth?.code || booking.tempAuth?.password);
  return sendMetaWhatsAppForBooking({
    phone,
    store,
    bookingData,
    withAccess,
    password: booking.tempAuth?.password,
    qrCodeData: booking.tempAuth?.code,
  });
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

function shouldSendBookingInvoice(booking) {
  const method = booking.payment?.method;
  const status = booking.payment?.status;
  if (method === 'admin_waived') return true;
  if (status === 'paid') return true;
  if (method === 'points' && Number(booking.payment?.pointsDeducted || 0) > 0) return true;
  return false;
}

function buildBookingInvoiceData(booking, court, store) {
  const invoiceNumber = `BKG-${booking._id.toString().slice(-8).toUpperCase()}`;
  const courtName = court?.name || '場地預約';
  const original = Number(booking.payment?.originalPrice) || 0;
  const discount = Number(booking.payment?.discount) || 0;
  const total = Math.max(0, original - discount);
  const storeName = store?.branding?.displayName || store?.name || '';

  return {
    invoiceNumber,
    items: [
      {
        description: `${storeName} ${courtName} · ${booking.date} ${booking.startTime}-${booking.endTime}`,
        quantity: 1,
        unitPrice: original,
        amount: total,
      },
    ],
    subtotal: total,
    total: total,
  };
}

async function sendBookingInvoiceEmail(booking, store) {
  if (!shouldSendBookingInvoice(booking)) {
    return { skipped: true, reason: 'not_paid' };
  }
  const visitorData = buildVisitorData(booking, booking.user);
  if (!visitorData.email) {
    return { skipped: true, reason: 'no_email' };
  }
  const invoiceData = buildBookingInvoiceData(booking, booking.court, store);
  const paymentData = {
    method: booking.payment?.method,
    status: booking.payment?.status,
    paidAt: booking.payment?.paidAt,
    transactionId: booking.payment?.transactionId,
    pointsDeducted: booking.payment?.pointsDeducted,
  };
  await emailService.sendInvoiceEmail(visitorData, invoiceData, paymentData);
  return { sent: true, invoiceNumber: invoiceData.invoiceNumber };
}

/**
 * 管理員重發：郵件 + Meta WhatsApp
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
    const wa = await sendMetaWhatsAppForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password,
      qrCodeData,
    });

    let invoiceResult = { skipped: true };
    try {
      invoiceResult = await sendBookingInvoiceEmail(booking, store);
    } catch (invoiceErr) {
      console.error('❌ 重發預約發票郵件失敗:', invoiceErr.message);
      invoiceResult = { sent: false, error: invoiceErr.message };
    }

    const vendorLabel = acConfig.vendor === 'dahua' ? '大華' : 'HIK';
    const invoiceNote = invoiceResult.sent ? '，發票郵件已發送' : '';
    return {
      mode: acConfig.vendor,
      message: tempAuthCreated
        ? `${vendorLabel} 臨時授權已重新創建，開門通知郵件已發送${invoiceNote}`
        : `開門通知郵件已重新發送${invoiceNote}`,
      tempAuthCreated,
      whatsapp: wa,
      invoice: invoiceResult,
    };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  const wa = await sendMetaWhatsAppForBooking({
    phone: visitorData.phone,
    store,
    bookingData,
    withAccess: false,
  });

  let invoiceResult = { skipped: true };
  try {
    invoiceResult = await sendBookingInvoiceEmail(booking, store);
  } catch (invoiceErr) {
    console.error('❌ 重發預約發票郵件失敗:', invoiceErr.message);
    invoiceResult = { sent: false, error: invoiceErr.message };
  }

  const invoiceNote = invoiceResult.sent ? '，發票郵件已發送' : '';
  return {
    mode: 'confirmation',
    message: `預約確認郵件已重新發送${invoiceNote}`,
    tempAuthCreated: false,
    whatsapp: wa,
    invoice: invoiceResult,
  };
}

module.exports = {
  sendBookingNotification,
  sendWhatsAppBookingConfirmationStub,
  sendMetaWhatsAppForBooking,
  applyTempAuthToBooking,
  resendBookingNotification,
  sendBookingInvoiceEmail,
  buildVisitorData,
  buildBookingEmailData,
};
