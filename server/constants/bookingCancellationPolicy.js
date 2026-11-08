/**
 * @deprecated 請用 resolveStoreBookingPolicies(store)；保留常數以相容舊 import
 */
const {
  DEFAULT_CANCELLATION_LINES,
  buildCancellationPolicyHtml,
  buildCancellationPolicyText,
} = require('../utils/storeBookingPolicies');

const BOOKING_CANCELLATION_POLICY_LINES = DEFAULT_CANCELLATION_LINES;
const BOOKING_CANCELLATION_POLICY_HTML = buildCancellationPolicyHtml(DEFAULT_CANCELLATION_LINES);
const BOOKING_CANCELLATION_POLICY_TEXT = buildCancellationPolicyText(DEFAULT_CANCELLATION_LINES);

module.exports = {
  BOOKING_CANCELLATION_POLICY_LINES,
  BOOKING_CANCELLATION_POLICY_HTML,
  BOOKING_CANCELLATION_POLICY_TEXT,
};
