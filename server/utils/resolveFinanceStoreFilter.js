/**
 * 解析財務／會計 API 的店鋪篩選
 * - 平台 admin：可用 query.store；缺省 = 全部店鋪
 * - 店鋪員工：必須在其 managedStores；缺省且只有一間則自動鎖定
 */
function resolveFinanceStoreFilter(req) {
  const requested = req.query.store || req.query.storeId || null;
  const ta = req.tenantAccess;

  if (!ta || ta.isPlatformAdmin) {
    return { ok: true, storeId: requested || null };
  }

  const ids = (ta.managedStoreIds || []).map((id) => String(id));
  if (ids.length === 0) {
    return { ok: false, status: 403, message: '無店鋪管理權限' };
  }

  if (requested) {
    if (!ids.includes(String(requested))) {
      return { ok: false, status: 403, message: '無權限存取此店鋪會計資料' };
    }
    return { ok: true, storeId: requested };
  }

  if (ids.length === 1) {
    return { ok: true, storeId: ids[0] };
  }

  return { ok: false, status: 400, message: '請指定店鋪' };
}

module.exports = { resolveFinanceStoreFilter };
