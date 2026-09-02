/**
 * WhatsApp 發送統一入口：WhatsApp Cloud API（優先）或 OpenWA（legacy）
 *
 * WHATSAPP_PROVIDER=cloud | openwa
 * 留空時：Cloud 已設定 → cloud；否則 OpenWA
 */
const templates = require('../config/whatsappTemplates');
const cloud = require('./whatsappCloudService');
const openWa = require('./openWaService');

function resolveProvider() {
  const forced = String(process.env.WHATSAPP_PROVIDER || '').trim().toLowerCase();
  if (forced === 'cloud') return cloud.isWhatsAppCloudConfigured() ? 'cloud' : null;
  if (forced === 'openwa') return openWa.isOpenWaConfigured() ? 'openwa' : null;
  if (cloud.isWhatsAppCloudConfigured()) return 'cloud';
  if (openWa.isOpenWaConfigured()) return 'openwa';
  return null;
}

function isWhatsAppConfigured() {
  return Boolean(resolveProvider());
}

function isValidPhoneNumber(phone) {
  const provider = resolveProvider();
  if (provider === 'cloud') return cloud.isValidPhoneNumber(phone);
  if (provider === 'openwa') return openWa.isValidPhoneNumber(phone);
  return false;
}

function notConfiguredResult() {
  const provider = resolveProvider();
  if (!provider) {
    return { skipped: true, reason: 'not_configured', provider: null };
  }
  return null;
}

async function sendViaOpenWa(to, text) {
  const result = await openWa.sendTextMessage(to, text);
  return { success: true, provider: 'openwa', ...result };
}

async function sendViaCloudTemplate(to, templateName, bodyParameters) {
  const result = await cloud.sendTemplateMessage({
    to,
    templateName,
    languageCode: templates.language,
    bodyParameters,
  });
  return { success: true, ...result };
}

async function guardedSend(to, { cloudSend, openWaText }) {
  if (!to) return { skipped: true, reason: 'no_phone', provider: resolveProvider() };

  const provider = resolveProvider();
  const missing = notConfiguredResult();
  if (missing) return missing;

  if (!isValidPhoneNumber(to)) {
    return { skipped: true, reason: 'invalid_phone', provider };
  }

  try {
    if (provider === 'cloud') {
      return await cloudSend();
    }
    if (openWaText) {
      return await sendViaOpenWa(to, openWaText);
    }
    return { skipped: true, reason: 'no_openwa_fallback', provider };
  } catch (err) {
    console.error(`❌ WhatsApp 發送失敗 (${provider}):`, err.response?.data || err.message);
    return { success: false, provider, error: err.message };
  }
}

async function sendBookingConfirmed(to, { storeName, courtName, dateLabel, timeRange, address, bookingId }) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.bookingConfirmed, [
        storeName || 'PickleVibes',
        courtName || '場地',
        dateLabel || '',
        timeRange || '',
        address || '—',
        bookingId || '—',
      ]),
    openWaText: null,
  });
}

async function sendBookingAccess(to, params) {
  const { storeName, courtName, dateLabel, timeRange, address, password, bookingId } = params;
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.bookingAccess, [
        storeName || 'PickleVibes',
        courtName || '場地',
        dateLabel || '',
        timeRange || '',
        address || '—',
        password || '',
        bookingId || '—',
      ]),
    openWaText: null,
  });
}

async function sendBookingCancelled(to, { storeName, courtName, dateLabel, timeRange }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.bookingCancelled, [
        storeName || 'PickleVibes',
        courtName || '場地',
        dateLabel || '',
        timeRange || '',
      ]),
    openWaText,
  });
}

async function sendCoachClassAssigned(to, { coachName, title, dateLabel, timeRange, location, notes }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.coachClassAssigned, [
        coachName || '教練',
        title || '教練課堂',
        dateLabel || '',
        timeRange || '',
        location || '—',
        notes || '—',
      ]),
    openWaText,
  });
}

async function sendCoachClassReminder(to, { coachName, title, dateLabel, timeRange, location, notes }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.coachClassReminder, [
        coachName || '教練',
        title || '教練課堂',
        dateLabel || '',
        timeRange || '',
        location || '—',
        notes || '—',
      ]),
    openWaText,
  });
}

async function sendOvernightNewBooking(to, { storeName, dateTimeLine }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.overnightNewBooking, [
        storeName || 'PickleVibes',
        dateTimeLine || '',
      ]),
    openWaText,
  });
}

async function sendOvernightAcSummary(to, { storeName, timeLinesBlock }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.overnightAcSummary, [
        storeName || 'PickleVibes',
        timeLinesBlock || '',
      ]),
    openWaText,
  });
}

async function sendApplicationNotify(to, { submissionId, body }, openWaText) {
  return guardedSend(to, {
    cloudSend: () =>
      sendViaCloudTemplate(to, templates.applicationNotify, [
        submissionId || '',
        body || '',
      ]),
    openWaText,
  });
}

/** Legacy: 純文字（OpenWA only） */
async function sendTextMessage(to, text) {
  return guardedSend(to, {
    cloudSend: async () => {
      const err = new Error('純文字訊息需使用 template；請改用對應 sendXxx 方法');
      err.code = 'CLOUD_TEXT_NOT_SUPPORTED';
      throw err;
    },
    openWaText: text,
  });
}

async function sendTextToMany(phones, text) {
  const provider = resolveProvider();
  if (!provider) return { skipped: true, reason: 'not_configured' };
  if (provider === 'openwa') return openWa.sendTextToMany(phones, text);
  const results = [];
  for (const phone of phones) {
    results.push({ phone, ok: false, error: 'batch text not supported on cloud; use template' });
  }
  return results;
}

module.exports = {
  resolveProvider,
  isWhatsAppConfigured,
  isValidPhoneNumber,
  sendBookingConfirmed,
  sendBookingAccess,
  sendBookingCancelled,
  sendCoachClassAssigned,
  sendCoachClassReminder,
  sendOvernightNewBooking,
  sendOvernightAcSummary,
  sendApplicationNotify,
  sendTextMessage,
  sendTextToMany,
};
