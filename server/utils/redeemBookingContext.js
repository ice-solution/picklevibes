const Court = require('../models/Court');
const {
  isPricingSlotAllowed,
  pricingSlotRestrictionLabel,
  hasPricingSlotRestriction,
} = require('./redeemPricingSlots');

async function resolveBookingPricingSlotName({ courtId, date, startTime, pricingSlotName }) {
  if (pricingSlotName) return pricingSlotName;
  if (!courtId || !date || !startTime) return null;

  const court = await Court.findById(courtId).select('pricing');
  if (!court) return null;
  return court.getTimeSlotName(startTime, new Date(date));
}

async function assertRedeemCodePricingSlotAllowed(redeemCode, {
  orderType,
  courtId,
  date,
  startTime,
  pricingSlotName,
}) {
  if (orderType !== 'booking') return null;
  if (!hasPricingSlotRestriction(redeemCode)) return null;

  const slotName = await resolveBookingPricingSlotName({
    courtId,
    date,
    startTime,
    pricingSlotName,
  });

  if (!slotName) {
    const err = new Error('請提供預約場地與時段以驗證兌換碼');
    err.statusCode = 400;
    throw err;
  }

  if (!isPricingSlotAllowed(redeemCode, slotName)) {
    const allowed = pricingSlotRestrictionLabel(redeemCode);
    const err = new Error(
      `此兌換碼不適用於「${slotName}」時段，僅限：${allowed}`
    );
    err.statusCode = 400;
    throw err;
  }

  return slotName;
}

module.exports = {
  resolveBookingPricingSlotName,
  assertRedeemCodePricingSlotAllowed,
};
