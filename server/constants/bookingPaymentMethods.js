/** 待結算 Hold 場 — 現場／外部收款方式 */
const BOOKING_EXTERNAL_PAYMENT_METHODS = ['cash', 'kpay', 'fps', 'bank_transfer', 'other'];

const BOOKING_PAYMENT_METHOD_LABELS = {
  stripe: 'Stripe',
  cash: '現金',
  kpay: 'KPay',
  fps: 'FPS 轉數快',
  bank_transfer: '銀行轉帳',
  other: '其他',
  points: '積分',
  admin_waived: '管理員留場',
};

function isExternalPaymentMethod(method) {
  return BOOKING_EXTERNAL_PAYMENT_METHODS.includes(method);
}

function bookingPaymentMethodLabel(method) {
  return BOOKING_PAYMENT_METHOD_LABELS[method] || method || '—';
}

module.exports = {
  BOOKING_EXTERNAL_PAYMENT_METHODS,
  BOOKING_PAYMENT_METHOD_LABELS,
  isExternalPaymentMethod,
  bookingPaymentMethodLabel,
};
