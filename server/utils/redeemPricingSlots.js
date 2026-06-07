const { SLOT_NAME_OPTIONS } = require('./courtPricing');

function normalizeApplicablePricingSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return [];
  return [...new Set(slots.filter((s) => SLOT_NAME_OPTIONS.includes(s)))];
}

function hasPricingSlotRestriction(redeemCode) {
  return Array.isArray(redeemCode?.applicablePricingSlots)
    && redeemCode.applicablePricingSlots.length > 0;
}

function isPricingSlotAllowed(redeemCode, pricingSlotName) {
  if (!hasPricingSlotRestriction(redeemCode)) return true;
  if (!pricingSlotName) return false;
  return redeemCode.applicablePricingSlots.includes(pricingSlotName);
}

function pricingSlotRestrictionLabel(redeemCode) {
  return (redeemCode.applicablePricingSlots || []).join('、');
}

module.exports = {
  SLOT_NAME_OPTIONS,
  normalizeApplicablePricingSlots,
  hasPricingSlotRestriction,
  isPricingSlotAllowed,
  pricingSlotRestrictionLabel,
};
