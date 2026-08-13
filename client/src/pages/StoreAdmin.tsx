import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { StoreAdminProvider, useStoreAdmin } from '../contexts/StoreAdminContext';
import Login from './Login';
import {
  canAccessStoreAdmin,
  getMembershipRoleForStore,
  storeRoleLabel,
} from '../utils/authRedirect';
import { canAccessStoreTab } from '../utils/storeAdminPermissions';

import BookingManagement from '../components/Admin/BookingManagement';
import BookingCalendar from '../components/Admin/BookingCalendar';
import CourtManagement from '../components/Admin/CourtManagement';
import RedeemCodeManagement from '../components/Admin/RedeemCodeManagement';
import RechargeOfferManagement from '../components/Admin/RechargeOfferManagement';
import ActivityManagement from '../components/Admin/ActivityManagement';
import RegularActivityManagement from '../components/Admin/RegularActivityManagement';
import HolidayManagement from '../components/Admin/WeekendManagement';
import BookingConfig from '../components/Admin/BookingConfig';
import AccountingManagement from '../components/Admin/AccountingManagement';
import CoachScheduleRequestManagement from '../components/Admin/CoachScheduleRequestManagement';
import ShopManagement from '../components/Admin/ShopManagement';
import OrderManagement from '../components/Admin/OrderManagement';
import AnalyticsDashboard from '../components/Admin/AnalyticsDashboard';
import ReportManagement from '../components/Admin/ReportManagement';

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
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  ShoppingBagIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';

type Tab = {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  element: React.ReactNode;
};

function StoreAdminShell() {
  const { user, logout } = useAuth();
  const { storeSlug = '', store, loading, error, membershipRole, readOnly } = useStoreAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('calendar');
  const [mobileOpen, setMobileOpen] = useState(false);

  const allTabs: Tab[] = useMemo(
    () => [
      { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon, element: <BookingManagement /> },
      { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: <BookingCalendar /> },
      { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: <CourtManagement /> },
      { id: 'shop', name: '商店管理', icon: ShoppingBagIcon, element: <ShopManagement /> },
      { id: 'orders', name: '訂單管理', icon: ShoppingBagIcon, element: <OrderManagement /> },
      { id: 'activities', name: '活動管理', icon: CalendarIcon, element: <ActivityManagement /> },
      {
        id: 'regular-activities',
        name: '恆常活動管理',
        icon: CalendarIcon,
        element: <RegularActivityManagement />,
      },
      { id: 'redeem', name: '兌換券', icon: TicketIcon, element: <RedeemCodeManagement /> },
      {
        id: 'recharge-offers',
        name: '充值優惠',
        icon: CreditCardIcon,
        element: <RechargeOfferManagement />,
      },
      { id: 'analytics', name: '數據分析', icon: DocumentChartBarIcon, element: <AnalyticsDashboard /> },
      { id: 'reports', name: '報告', icon: DocumentChartBarIcon, element: <ReportManagement /> },
      { id: 'accounting', name: '會計', icon: CurrencyDollarIcon, element: <AccountingManagement /> },
      {
        id: 'coach-requests',
        name: '教練要請',
        icon: ChatBubbleLeftRightIcon,
        element: <CoachScheduleRequestManagement />,
      },
      { id: 'weekend', name: '假期管理', icon: ClockIcon, element: <HolidayManagement /> },
      { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: <BookingConfig /> },
    ],
    []
  );

  const tabs = useMemo(
    () => allTabs.filter((t) => canAccessStoreTab(membershipRole, t.id)),
    [allTabs, membershipRole]
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) {
      if (tabs[0] && activeTab !== tabs[0].id && !tabs.some((t) => t.id === activeTab)) {
        setActiveTab(tabs[0].id);
      }
      return;
    }
    if (tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab(tabs[0]?.id || 'calendar');
    }
  }, [searchParams, tabs, activeTab]);

  const current = tabs.find((t) => t.id === activeTab) || tabs[0];
  const roleLabel = storeRoleLabel(membershipRole);

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setSearchParams({ tab: tab.id });
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {tab.name}
          </button>
        );
      })}
    </>
  );

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
          <Link to="/" className="text-primary-600 mt-4 inline-block">
            返回首頁
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:flex">
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-500">店鋪後台</p>
            <h1 className="font-bold text-gray-900 truncate">{store.name}</h1>
            <p className="text-xs text-primary-600 mt-1">{roleLabel}</p>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            <NavItems />
          </nav>
          <div className="p-4 border-t border-gray-100 space-y-2">
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            <button type="button" onClick={logout} className="text-sm text-red-600 hover:text-red-700">
              登出
            </button>
          </div>
        </aside>

        <div className="lg:pl-64 flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 truncate">{store.name}</h1>
              <p className="text-xs text-primary-600">{roleLabel}</p>
            </div>
            <button type="button" onClick={() => setMobileOpen(true)} className="p-2">
              <Bars3Icon className="h-6 w-6" />
            </button>
          </header>

          {mobileOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
              <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold">{store.name}</span>
                  <button type="button" onClick={() => setMobileOpen(false)}>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto">
                  <NavItems onNavigate={() => setMobileOpen(false)} />
                </nav>
              </div>
            </div>
          )}

          <main className="p-4 sm:p-6 lg:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-900">{current?.name}</h2>
              {user?.role === 'admin' && (
                <Link
                  to="/admin-v2"
                  className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-primary-600"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  平台後台
                </Link>
              )}
            </div>
            {membershipRole === 'staff' && (
              <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                店員權限：預約日曆、商店、訂單、活動與恆常活動。
              </p>
            )}
            {readOnly && (
              <p className="mb-4 text-sm text-slate-800 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                股東帳號為唯讀：可查看數據分析、報告、會計與預約日曆，無法新增或修改資料。
              </p>
            )}
            <motion.div
              key={current?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={readOnly ? 'pointer-events-none opacity-95 select-none' : undefined}
              aria-disabled={readOnly || undefined}
            >
              {current?.element}
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
    return <Login />;
  }

  if (!canAccessStoreAdmin(user, storeSlug)) {
    return <Navigate to="/" replace />;
  }

  const membershipRole = getMembershipRoleForStore(user, storeSlug);

  return (
    <StoreAdminProvider storeSlug={storeSlug} membershipRole={membershipRole}>
      <StoreAdminShell />
    </StoreAdminProvider>
  );
};

export default StoreAdmin;
