/** 衣服類商品可選尺碼（與前端一致） */
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

function normalizeClothingSize(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const u = raw.trim().toUpperCase();
  return CLOTHING_SIZES.includes(u) ? u : null;
}

module.exports = { CLOTHING_SIZES, normalizeClothingSize };
