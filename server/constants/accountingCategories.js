/** 手動收支類別（與 admin_picklevibes_upload_data 一致） */
const ACCOUNTING_CATEGORIES = ['場租', '器材', '營運', '課程收入', '活動', '薪資', '其他'];

function isAllowedAccountingCategory(value) {
  return ACCOUNTING_CATEGORIES.includes(String(value || '').trim());
}

function isValidAccountingCategoryForUpdate(value, previousCategory) {
  if (isAllowedAccountingCategory(value)) return true;
  if (previousCategory == null) return false;
  return String(value || '').trim() === String(previousCategory).trim();
}

module.exports = {
  ACCOUNTING_CATEGORIES,
  isAllowedAccountingCategory,
  isValidAccountingCategoryForUpdate,
};
