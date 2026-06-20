const { loadTenantAccess, canAccessStore } = require('../utils/tenantAccess');

/** 附加 req.tenantAccess（須在 auth 之後） */
async function attachTenantAccess(req, res, next) {
  try {
    if (req.user) {
      req.tenantAccess = await loadTenantAccess(req.user);
    }
    next();
  } catch (error) {
    console.error('attachTenantAccess 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
}

/** 平台超級管理員（role === admin） */
function platformAdminAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '訪問被拒絕，需要平台管理員權限' });
  }
  next();
}

/** 拒絕存取指定店鋪時回傳 403 */
function requireStoreAccess(storeId) {
  return (req, res, next) => {
    if (!req.tenantAccess) {
      return res.status(500).json({ message: '權限上下文未載入' });
    }
    if (!canAccessStore(req.tenantAccess, storeId)) {
      return res.status(403).json({ message: '無權限存取此店鋪' });
    }
    next();
  };
}

/** 從 req.params / body / query 解析 storeId 並驗證 */
function requireStoreAccessFromRequest(getStoreId) {
  return (req, res, next) => {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(400).json({ message: '缺少店鋪 ID' });
    }
    if (!canAccessStore(req.tenantAccess, storeId)) {
      return res.status(403).json({ message: '無權限存取此店鋪' });
    }
    next();
  };
}

module.exports = {
  attachTenantAccess,
  platformAdminAuth,
  requireStoreAccess,
  requireStoreAccessFromRequest,
};
