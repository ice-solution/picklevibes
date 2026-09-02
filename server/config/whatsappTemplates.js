/**
 * WhatsApp Cloud API template names（Meta 已審批）
 * 可用 .env 覆寫個別 template name
 */
function tpl(name, envKey) {
  return String(process.env[envKey] || name).trim();
}

const DEFAULT_LANGUAGE = String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'zh_HK').trim();

module.exports = {
  language: DEFAULT_LANGUAGE,
  bookingConfirmed: tpl('booking_confirmed', 'WHATSAPP_TEMPLATE_BOOKING_CONFIRMED'),
  bookingAccess: tpl('booking_access', 'WHATSAPP_TEMPLATE_BOOKING_ACCESS'),
  bookingCancelled: tpl('booking_cancelled', 'WHATSAPP_TEMPLATE_BOOKING_CANCELLED'),
  coachClassAssigned: tpl('coach_class_assigned', 'WHATSAPP_TEMPLATE_COACH_ASSIGNED'),
  coachClassReminder: tpl('coach_class_reminder', 'WHATSAPP_TEMPLATE_COACH_REMINDER'),
  overnightNewBooking: tpl('overnight_new_booking', 'WHATSAPP_TEMPLATE_OVERNIGHT_NEW'),
  overnightAcSummary: tpl('overnight_ac_summary', 'WHATSAPP_TEMPLATE_OVERNIGHT_SUMMARY'),
  applicationNotify: tpl('application_notify', 'WHATSAPP_TEMPLATE_APPLICATION_NOTIFY'),
};
