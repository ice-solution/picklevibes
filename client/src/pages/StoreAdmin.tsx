import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { StoreAdminProvider, useStoreAdmin } from '../contexts/StoreAdminContext';
import Login from './Login';
import { canAccessStoreAdmin } from '../utils/authRedirect';

import StoreIntroSettings from '../components/Admin/StoreIntroSettings';
import BookingManagement from '../components/Admin/BookingManagement';
import BookingCalendar from '../components/Admin/BookingCalendar';
import CoachScheduleRequestManagement from '../components/Admin/CoachScheduleRequestManagement';
import CoachClassManagement from '../components/Admin/CoachClassManagement';
import CourtManagement from '../components/Admin/CourtManagement';
import RedeemCodeManagement from '../components/Admin/RedeemCodeManagement';
import RechargeOfferManagement from '../components/Admin/RechargeOfferManagement';
import ActivityManagement from '../components/Admin/ActivityManagement';
import RegularActivityManagement from '../components/Admin/RegularActivityManagement';
import HolidayManagement from '../components/Admin/WeekendManagement';
import BookingConfig from '../components/Admin/BookingConfig';
import AccountingManagement from '../components/Admin/AccountingManagement';
import { resolveMediaUrl, storeBrandStyles, storePrimaryColor, STORE_BRAND_CLASS } from '../utils/storeBrandUtils';
import { useDocumentStoreBrand } from '../hooks/useDocumentStoreBrand';
import { PICKCOURT_HOME } from '../utils/pickcourtRoutes';

import {
  Bars3Icon,
  XMarkIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  TicketIcon,
  CreditCardIcon,
  CalendarIcon,
  ClockIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  BuildingStorefrontIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

type Tab = {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  element: React.ReactNode;
};

function StoreAdminShell() {
  const { user, logout } = useAuth();
  const { storeSlug = '', store, loading, error } = useStoreAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('bookings');
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPlatformAdmin = user?.isPlatformAdmin || user?.role === 'admin';

  const tabs: Tab[] = useMemo(
    () => [
      { id: 'intro', name: '店鋪介紹', icon: BuildingStorefrontIcon, element: <StoreIntroSettings /> },
      { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon, element: <BookingManagement /> },
      { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: <BookingCalendar /> },
      { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: <CourtManagement /> },
      { id: 'activities', name: '活動中心', icon: CalendarIcon, element: <ActivityManagement /> },
      { id: 'regular-activities', name: '恆常活動', icon: CalendarIcon, element: <RegularActivityManagement /> },
      { id: 'redeem', name: '兌換券', icon: TicketIcon, element: <RedeemCodeManagement /> },
      { id: 'recharge-offers', name: '充值優惠', icon: CreditCardIcon, element: <RechargeOfferManagement /> },
      { id: 'accounting', name: '會計／用量', icon: CurrencyDollarIcon, element: <AccountingManagement /> },
      { id: 'coach-requests', name: '教練要請', icon: ChatBubbleLeftRightIcon, element: <CoachScheduleRequestManagement /> },
      { id: 'coach-classes', name: '教練課堂', icon: AcademicCapIcon, element: <CoachClassManagement /> },
      { id: 'weekend', name: '假期管理', icon: ClockIcon, element: <HolidayManagement /> },
      { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: <BookingConfig /> },
    ],
    []
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const current = tabs.find((t) => t.id === activeTab) || tabs[0];

  const primaryColor = store ? storePrimaryColor(store) : undefined;
  useDocumentStoreBrand(primaryColor);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">店鋪不存在</h1>
          <Link to={PICKCOURT_HOME} className="text-primary-600 mt-4 inline-block">返回 PickCourt</Link>
        </div>
      </div>
    );
  }

  const displayName = store.branding?.displayName || store.name;
  const logoSrc = resolveMediaUrl(store.branding?.logoUrl);
  const brandStyles = storeBrandStyles(primaryColor!);

  const BrandHeader = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-3 min-w-0">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={displayName}
          className={`object-contain rounded-lg shrink-0 bg-white/90 ${compact ? 'h-9 w-9 p-0.5' : 'h-11 w-11 p-1 shadow-sm border border-gray-100'}`}
        />
      ) : (
        <div
          className={`rounded-lg shrink-0 flex items-center justify-center text-white font-bold ${compact ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base'}`}
          style={{ backgroundColor: primaryColor }}
        >
          {displayName.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <div className={`font-bold text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>{displayName}</div>
        <div className="text-xs text-gray-500 truncate">店鋪後台 · {store.slug}</div>
      </div>
    </div>
  );

  const Nav = ({ onSelect }: { onSelect?: () => void }) => (
    <nav className="px-3 py-4 space-y-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.id === current.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              setSearchParams({ tab: t.id });
              onSelect?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
              active ? 'border-transparent' : 'border-transparent text-gray-700 hover:bg-gray-50'
            }`}
            style={
              active
                ? {
                    backgroundColor: 'var(--store-primary-soft)',
                    color: 'var(--store-primary)',
                    borderColor: 'var(--store-primary-border)',
                  }
                : undefined
            }
          >
            <Icon
              className={`w-5 h-5 ${active ? '' : 'text-gray-500'}`}
              style={active ? { color: 'var(--store-primary)' } : undefined}
            />
            <span className="truncate">{t.name}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className={`${STORE_BRAND_CLASS} bg-gray-50 min-h-screen flex flex-col overflow-hidden`} style={brandStyles}>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[18rem] max-w-[85vw] bg-white shadow-xl border-r flex flex-col">
            <div
              className="flex items-center justify-between px-4 h-16 border-b gap-2"
              style={{ borderBottomColor: 'var(--store-primary-border)' }}
            >
              <div className="min-w-0 flex-1"><BrandHeader /></div>
              <button type="button" onClick={() => setMobileOpen(false)}><XMarkIcon className="w-6 h-6 shrink-0" /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><Nav onSelect={() => setMobileOpen(false)} /></div>
            <div className="p-3 border-t text-xs text-gray-500 space-y-2" style={{ borderTopColor: 'var(--store-primary-border)' }}>
              <Link to={`/store/${store.slug}`} className="block text-primary-600 hover:underline" onClick={() => setMobileOpen(false)}>
                查看公開頁
              </Link>
              <button type="button" onClick={() => { setMobileOpen(false); logout(); }} className="block text-red-600 hover:underline">
                登出
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="hidden lg:flex lg:flex-col lg:w-72 shrink-0 bg-white border-r min-h-0">
          <div
            className="h-[4.25rem] flex items-center px-5 border-b"
            style={{
              borderBottomColor: 'var(--store-primary-border)',
              background: `linear-gradient(135deg, var(--store-primary-soft) 0%, white 72%)`,
            }}
          >
            <BrandHeader />
          </div>
          <div className="flex-1 overflow-y-auto"><Nav /></div>
          <div className="p-3 border-t text-xs text-gray-500 space-y-2" style={{ borderTopColor: 'var(--store-primary-border)' }}>
            {isPlatformAdmin && (
              <Link to="/admin-v2" className="flex items-center gap-1 text-primary-600 hover:underline">
                <ArrowLeftIcon className="w-4 h-4" /> 平台管理後台
              </Link>
            )}
            <Link to={`/store/${store.slug}`} className="block text-primary-600 hover:underline">
              查看公開頁
            </Link>
            <button
              type="button"
              onClick={logout}
              className="block w-full text-left text-red-600 hover:underline"
            >
              登出
            </button>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header
            className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6 shrink-0"
            style={{ borderBottomColor: 'var(--store-primary-border)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <button type="button" className="lg:hidden p-2 -ml-2" onClick={() => setMobileOpen(true)}>
                <Bars3Icon className="w-6 h-6" />
              </button>
              <div className="lg:hidden min-w-0">
                <BrandHeader compact />
              </div>
              <div className="hidden lg:flex items-center gap-3 min-w-0">
                {logoSrc ? (
                  <img src={logoSrc} alt="" className="h-8 w-8 object-contain rounded shrink-0" />
                ) : (
                  <div
                    className="h-8 w-8 rounded shrink-0 flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{store.district || '香港'}</div>
                  <div className="font-semibold truncate">{current.name}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-gray-600 truncate max-w-[8rem] sm:max-w-none">{user?.name}</span>
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors shrink-0"
              >
                登出
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {current.element}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

const StoreAdmin: React.FC = () => {
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    const adminPath = { pathname: `/store/${storeSlug}/admin`, search: '', hash: '' };
    return (
      <Login
        storeContextSlug={storeSlug}
        defaultRedirect={adminPath}
      />
    );
  }

  if (!canAccessStoreAdmin(user, storeSlug)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-xl font-bold">無權限存取此店鋪後台</h1>
          <Link to={PICKCOURT_HOME} className="text-primary-600 mt-4 inline-block">返回首頁</Link>
        </div>
      </div>
    );
  }

  return (
    <StoreAdminProvider storeSlug={storeSlug}>
      <StoreAdminShell />
    </StoreAdminProvider>
  );
};

export default StoreAdmin;
