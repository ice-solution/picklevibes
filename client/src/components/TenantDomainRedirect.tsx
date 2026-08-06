import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStoreTenantHost } from '../contexts/StoreTenantHostContext';

/**
 * 自訂域名導向：lck.pickcourt.hk → 店鋪公開頁；admin.lck.pickcourt.hk → 店鋪後台
 */
export default function TenantDomainRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, resolved, tenant, isAdminHost } = useStoreTenantHost();

  useEffect(() => {
    if (loading || !resolved || !tenant?.slug) return;

    const slug = tenant.slug;
    const publicPrefix = `/${slug}`;
    const legacyStorePrefix = `/store/${slug}`;
    const adminPrefix = `${legacyStorePrefix}/admin`;
    const storeLoginPath = `${legacyStorePrefix}/login`;
    const path = location.pathname;

    // 舊路徑 /store/:slug → /:slug（店鋪介紹 canonical）
    if (path === legacyStorePrefix || path === `${legacyStorePrefix}/`) {
      navigate(`${publicPrefix}${location.search}`, { replace: true });
      return;
    }

    if (path.startsWith(publicPrefix) || path.startsWith(legacyStorePrefix)) return;

    if (isAdminHost) {
      if (path === '/login') {
        navigate(`${storeLoginPath}${location.search}`, { replace: true });
        return;
      }
      if (path === '/' || path === '/admin' || path.startsWith('/admin/')) {
        const rest = path === '/' || path === '/admin' ? '' : path.slice('/admin'.length);
        navigate(`${adminPrefix}${rest}${location.search}`, { replace: true });
      }
      return;
    }

    if (path === '/') {
      navigate(`${publicPrefix}${location.search}`, { replace: true });
      return;
    }

    if (path === '/admin' || path.startsWith('/admin/')) {
      const rest = path === '/admin' ? '' : path.slice('/admin'.length);
      navigate(`${adminPrefix}${rest}${location.search}`, { replace: true });
    }
  }, [loading, resolved, tenant, isAdminHost, location.pathname, location.search, navigate]);

  return null;
}
