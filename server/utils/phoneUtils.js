/** 只保留數字 */
function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** 香港電話正規化為 8 位本地號碼（例如 91234567） */
function normalizeHkPhone(phone) {
  let d = digitsOnly(phone);
  if (d.startsWith('852')) d = d.slice(3);
  return d;
}

/** 產生常見儲存格式變體，用於資料庫查詢 */
function phoneLookupVariants(phone) {
  const hk = normalizeHkPhone(phone);
  if (!hk) return [];
  const set = new Set([hk, `852${hk}`, `+852${hk}`]);
  return [...set];
}

module.exports = {
  digitsOnly,
  normalizeHkPhone,
  phoneLookupVariants,
};
