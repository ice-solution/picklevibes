import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultHomeForUser } from '../utils/authRedirect';

import BookingManagement from '../components/Admin/BookingManagement';
import BookingCalendar from '../components/Admin/BookingCalendar';
import CoachScheduleRequestManagement from '../components/Admin/CoachScheduleRequestManagement';
import CoachClassManagement from '../components/Admin/CoachClassManagement';
import CourtManagement from '../components/Admin/CourtManagement';
import StoreManagement from '../components/Admin/StoreManagement';
import UserManagement from '../components/Admin/UserManagement';
import TierManagement from '../components/Admin/TierManagement';
import VlogManagement from '../components/Admin/VlogManagement';
import HotNewsManagement from '../components/Admin/HotNewsManagement';
import GameHallManagement from '../components/Admin/GameHallManagement';
import GameClientManagement from '../components/Admin/GameClientManagement';
import GameLeaderboardManagement from '../components/Admin/GameLeaderboardManagement';
import RedeemCodeManagement from '../components/Admin/RedeemCodeManagement';
import RechargeOfferManagement from '../components/Admin/RechargeOfferManagement';
import ShopManagement from '../components/Admin/ShopManagement';
import OrderManagement from '../components/Admin/OrderManagement';
import MaintenanceControl from '../components/Admin/MaintenanceControl';
import ActivityManagement from '../components/Admin/ActivityManagement';
import RegularActivityManagement from '../components/Admin/RegularActivityManagement';
import HolidayManagement from '../components/Admin/WeekendManagement';
import BookingConfig from '../components/Admin/BookingConfig';
import BulkUpgrade from '../components/Admin/BulkUpgrade';
import AnalyticsDashboard from '../components/Admin/AnalyticsDashboard';
import ReportManagement from '../components/Admin/ReportManagement';
import AccountingManagement from '../components/Admin/AccountingManagement';
import EdmSend from '../components/Admin/EdmSend';
import TenantStaffManagement from '../components/Admin/TenantStaffManagement';

import {
  Bars3Icon,
  XMarkIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  UsersIcon,
  TicketIcon,
  CreditCardIcon,
  WrenchScrewdriverIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ClockIcon,
  ShoppingBagIcon,
  TagIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  IdentificationIcon,
} from '@heroicons/react/24/outline';

type Tab = {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  element: React.ReactNode;
  platformOnly?: boolean;
};

/** 平台超級管理員後台（店鋪員工請用 /store/:slug/admin） */
const AdminV2: React.FC = () => {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('bookings');
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPlatformAdmin = user?.isPlatformAdmin === true || user?.role === 'admin';
  const isStoreStaff = user?.role === 'staff' && (user?.managedStores?.length ?? 0) > 0;
  const canAccessAdmin = isPlatformAdmin;

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const allTabs: Tab[] = useMemo(() => ([
    { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon, element: <BookingManagement /> },
    { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: <BookingCalendar /> },
    { id: 'coach-requests', name: '教練要請', icon: ChatBubbleLeftRightIcon, element: <CoachScheduleRequestManagement /> },
    { id: 'coach-classes', name: '教練課堂', icon: AcademicCapIcon, element: <CoachClassManagement /> },
    { id: 'stores', name: '店鋪管理', icon: BuildingStorefrontIcon, element: <StoreManagement /> },
    { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: <CourtManagement /> },
    { id: 'tenant-staff', name: '店鋪員工', icon: IdentificationIcon, element: <TenantStaffManagement />, platformOnly: true },
    { id: 'users', name: '用戶管理', icon: UsersIcon, element: <UserManagement />, platformOnly: true },
    { id: 'tiers', name: 'Tier 管理', icon: TagIcon, element: <TierManagement />, platformOnly: true },
    { id: 'vlogs', name: 'Vlog 管理', icon: DocumentChartBarIcon, element: <VlogManagement />, platformOnly: true },
    { id: 'hotnews', name: 'HotNews 管理', icon: DocumentChartBarIcon, element: <HotNewsManagement />, platformOnly: true },
    { id: 'game-halls', name: 'GameHall 管理', icon: DocumentChartBarIcon, element: <GameHallManagement />, platformOnly: true },
    { id: 'game-clients', name: 'GameClient 管理', icon: DocumentChartBarIcon, element: <GameClientManagement />, platformOnly: true },
    { id: 'game-leaderboard', name: '排行榜', icon: DocumentChartBarIcon, element: <GameLeaderboardManagement />, platformOnly: true },
    { id: 'edm', name: 'EDM 發送', icon: EnvelopeIcon, element: <EdmSend />, platformOnly: true },
    { id: 'redeem', name: '兌換碼管理', icon: TicketIcon, element: <RedeemCodeManagement /> },
    { id: 'recharge-offers', name: '充值優惠管理', icon: CreditCardIcon, element: <RechargeOfferManagement /> },
    { id: 'shop', name: '商店管理', icon: ShoppingBagIcon, element: <ShopManagement />, platformOnly: true },
    { id: 'orders', name: '訂單管理', icon: ShoppingBagIcon, element: <OrderManagement /> },
    { id: 'activities', name: '活動管理', icon: CalendarIcon, element: <ActivityManagement /> },
    { id: 'regular-activities', name: '恆常活動管理', icon: CalendarIcon, element: <RegularActivityManagement /> },
    { id: 'weekend', name: '假期管理', icon: ClockIcon, element: <HolidayManagement /> },
    { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: <BookingConfig /> },
    { id: 'bulk-upgrade', name: '批量升級', icon: ArrowTrendingUpIcon, element: <BulkUpgrade />, platformOnly: true },
    { id: 'maintenance', name: '系統維護', icon: WrenchScrewdriverIcon, element: <MaintenanceControl />, platformOnly: true },
    { id: 'analytics', name: '數據分析', icon: DocumentChartBarIcon, element: <AnalyticsDashboard />, platformOnly: true },
    { id: 'reports', name: '報告', icon: DocumentChartBarIcon, element: <ReportManagement />, platformOnly: true },
    { id: 'accounting', name: '會計', icon: CurrencyDollarIcon, element: <AccountingManagement /> }
  ]), []);

  const tabs = allTabs;

  const current = useMemo(() => {
    const found = tabs.find((t) => t.id === activeTab);
    return found || tabs[0];
  }, [tabs, activeTab]);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
      setSearchParams({ tab: tabs[0].id });
    }
  }, [tabs, activeTab, setSearchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isStoreStaff && !isPlatformAdmin) {
    return <Navigate to={getDefaultHomeForUser(user)} replace />;
  }

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">權限不足</h1>
          <p className="text-gray-600">此區域僅限平台超級管理員使用。店鋪員工請使用店鋪後台。</p>
        </div>
      </div>
    );
  }

  const staffStoreLabel = !isPlatformAdmin && user?.managedStores?.length
    ? user.managedStores.map((s) => s.name).join('、')
    : '';

  const Nav = ({ onSelect }: { onSelect?: () => void }) => (
    <nav className="px-3 py-4 space-y-1">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = t.id === current?.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              setSearchParams({ tab: t.id });
              onSelect?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-500'}`} />
            <span className="truncate">{t.name}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="bg-gray-50 h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[18rem] max-w-[85vw] bg-white shadow-xl border-r border-gray-200 flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <div className="font-bold text-gray-900">Admin</div>
              <button type="button" className="p-2 rounded-md hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <Nav onSelect={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-white border-r border-gray-200 min-h-0">
          <div className="flex-shrink-0 h-16 flex items-center px-5 border-b border-gray-200">
            <div>
              <div className="font-bold text-gray-900">Admin Panel</div>
              {staffStoreLabel && (
                <div className="text-xs text-gray-500 truncate max-w-[10rem]" title={staffStoreLabel}>
                  {staffStoreLabel}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <Nav />
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header className="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="lg:hidden p-2 rounded-md hover:bg-gray-50"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Bars3Icon className="w-6 h-6 text-gray-700" />
              </button>
              <div className="min-w-0">
                <div className="text-sm text-gray-500">
                  {isPlatformAdmin ? '平台管理員' : '店鋪員工'}
                </div>
                <div className="font-semibold text-gray-900 truncate">{current?.name}</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 truncate">
              {user?.name ? `Hi, ${user.name}` : ''}
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {current?.element}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminV2;
