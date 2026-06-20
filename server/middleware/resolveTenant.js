const {
  resolveTenantFromRequest,
  attachTenantToRequest,
} = require('../utils/tenantResolver');

/**
 * 解析當前請求的 SaaS tenant（Store）
 * 成功：req.tenant、req.tenantId、req.tenantSource
 *
 * @param {{ required?: boolean }} options
 */
function resolveTenant(options = {}) {
  const { required = false, saasOnly = false } = options;

  return async (req, res, next) => {
    try {
      const resolved = await resolveTenantFromRequest(req, { saasOnly });
      if (resolved) {
        attachTenantToRequest(req, resolved);
      }

      if (required && !req.tenantId) {
        return res.status(400).json({
          message: '無法識別店鋪（tenant）；請提供 storeSlug、域名或 X-Tenant-Slug',
        });
      }

      next();
    } catch (error) {
      console.error('resolveTenant 錯誤:', error);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  };
}

module.exports = { resolveTenant };
