const Store = require('../models/Store');
const emailService = require('./emailService');
const { getStoreAccessControlConfig, isAccessControlEnabled } = require('../utils/storeAccessControlConfig');
const { processAccessControl, createAccessPass } = require('./accessControlRouter');
const accessControlService = require('./accessControlService');
const metaWhatsAppService = require('./metaWhatsAppService');
const openWaService = require('./openWaService');

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
 * BOOKING_WA_PROVIDER=meta|openwa
 * 預設：有 Meta Cloud API 就用 Meta；否則才退回 OpenWA（legacy）
 */
function getBookingWaProvider() {
  const p = String(process.env.BOOKING_WA_PROVIDER || '').trim().toLowerCase();
  if (p === 'openwa' || p === 'open-wa') return 'openwa';
  if (p === 'meta' || p === 'cloud' || p === 'whatsapp_cloud') return 'meta';
  if (metaWhatsAppService.isConfigured()) return 'meta';
  if (openWaService.isOpenWaConfigured()) return 'openwa';
  return 'none';
}

/** 預約 WhatsApp 已由 notification service 統一發送（略過 Twilio 雙重發送） */
function isUnifiedBookingWhatsAppEnabled() {
  const provider = getBookingWaProvider();
  return provider === 'openwa' || provider === 'meta';
}

function storeDisplayName(store, bookingData) {
  return store?.branding?.displayName || store?.name || bookingData?.storeName || 'PickCourt';
}

function formatBookingDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return String(date || '');
  return d.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function buildOpenWaBookingMessage({ store, bookingData, withAccess, password, deviceUserId }) {
  const storeName = storeDisplayName(store, bookingData);
  const lines = [
    withAccess ? '*PickCourt 預約確認／進場通知*' : '*PickCourt 預約確認*',
    '',
    `店鋪：${storeName}`,
    `場地：${bookingData.courtName || '場地'}`,
    `日期：${formatBookingDate(bookingData.date)}`,
    `時間：${bookingData.startTime || ''} - ${bookingData.endTime || ''}`.trim(),
  ];

  const address = store?.address || bookingData.storeAddress;
  if (address) lines.push(`地址：${address}`);

  if (withAccess && password) {
    lines.push('');
    if (deviceUserId) {
      lines.push(`門禁用戶編號：${deviceUserId}`);
      lines.push(`開門密碼：${password}`);
      lines.push('面板：先輸入用戶編號，再輸入密碼。');
      lines.push('亦可對住門禁鏡頭掃電郵內 QR 碼。');
    } else {
      lines.push(`開門密碼：${password}`);
      lines.push('請用電郵內 QR 碼對住門禁鏡頭掃碼進場（或輸入密碼）。');
    }
  }

  if (bookingData.bookingId) {
    lines.push('');
    lines.push(`預約編號：${bookingData.bookingId}`);
  }

  lines.push('');
  lines.push('如有問題請聯絡場地。');
  return lines.join('\n');
}

function buildOpenWaCancellationMessage(booking, store) {
  const storeName = storeDisplayName(store, null);
  const courtName = booking.court?.name || '場地';
  return [
    '*PickCourt 預約取消通知*',
    '',
    `店鋪：${storeName}`,
    `場地：${courtName}`,
    `日期：${formatBookingDate(booking.date)}`,
    `時間：${booking.startTime || ''} - ${booking.endTime || ''}`.trim(),
    '',
    '如有任何問題，請聯絡場地。',
  ].join('\n');
}

async function sendOpenWaForBooking({ phone, store, bookingData, withAccess, password, deviceUserId }) {
  if (!openWaService.isOpenWaConfigured()) {
    return { skipped: true, reason: 'not_configured', provider: 'openwa' };
  }
  if (!phone) {
    return { skipped: true, reason: 'no_phone', provider: 'openwa' };
  }
  if (!openWaService.isValidPhoneNumber(phone)) {
    return { skipped: true, reason: 'invalid_phone', provider: 'openwa' };
  }

  try {
    const message = buildOpenWaBookingMessage({
      store,
      bookingData,
      withAccess,
      password,
      deviceUserId,
    });
    const result = await openWaService.sendTextMessage(phone, message);
    console.log('✅ OpenWA 預約通知已發送:', { to: result.to, withAccess: !!withAccess });
    return { success: true, provider: 'openwa', ...result };
  } catch (err) {
    console.error('❌ OpenWA 預約通知發送失敗:', err.message, err.response?.data || '');
    return { success: false, provider: 'openwa', error: err.message };
  }
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
  qrPayload,
  deviceUserId,
}) {
  if (!metaWhatsAppService.isConfigured()) {
    return { skipped: true, reason: 'not_configured', provider: 'meta' };
  }
  if (!phone) {
    return { skipped: true, reason: 'no_phone', provider: 'meta' };
  }

  try {
    const passwordDisplay = deviceUserId
      ? `用戶${deviceUserId}／密碼${password || ''}`
      : password || null;
    const result = await metaWhatsAppService.notifyBooking({
      phone,
      withAccess: !!withAccess,
      storeName: storeDisplayName(store, bookingData),
      date: bookingData.date,
      startTime: bookingData.startTime,
      endTime: bookingData.endTime,
      courtName: bookingData.courtName,
      storeAddress: store?.address || bookingData.storeAddress,
      password: passwordDisplay,
      qrCodeData: qrCodeData || null,
      qrPayload: qrPayload || password || null,
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
    return { provider: 'meta', ...result };
  } catch (err) {
    console.error('❌ Meta WhatsApp 發送失敗:', err.message, err.details || '');
    return { success: false, provider: 'meta', error: err.message, details: err.details };
  }
}

/** 依 BOOKING_WA_PROVIDER 選擇 OpenWA 或 Meta（唔會兩個一齊發） */
async function sendWhatsAppForBooking(payload) {
  const provider = getBookingWaProvider();
  if (provider === 'openwa') {
    return sendOpenWaForBooking(payload);
  }
  if (provider === 'meta') {
    return sendMetaWhatsAppForBooking(payload);
  }
  return { skipped: true, reason: 'not_configured', provider: 'none' };
}

/**
 * 預約建立／重發：門禁店發門禁郵件；非門禁店發確認郵件；並經 OpenWA／Meta 通知
 */
async function sendBookingNotification({ booking, courtDoc, store: storeInput, userFallback, emailOverrides }) {
  const store = storeInput || (await resolveStore(booking, courtDoc));
  const visitorData = buildVisitorData(booking, userFallback);
  const bookingData = buildBookingEmailData(booking, courtDoc, store, emailOverrides);

  if (isAccessControlEnabled(store)) {
    const acConfig = getStoreAccessControlConfig(store);
    const accessControlResult = await processAccessControl(acConfig, visitorData, bookingData);

    const wa = await sendWhatsAppForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password: accessControlResult?.password || accessControlResult?.tempAuth?.password,
      deviceUserId: accessControlResult?.tempAuth?.deviceUserId || null,
      qrCodeData: accessControlResult?.qrCodeData || accessControlResult?.tempAuth?.code,
      qrPayload:
        accessControlResult?.qrPayload ||
        accessControlResult?.tempAuth?.accessToken ||
        accessControlResult?.password ||
        accessControlResult?.tempAuth?.password,
    });

    return { mode: acConfig.vendor, accessControlResult, whatsapp: wa };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  const wa = await sendWhatsAppForBooking({
    phone: visitorData.phone,
    store,
    bookingData,
    withAccess: false,
  });
  return { mode: 'confirmation', whatsapp: wa };
}

/**
 * 相容舊呼叫：已有 tempAuth 時可再發 WhatsApp
 */
async function sendWhatsAppBookingConfirmationStub(booking, store) {
  const phone = booking.players?.[0]?.phone || booking.user?.phone;
  const bookingData = buildBookingEmailData(booking, booking.court, store);
  const withAccess =
    isAccessControlEnabled(store) && Boolean(booking.tempAuth?.code || booking.tempAuth?.password);
  return sendWhatsAppForBooking({
    phone,
    store,
    bookingData,
    withAccess,
    password: booking.tempAuth?.password,
    deviceUserId: booking.tempAuth?.deviceUserId || null,
    qrCodeData: booking.tempAuth?.code,
  });
}

async function sendBookingCancellationWhatsApp(booking, phone, storeInput) {
  if (!phone) return { skipped: true, reason: 'no_phone' };

  const store = storeInput || (await resolveStore(booking, booking.court));
  const provider = getBookingWaProvider();

  if (provider === 'meta') {
    if (!metaWhatsAppService.isConfigured()) {
      return { skipped: true, reason: 'meta_not_configured', provider: 'meta' };
    }
    try {
      const result = await metaWhatsAppService.sendBookingCancellation({
        phone,
        storeName: storeDisplayName(store, null),
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        courtName: booking.court?.name || '場地',
      });
      if (result.success) {
        console.log('✅ Meta WhatsApp 取消通知已發送:', { to: result.to, messageId: result.messageId });
      } else if (result.skipped) {
        console.log('⚠️ Meta WhatsApp 取消通知略過:', result.reason);
      }
      return { provider: 'meta', ...result };
    } catch (err) {
      console.error('❌ Meta WhatsApp 取消通知發送失敗:', err.message, err.details || '');
      return { success: false, provider: 'meta', error: err.message, details: err.details };
    }
  }

  if (provider === 'openwa') {
    if (!openWaService.isOpenWaConfigured()) {
      return { skipped: true, reason: 'openwa_not_configured' };
    }
    if (!openWaService.isValidPhoneNumber(phone)) {
      return { skipped: true, reason: 'invalid_phone' };
    }
    try {
      const message = buildOpenWaCancellationMessage(booking, store);
      const result = await openWaService.sendTextMessage(phone, message);
      console.log('✅ OpenWA 取消通知已發送:', result.to);
      return { success: true, provider: 'openwa', ...result };
    } catch (err) {
      console.error('❌ OpenWA 取消通知發送失敗:', err.message);
      return { success: false, provider: 'openwa', error: err.message };
    }
  }

  // 未設定 Meta／OpenWA：交俾 routes 既有 Twilio 路徑處理
  return { skipped: true, reason: 'use_legacy_provider', provider };
}

async function applyTempAuthToBooking(booking, accessControlResult) {
  if (!accessControlResult?.tempAuth) return booking;
  booking.tempAuth = {
    code: accessControlResult.tempAuth.code || null,
    password: accessControlResult.tempAuth.password || null,
    accessToken: accessControlResult.tempAuth.accessToken || null,
    deviceUserId: accessControlResult.tempAuth.deviceUserId || null,
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
 * 管理員重發：郵件 + OpenWA／Meta WhatsApp
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
          accessToken: tempAuth.accessToken || null,
          deviceUserId: tempAuth.deviceUserId || null,
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

    await accessControlService.sendAccessEmail(visitorData, bookingData, qrCodeData, password, {
      deviceUserId: booking.tempAuth?.deviceUserId || null,
    });
    const wa = await sendWhatsAppForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password,
      deviceUserId: booking.tempAuth?.deviceUserId || null,
      qrCodeData,
      qrPayload: booking.tempAuth?.accessToken || password,
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
  const wa = await sendWhatsAppForBooking({
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
  sendWhatsAppForBooking,
  sendMetaWhatsAppForBooking,
  sendOpenWaForBooking,
  sendBookingCancellationWhatsApp,
  isUnifiedBookingWhatsAppEnabled,
  getBookingWaProvider,
  applyTempAuthToBooking,
  resendBookingNotification,
  sendBookingInvoiceEmail,
  buildVisitorData,
  buildBookingEmailData,
};
