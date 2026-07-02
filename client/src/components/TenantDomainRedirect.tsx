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
    const storePrefix = `/store/${slug}`;
    const adminPrefix = `${storePrefix}/admin`;
    const storeLoginPath = `${storePrefix}/login`;
    const path = location.pathname;

    if (path.startsWith(storePrefix)) return;

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
      navigate(`${storePrefix}${location.search}`, { replace: true });
      return;
    }

    if (path === '/admin' || path.startsWith('/admin/')) {
      const rest = path === '/admin' ? '' : path.slice('/admin'.length);
      navigate(`${adminPrefix}${rest}${location.search}`, { replace: true });
    }
  }, [loading, resolved, tenant, isAdminHost, location.pathname, location.search, navigate]);

  return null;
}
