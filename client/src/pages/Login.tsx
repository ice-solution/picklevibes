import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams, type Location } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { getPostAuthRedirectPath, parseStoreSlugFromAdminPath, parseStoreSlugFromStorePath, type PostAuthRedirectFrom } from '../utils/authRedirect';
import { useDocumentStoreBrand } from '../hooks/useDocumentStoreBrand';
import { useStoreTenantHost } from '../contexts/StoreTenantHostContext';
import {
  getStoreDisplayName,
  getStoreLogoPath,
  storeBrandStyles,
  storePrimaryColor,
  STORE_BRAND_CLASS,
} from '../utils/storeBrandUtils';
import StoreBrandLogo from '../components/StoreBrandLogo';

type StoreLoginBrand = {
  name: string;
  slug: string;
  branding?: {
    displayName?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
};

type LoginProps = {
  /** 在 /store/:slug/admin 內嵌登入時由父層傳入 */
  storeContextSlug?: string;
  defaultRedirect?: PostAuthRedirectFrom;
};

const Login: React.FC<LoginProps> = ({ storeContextSlug, defaultRedirect }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [storeBrand, setStoreBrand] = useState<StoreLoginBrand | null>(null);
  const [storeBrandLoading, setStoreBrandLoading] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { storeSlug: paramSlug } = useParams<{ storeSlug?: string }>();
  const { tenant: hostTenant, resolved: hostResolved, host: requestHost } = useStoreTenantHost();
  const redirectFrom =
    (location.state as { from?: Location } | null)?.from ?? defaultRedirect;

  const storeSlug = useMemo(() => {
    if (storeContextSlug) return storeContextSlug.toLowerCase();
    const fromSearch = new URLSearchParams(location.search).get('store');
    const fromPath =
      paramSlug ||
      fromSearch ||
      parseStoreSlugFromStorePath(location.pathname) ||
      parseStoreSlugFromAdminPath(redirectFrom?.pathname) ||
      null;
    if (fromPath) return fromPath.toLowerCase();
    if (hostResolved && hostTenant?.slug) return hostTenant.slug.toLowerCase();
    return null;
  }, [
    storeContextSlug,
    paramSlug,
    location.pathname,
    location.search,
    redirectFrom?.pathname,
    hostResolved,
    hostTenant?.slug,
  ]);

  const isStoreLogin = Boolean(storeSlug) || (hostResolved && Boolean(hostTenant?.slug));

  useEffect(() => {
    if (!storeSlug) {
      setStoreBrand(null);
      return;
    }
    const slug = storeSlug;
    let cancelled = false;
    setStoreBrandLoading(true);

    const applyBrand = (data: StoreLoginBrand | null) => {
      if (!cancelled) setStoreBrand(data);
    };

    const mapStoreToBrand = (s: {
      name: string;
      slug: string;
      branding?: StoreLoginBrand['branding'];
      logoUrl?: string;
      primaryColor?: string;
    }): StoreLoginBrand => ({
      name: s.name,
      slug: s.slug,
      branding: {
        displayName: s.branding?.displayName || s.name,
        logoUrl: s.branding?.logoUrl || s.logoUrl || '',
        primaryColor: s.branding?.primaryColor || s.primaryColor || '',
      },
    });

    async function loadBrand() {
      if (hostResolved) {
        const host = requestHost || window.location.hostname;
        if (host && host !== 'localhost' && host !== '127.0.0.1') {
          try {
            const res = await axios.get('/stores/login-brand-by-host', {
              params: { host },
            });
            if (res.data?.store) {
              applyBrand(res.data.store);
              return;
            }
          } catch {
            /* try slug-based */
          }
        }
      }

      try {
        const res = await axios.get(`/stores/by-slug/${encodeURIComponent(slug)}/login-brand`);
        if (res.data?.store) {
          applyBrand(res.data.store);
          return;
        }
      } catch {
        /* try next */
      }

      try {
        const res = await axios.get(`/stores/by-slug/${encodeURIComponent(slug)}`, {
          params: { forLogin: '1' },
        });
        if (res.data?.store) {
          applyBrand(mapStoreToBrand(res.data.store));
          return;
        }
      } catch {
        /* try next */
      }

      try {
        const res = await axios.get(`/platform/stores/${encodeURIComponent(slug)}`);
        const s = res.data?.store;
        if (s) {
          applyBrand({
            name: s.name,
            slug: s.slug,
            branding: {
              displayName: s.name,
              logoUrl: s.logoUrl || '',
              primaryColor: s.primaryColor || '',
            },
          });
          return;
        }
      } catch {
        /* ignore */
      }

      if (hostResolved && hostTenant?.slug === slug && hostTenant.branding) {
        applyBrand({
          name: hostTenant.name || slug,
          slug: hostTenant.slug,
          branding: {
            displayName: hostTenant.branding.displayName || hostTenant.name || slug,
            logoUrl: hostTenant.branding.logoUrl || '',
            primaryColor: hostTenant.branding.primaryColor || '',
          },
        });
        return;
      }

      applyBrand(null);
    }

    void loadBrand().finally(() => {
      if (!cancelled) setStoreBrandLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [storeSlug, hostResolved, hostTenant, requestHost]);

  const tenantBrand =
    hostResolved && hostTenant?.branding ? hostTenant.branding : undefined;

  const mergedBrand = useMemo(() => {
    if (storeBrand) {
      return {
        ...storeBrand,
        branding: {
          ...tenantBrand,
          ...storeBrand.branding,
        },
      };
    }
    if (hostResolved && hostTenant?.slug) {
      const b = hostTenant.branding || {};
      return {
        name: b.displayName || hostTenant.name || hostTenant.slug,
        slug: hostTenant.slug,
        branding: {
          displayName: b.displayName || hostTenant.name || hostTenant.slug,
          logoUrl: b.logoUrl || '',
          primaryColor: b.primaryColor || '',
        },
      };
    }
    return null;
  }, [storeBrand, hostResolved, hostTenant]);

  const primaryColor = storePrimaryColor(mergedBrand);
  const brandStyles = storeBrandStyles(primaryColor);
  const logoPath = getStoreLogoPath(mergedBrand);
  const displayName = getStoreDisplayName(mergedBrand, storeSlug || '店鋪');

  useDocumentStoreBrand(isStoreLogin ? primaryColor : null);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(getPostAuthRedirectPath(redirectFrom, user), { replace: true });
    }
  }, [authLoading, user, redirectFrom, navigate]);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setFormData((prev) => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.email.trim()) {
      newErrors.email = '電子郵件為必填項目';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '請輸入有效的電子郵件地址';
    }

    if (!formData.password.trim()) {
      newErrors.password = '密碼為必填項目';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const loggedInUser = await login(formData.email, formData.password);

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', formData.email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      navigate(getPostAuthRedirectPath(redirectFrom, loggedInUser), { replace: true });
    } catch (error: unknown) {
      const err = error as { message?: string };
      setErrors({ general: err.message || '登入失敗' });
    } finally {
      setIsLoading(false);
    }
  };

  const registerState = redirectFrom ? { from: redirectFrom } : undefined;

  return (
    <div
      className={`min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ${
        isStoreLogin ? STORE_BRAND_CLASS : ''
      }`}
      style={isStoreLogin ? brandStyles : undefined}
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {isStoreLogin ? (
            <div className="flex flex-col items-center">
              {storeBrandLoading ? (
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gray-100 animate-pulse" />
              ) : (
                <StoreBrandLogo
                  logoPath={logoPath}
                  displayName={displayName}
                  primaryColor={primaryColor}
                />
              )}
              <h2 className="mt-6 text-2xl sm:text-3xl font-bold text-gray-900">
                登入 {displayName}
              </h2>
              <p className="mt-2 text-sm text-gray-600">店鋪員工後台</p>
            </div>
          ) : (
            <>
              <Link to="/" className="flex items-center justify-center">
                <img src="/pickcourt_logo.jpg" alt="PickCourt" className="h-14 w-auto object-contain" />
              </Link>
              <h2 className="mt-6 text-3xl font-bold text-gray-900">登入 PickCourt</h2>
              <p className="mt-2 text-sm text-gray-600">
                或者{' '}
                <Link
                  to="/register"
                  state={registerState}
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200"
                >
                  創建新帳戶
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{errors.general}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                電子郵件地址
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input-field ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="請輸入您的電子郵件"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                密碼
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input-field pr-10 ${
                    errors.password ? 'border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="請輸入您的密碼"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                  記住我
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200"
                >
                  忘記密碼？
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-colors duration-200 ${
                  isLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                }`}
              >
                {isLoading ? '登入中...' : '登入'}
              </button>
            </div>
          </form>

          {isStoreLogin && storeSlug && (
            <p className="mt-6 text-center text-xs text-gray-500">
              <Link to={`/store/${storeSlug}`} className="text-primary-600 hover:underline">
                返回店鋪公開頁
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
