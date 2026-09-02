const Store = require('../models/Store');
const accessControlService = require('./accessControlService');
const emailService = require('./emailService');
const { getStoreHikConfig } = require('../utils/storeHikConfig');
const whatsappMessaging = require('./whatsappMessagingService');

function buildVisitorData(booking, userFallback) {
  return {
    name: booking.players?.[0]?.name || userFallback?.name,
    email: booking.players?.[0]?.email || userFallback?.email,
    phone: booking.players?.[0]?.phone || userFallback?.phone,
  };
}

function buildBookingEmailData(booking, court, store, overrides = {}) {
  const totalPrice =
    Number(booking.pricing?.totalPrice) ||
    Number(booking.payment?.pointsDeducted) ||
    Number(booking.payment?.originalPrice) ||
    null;
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
    totalPrice,
    paymentMethod: booking.payment?.method || null,
    ...overrides,
  };
}

async function resolveStore(booking, courtDoc) {
  const storeId = booking.store || courtDoc?.store;
  if (!storeId) return null;
  return Store.findById(storeId).lean();
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

function appendSupportNotes(lines) {
  lines.push('');
  lines.push('注意事項：');
  lines.push('1) 球場會提供球拍及匹克球，用戶無需帶上打球用品');
  lines.push(
    '2) 敬請避免穿著黑底運動鞋，造成污漬將會收取每一條鞋痕 $100 清潔費'
  );
  lines.push('3) 場地內禁止吸煙和飲酒');
  lines.push(
    '4) 如在場地遇上其他問題，請聯絡客服 WhatsApp：https://wa.me/85261902761，本電話只提供系統訊息。'
  );
}

function buildBookingConfirmMessage({ store, bookingData, withAccess, password }) {
  const storeName = store?.name || bookingData.storeName || 'PickleVibes';
  const lines = [
    withAccess ? '*PickleVibes 預約確認／進場通知*' : '*PickleVibes 預約確認*',
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
    lines.push(`開門密碼：${password}`);
    lines.push('QR 碼已發送至您的電郵，請查收。');
  }

  if (bookingData.bookingId) {
    lines.push('');
    lines.push(`預約編號：${bookingData.bookingId}`);
  }

  appendSupportNotes(lines);
  return lines.join('\n');
}

function buildBookingCancellationMessage(booking, store) {
  const storeName = store?.name || 'PickleVibes';
  const courtName = booking.court?.name || '場地';
  const lines = [
    '*PickleVibes 預約取消通知*',
    '',
    `店鋪：${storeName}`,
    `場地：${courtName}`,
    `日期：${formatBookingDate(booking.date)}`,
    `時間：${booking.startTime || ''} - ${booking.endTime || ''}`.trim(),
  ];
  appendSupportNotes(lines);
  return lines.join('\n');
}

/**
 * WhatsApp 文字通知（預約確認／進場）
 */
async function sendOpenWaForBooking({ phone, store, bookingData, withAccess, password }) {
  if (!whatsappMessaging.isWhatsAppConfigured()) {
    return { skipped: true, reason: 'not_configured', provider: whatsappMessaging.resolveProvider() };
  }
  if (!phone) {
    return { skipped: true, reason: 'no_phone', provider: whatsappMessaging.resolveProvider() };
  }
  if (!whatsappMessaging.isValidPhoneNumber(phone)) {
    return { skipped: true, reason: 'invalid_phone', provider: whatsappMessaging.resolveProvider() };
  }

  const storeName = store?.name || bookingData.storeName || 'PickleVibes';
  const courtName = bookingData.courtName || '場地';
  const dateLabel = formatBookingDate(bookingData.date);
  const timeRange = `${bookingData.startTime || ''} - ${bookingData.endTime || ''}`.trim();
  const address = store?.address || bookingData.storeAddress || '—';
  const bookingId = bookingData.bookingId || '—';
  const message = buildBookingConfirmMessage({ store, bookingData, withAccess, password });
  const provider = whatsappMessaging.resolveProvider();

  try {
    let result;
    if (provider === 'cloud') {
      if (withAccess && password) {
        result = await whatsappMessaging.sendBookingAccess(phone, {
          storeName,
          courtName,
          dateLabel,
          timeRange,
          address,
          password,
          bookingId,
        });
      } else {
        result = await whatsappMessaging.sendBookingConfirmed(phone, {
          storeName,
          courtName,
          dateLabel,
          timeRange,
          address,
          bookingId,
        });
      }
    } else {
      result = await whatsappMessaging.sendTextMessage(phone, message);
    }

    if (result.success) {
      console.log('✅ WhatsApp 預約通知已發送:', {
        to: phone,
        withAccess: !!withAccess,
        provider: result.provider,
      });
    }
    return result;
  } catch (err) {
    console.error('❌ WhatsApp 預約通知發送失敗:', err.message, err.response?.data || '');
    return { success: false, provider: provider || 'unknown', error: err.message };
  }
}

/**
 * 預約取消 WhatsApp 通知
 */
async function sendBookingCancellationWhatsApp(booking, phone, storeInput) {
  if (!phone) return { skipped: true, reason: 'no_phone' };

  const store = storeInput || (await resolveStore(booking, booking.court));
  const message = buildBookingCancellationMessage(booking, store);
  const storeName = store?.name || 'PickleVibes';
  const courtName = booking.court?.name || '場地';
  const dateLabel = formatBookingDate(booking.date);
  const timeRange = `${booking.startTime || ''} - ${booking.endTime || ''}`.trim();

  if (!whatsappMessaging.isWhatsAppConfigured()) {
    return { skipped: true, reason: 'not_configured', provider: whatsappMessaging.resolveProvider() };
  }
  if (!whatsappMessaging.isValidPhoneNumber(phone)) {
    return { skipped: true, reason: 'invalid_phone', provider: whatsappMessaging.resolveProvider() };
  }

  try {
    const result = await whatsappMessaging.sendBookingCancelled(
      phone,
      { storeName, courtName, dateLabel, timeRange },
      message
    );
    if (result.success) {
      console.log('✅ WhatsApp 取消通知已發送:', phone);
    }
    return result;
  } catch (err) {
    console.error('❌ WhatsApp 取消通知發送失敗:', err.message);
    return { success: false, provider: whatsappMessaging.resolveProvider(), error: err.message };
  }
}

/**
 * 預約建立／重發：HIK 店發門禁郵件；非 HIK 店發純確認郵件；並經 OpenWA 發送 WhatsApp
 */
async function sendBookingNotification({ booking, courtDoc, store: storeInput, userFallback, emailOverrides }) {
  const store = storeInput || (await resolveStore(booking, courtDoc));
  const visitorData = buildVisitorData(booking, userFallback);
  const bookingData = buildBookingEmailData(booking, courtDoc, store, emailOverrides);

  if (store?.enableHikAccess) {
    const hikConfig = getStoreHikConfig(store);
    const accessControlResult = await accessControlService.processAccessControl(
      visitorData,
      bookingData,
      hikConfig
    );
    const wa = await sendOpenWaForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password: accessControlResult?.password || accessControlResult?.tempAuth?.password,
    });
    return { mode: 'hik', accessControlResult, whatsapp: wa };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  const wa = await sendOpenWaForBooking({
    phone: visitorData.phone,
    store,
    bookingData,
    withAccess: false,
  });
  return { mode: 'confirmation', whatsapp: wa };
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
 * 管理員重發：HIK 店可重建 tempAuth；非 HIK 店重發確認信；並經 OpenWA 通知
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
    const wa = await sendOpenWaForBooking({
      phone: visitorData.phone,
      store,
      bookingData,
      withAccess: true,
      password,
    });
    return {
      mode: 'hik',
      message: tempAuthCreated ? '臨時授權已重新創建，開門通知郵件已發送' : '開門通知郵件已重新發送',
      tempAuthCreated,
      whatsapp: wa,
    };
  }

  await emailService.sendBookingConfirmationEmail(visitorData, bookingData, store);
  const wa = await sendOpenWaForBooking({
    phone: visitorData.phone,
    store,
    bookingData,
    withAccess: false,
  });
  return {
    mode: 'confirmation',
    message: '預約確認郵件已重新發送',
    tempAuthCreated: false,
    whatsapp: wa,
  };
}

module.exports = {
  sendBookingNotification,
  sendOpenWaForBooking,
  sendBookingCancellationWhatsApp,
  applyTempAuthToBooking,
  resendBookingNotification,
  buildVisitorData,
  buildBookingEmailData,
};
