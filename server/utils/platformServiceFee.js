/**
 * 消費者平台服務費：按店鋪佣成％ × 優惠後場租（VIP／兌換碼後）。
 * VIP 場租可優惠，服務費照收。
 */
function computePlatformServiceFee(payableAfterDiscount, platformFeePercent) {
  const base = Math.max(0, Math.round(Number(payableAfterDiscount) || 0));
  const pct = Math.min(100, Math.max(0, Number(platformFeePercent) || 0));
  if (base <= 0 || pct <= 0) {
    return { fee: 0, percent: pct, base, total: base };
  }
  const fee = Math.round((base * pct) / 100);
  return { fee, percent: pct, base, total: base + fee };
}

module.exports = {
  computePlatformServiceFee,
};
