/** @returns {'stripe' | 'wonder'} — 與 checkinSystem 一致用 PAYMENT_GATEWAY，預設 wonder */
function getPaymentProvider() {
  const v = (
    process.env.PAYMENT_GATEWAY ||
    process.env.PAYMENT_PROVIDER ||
    'wonder'
  )
    .toString()
    .trim()
    .toLowerCase();
  return v === 'stripe' ? 'stripe' : 'wonder';
}

function isWonderPayment() {
  return getPaymentProvider() === 'wonder';
}

function isPaymentDev() {
  const dev = (process.env.PAYMENT_DEV || process.env.payment_dev || '').toString().trim().toLowerCase();
  return dev === 'true' || dev === '1';
}

module.exports = { getPaymentProvider, isWonderPayment, isPaymentDev };
