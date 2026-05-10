import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

import BookingManagement from '../components/Admin/BookingManagement';
import BookingCalendar from '../components/Admin/BookingCalendar';
import CoachScheduleRequestManagement from '../components/Admin/CoachScheduleRequestManagement';
import CourtManagement from '../components/Admin/CourtManagement';
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
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

type Tab = {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  element: React.ReactNode;
};

const AdminV2: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('bookings');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tabs: Tab[] = useMemo(() => ([
    { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon, element: <BookingManagement /> },
    { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: <BookingCalendar /> },
    { id: 'coach-requests', name: '教練要請', icon: ChatBubbleLeftRightIcon, element: <CoachScheduleRequestManagement /> },
    { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: <CourtManagement /> },
    { id: 'users', name: '用戶管理', icon: UsersIcon, element: <UserManagement /> },
    { id: 'tiers', name: 'Tier 管理', icon: TagIcon, element: <TierManagement /> },
    { id: 'vlogs', name: 'Vlog 管理', icon: DocumentChartBarIcon, element: <VlogManagement /> },
    { id: 'hotnews', name: 'HotNews 管理', icon: DocumentChartBarIcon, element: <HotNewsManagement /> },
    { id: 'game-halls', name: 'GameHall 管理', icon: DocumentChartBarIcon, element: <GameHallManagement /> },
    { id: 'game-clients', name: 'GameClient 管理', icon: DocumentChartBarIcon, element: <GameClientManagement /> },
    { id: 'game-leaderboard', name: '排行榜', icon: DocumentChartBarIcon, element: <GameLeaderboardManagement /> },
    { id: 'redeem', name: '兌換碼管理', icon: TicketIcon, element: <RedeemCodeManagement /> },
    { id: 'recharge-offers', name: '充值優惠管理', icon: CreditCardIcon, element: <RechargeOfferManagement /> },
    { id: 'shop', name: '商店管理', icon: ShoppingBagIcon, element: <ShopManagement /> },
    { id: 'orders', name: '訂單管理', icon: ShoppingBagIcon, element: <OrderManagement /> },
    { id: 'activities', name: '活動管理', icon: CalendarIcon, element: <ActivityManagement /> },
    { id: 'regular-activities', name: '恆常活動管理', icon: CalendarIcon, element: <RegularActivityManagement /> },
    { id: 'weekend', name: '假期管理', icon: ClockIcon, element: <HolidayManagement /> },
    { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: <BookingConfig /> },
    { id: 'bulk-upgrade', name: '批量升級', icon: ArrowTrendingUpIcon, element: <BulkUpgrade /> },
    { id: 'maintenance', name: '系統維護', icon: WrenchScrewdriverIcon, element: <MaintenanceControl /> },
    { id: 'analytics', name: '數據分析', icon: DocumentChartBarIcon, element: <AnalyticsDashboard /> },
    { id: 'reports', name: '報告', icon: DocumentChartBarIcon, element: <ReportManagement /> }
  ]), []);

  const current = useMemo(() => tabs.find((t) => t.id === activeTab) || tabs[0], [tabs, activeTab]);

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">權限不足</h1>
          <p className="text-gray-600">您需要管理員權限才能訪問此頁面</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[18rem] bg-white shadow-xl border-r border-gray-200">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <div className="font-bold text-gray-900">Admin</div>
              <button type="button" className="p-2 rounded-md hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <Nav onSelect={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-72 min-h-screen bg-white border-r border-gray-200">
          <div className="h-16 flex items-center px-5 border-b border-gray-200">
            <div className="font-bold text-gray-900">Admin Panel</div>
          </div>
          <Nav />
        </aside>

        <div className="flex-1 min-w-0">
          {/* Topbar */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">
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
                <div className="text-sm text-gray-500">管理員控制台</div>
                <div className="font-semibold text-gray-900 truncate">{current.name}</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 truncate">
              {user?.name ? `Hi, ${user.name}` : ''}
            </div>
          </header>

          {/* Content */}
          <main className="p-4 sm:p-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {current.element}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminV2;

