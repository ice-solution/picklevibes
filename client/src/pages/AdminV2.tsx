import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultHomeForUser } from '../utils/authRedirect';
import { PICKCOURT_HOME } from '../utils/pickcourtRoutes';
import {
  PLATFORM_LOGO_PATH,
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
} from '../constants/platformBrand';
import { useDocumentPlatformBrand } from '../hooks/useDocumentPlatformBrand';

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
  ArrowLeftIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

const BookingManagement = lazy(() => import('../components/Admin/BookingManagement'));
const BookingCalendar = lazy(() => import('../components/Admin/BookingCalendar'));
const CoachScheduleRequestManagement = lazy(
  () => import('../components/Admin/CoachScheduleRequestManagement')
);
const CoachClassManagement = lazy(() => import('../components/Admin/CoachClassManagement'));
const CourtManagement = lazy(() => import('../components/Admin/CourtManagement'));
const StoreManagement = lazy(() => import('../components/Admin/StoreManagement'));
const UserManagement = lazy(() => import('../components/Admin/UserManagement'));
const TierManagement = lazy(() => import('../components/Admin/TierManagement'));
const VlogManagement = lazy(() => import('../components/Admin/VlogManagement'));
const HotNewsManagement = lazy(() => import('../components/Admin/HotNewsManagement'));
const GameHallManagement = lazy(() => import('../components/Admin/GameHallManagement'));
const GameClientManagement = lazy(() => import('../components/Admin/GameClientManagement'));
const GameLeaderboardManagement = lazy(
  () => import('../components/Admin/GameLeaderboardManagement')
);
const RedeemCodeManagement = lazy(() => import('../components/Admin/RedeemCodeManagement'));
const RechargeOfferManagement = lazy(() => import('../components/Admin/RechargeOfferManagement'));
const RechargeRecordsManagement = lazy(
  () => import('../components/Admin/RechargeRecordsManagement')
);
const ShopManagement = lazy(() => import('../components/Admin/ShopManagement'));
const OrderManagement = lazy(() => import('../components/Admin/OrderManagement'));
const MaintenanceControl = lazy(() => import('../components/Admin/MaintenanceControl'));
const ActivityManagement = lazy(() => import('../components/Admin/ActivityManagement'));
const RegularActivityManagement = lazy(
  () => import('../components/Admin/RegularActivityManagement')
);
const HolidayManagement = lazy(() => import('../components/Admin/WeekendManagement'));
const BookingConfig = lazy(() => import('../components/Admin/BookingConfig'));
const BulkUpgrade = lazy(() => import('../components/Admin/BulkUpgrade'));
const AnalyticsDashboard = lazy(() => import('../components/Admin/AnalyticsDashboard'));
const ReportManagement = lazy(() => import('../components/Admin/ReportManagement'));
const AccountingManagement = lazy(() => import('../components/Admin/AccountingManagement'));
const PlatformFeeManagement = lazy(() => import('../components/Admin/PlatformFeeManagement'));
const StoreBookingStats = lazy(() => import('../components/Admin/StoreBookingStats'));
const EdmSend = lazy(() => import('../components/Admin/EdmSend'));
const TenantStaffManagement = lazy(() => import('../components/Admin/TenantStaffManagement'));

type Tab = {
  id: string;
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  element: React.ReactNode;
};

type TabGroup = {
  id: string;
  label: string;
  tabs: Tab[];
};

const TabFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="animate-spin rounded-full h-10 w-10 border-2 border-pickcourt-gold border-t-transparent" />
  </div>
);

function wrap(node: React.ReactNode) {
  return <Suspense fallback={<TabFallback />}>{node}</Suspense>;
}

/** PickCourt 平台超級管理員後台（店鋪員工請用 /store/:slug/admin） */
const AdminV2: React.FC = () => {
  const { user, loading, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('bookings');
  const [mobileOpen, setMobileOpen] = useState(false);

  const isPlatformAdmin = user?.isPlatformAdmin === true || user?.role === 'admin';
  const isStoreStaff = user?.role === 'staff' && (user?.managedStores?.length ?? 0) > 0;
  const canAccessAdmin = isPlatformAdmin;

  useDocumentPlatformBrand(true);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  /** PickCourt 主線：訂場聯盟營運 */
  const primaryGroups: TabGroup[] = useMemo(
    () => [
      {
        id: 'booking',
        label: '訂場營運',
        tabs: [
          { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon, element: wrap(<BookingManagement />) },
          { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: wrap(<BookingCalendar />) },
          { id: 'stores', name: '店鋪管理', icon: BuildingStorefrontIcon, element: wrap(<StoreManagement />) },
          { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: wrap(<CourtManagement />) },
          { id: 'activities', name: '活動管理', icon: CalendarIcon, element: wrap(<ActivityManagement />) },
          {
            id: 'regular-activities',
            name: '恆常活動',
            icon: CalendarIcon,
            element: wrap(<RegularActivityManagement />),
          },
          { id: 'weekend', name: '假期管理', icon: ClockIcon, element: wrap(<HolidayManagement />) },
          { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: wrap(<BookingConfig />) },
        ],
      },
      {
        id: 'finance',
        label: '兌換券／財務',
        tabs: [
          {
            id: 'recharge-offers',
            name: '兌換券方案',
            icon: CreditCardIcon,
            element: wrap(<RechargeOfferManagement />),
          },
          { id: 'redeem', name: '兌換碼', icon: TicketIcon, element: wrap(<RedeemCodeManagement />) },
          {
            id: 'recharge-records',
            name: '充值紀錄',
            icon: CreditCardIcon,
            element: wrap(<RechargeRecordsManagement />),
          },
          {
            id: 'platform-fees',
            name: '店鋪抽成／找數',
            icon: CurrencyDollarIcon,
            element: wrap(<PlatformFeeManagement />),
          },
          { id: 'accounting', name: '會計', icon: CurrencyDollarIcon, element: wrap(<AccountingManagement />) },
          {
            id: 'store-booking-stats',
            name: '各店預約統計',
            icon: DocumentChartBarIcon,
            element: wrap(<StoreBookingStats />),
          },
        ],
      },
      {
        id: 'system',
        label: '平台系統',
        tabs: [
          {
            id: 'tenant-staff',
            name: '店鋪登入帳號',
            icon: IdentificationIcon,
            element: wrap(<TenantStaffManagement />),
          },
          { id: 'users', name: '用戶管理', icon: UsersIcon, element: wrap(<UserManagement />) },
          { id: 'analytics', name: '數據分析', icon: DocumentChartBarIcon, element: wrap(<AnalyticsDashboard />) },
          { id: 'reports', name: '報告', icon: DocumentChartBarIcon, element: wrap(<ReportManagement />) },
          {
            id: 'maintenance',
            name: '系統維護',
            icon: WrenchScrewdriverIcon,
            element: wrap(<MaintenanceControl />),
          },
        ],
      },
    ],
    []
  );

  /**
   * 舊版 PickleVibes 功能：PickCourt 前台無入口。
   * 元件／API 暫留；側欄收進「舊版功能」，需要時仍可用 ?tab= 開啟。
   */
  const legacyTabs: Tab[] = useMemo(
    () => [
      {
        id: 'coach-requests',
        name: '教練要請',
        icon: ChatBubbleLeftRightIcon,
        element: wrap(<CoachScheduleRequestManagement />),
      },
      {
        id: 'coach-classes',
        name: '教練課堂',
        icon: AcademicCapIcon,
        element: wrap(<CoachClassManagement />),
      },
      { id: 'tiers', name: 'Tier 管理', icon: TagIcon, element: wrap(<TierManagement />) },
      { id: 'bulk-upgrade', name: '批量升級', icon: ArrowTrendingUpIcon, element: wrap(<BulkUpgrade />) },
      { id: 'vlogs', name: 'Vlog 管理', icon: DocumentChartBarIcon, element: wrap(<VlogManagement />) },
      { id: 'hotnews', name: 'HotNews 管理', icon: DocumentChartBarIcon, element: wrap(<HotNewsManagement />) },
      { id: 'game-halls', name: 'GameHall 管理', icon: DocumentChartBarIcon, element: wrap(<GameHallManagement />) },
      {
        id: 'game-clients',
        name: 'GameClient 管理',
        icon: DocumentChartBarIcon,
        element: wrap(<GameClientManagement />),
      },
      {
        id: 'game-leaderboard',
        name: '排行榜',
        icon: DocumentChartBarIcon,
        element: wrap(<GameLeaderboardManagement />),
      },
      { id: 'shop', name: '商店管理', icon: ShoppingBagIcon, element: wrap(<ShopManagement />) },
      { id: 'orders', name: '商城訂單', icon: ShoppingBagIcon, element: wrap(<OrderManagement />) },
      { id: 'edm', name: 'EDM 發送', icon: EnvelopeIcon, element: wrap(<EdmSend />) },
    ],
    []
  );

  const allTabs = useMemo(
    () => [...primaryGroups.flatMap((g) => g.tabs), ...legacyTabs],
    [primaryGroups, legacyTabs]
  );

  const current = useMemo(() => {
    const found = allTabs.find((t) => t.id === activeTab);
    return found || allTabs[0];
  }, [allTabs, activeTab]);

  const legacyActive = legacyTabs.some((t) => t.id === activeTab);

  useEffect(() => {
    if (allTabs.length > 0 && !allTabs.some((t) => t.id === activeTab)) {
      setActiveTab(allTabs[0].id);
      setSearchParams({ tab: allTabs[0].id });
    }
  }, [allTabs, activeTab, setSearchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-pickcourt-gold border-t-transparent" />
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <img src={PLATFORM_LOGO_PATH} alt={PLATFORM_NAME} className="h-12 w-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-pickcourt-navy mb-2">權限不足</h1>
          <p className="text-slate-600 mb-6">
            此區域僅限平台超級管理員使用。店鋪員工請使用店鋪後台。
          </p>
          <Link
            to={PICKCOURT_HOME}
            className="inline-flex items-center gap-2 text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回 {PLATFORM_NAME}
          </Link>
        </div>
      </div>
    );
  }

  const BrandHeader = ({ compact = false }: { compact?: boolean }) => (
    <div className="flex items-center gap-3 min-w-0">
      <img
        src={PLATFORM_LOGO_PATH}
        alt={PLATFORM_NAME}
        className={`object-contain rounded-lg shrink-0 bg-white ${
          compact ? 'h-9 w-9 p-0.5' : 'h-11 w-11 p-1 shadow-sm border border-pickcourt-gold/30'
        }`}
      />
      <div className="min-w-0">
        <div className={`font-bold text-white truncate ${compact ? 'text-sm' : ''}`}>
          {PLATFORM_NAME}
        </div>
        <div className="text-xs text-pickcourt-gold/90 truncate">
          平台管理 · {PLATFORM_TAGLINE}
        </div>
      </div>
    </div>
  );

  const selectTab = (id: string, onSelect?: () => void) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
    onSelect?.();
  };

  const TabButton = ({
    t,
    onSelect,
  }: {
    t: Tab;
    onSelect?: () => void;
  }) => {
    const Icon = t.icon;
    const active = t.id === current?.id;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => selectTab(t.id, onSelect)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors border ${
          active
            ? 'bg-pickcourt-gold/15 text-pickcourt-gold border-pickcourt-gold/30'
            : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-pickcourt-gold' : 'text-slate-400'}`} />
        <span className="truncate">{t.name}</span>
      </button>
    );
  };

  const Nav = ({ onSelect }: { onSelect?: () => void }) => (
    <nav className="px-3 py-4 space-y-5">
      {primaryGroups.map((group) => (
        <div key={group.id}>
          <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.tabs.map((t) => (
              <TabButton key={t.id} t={t} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}

      <details className="group rounded-lg border border-white/10 open:bg-white/[0.03]" open={legacyActive}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200">
          <span>
            舊版功能
            <span className="ml-1.5 text-[11px] text-slate-500">PickleVibes</span>
          </span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <p className="px-3 pb-2 text-[11px] leading-relaxed text-slate-500">
          前台無入口：Vlog／新聞／遊戲／商店／教練／Tier。需要時再開。
        </p>
        <div className="space-y-1 pb-2">
          {legacyTabs.map((t) => (
            <TabButton key={t.id} t={t} onSelect={onSelect} />
          ))}
        </div>
      </details>
    </nav>
  );

  const sidebarFooter = (
    <div className="p-3 border-t border-white/10 text-xs text-slate-400 space-y-2">
      <Link
        to={PICKCOURT_HOME}
        className="flex items-center gap-1 text-pickcourt-gold hover:text-pickcourt-gold-light"
        onClick={() => setMobileOpen(false)}
      >
        <ArrowLeftIcon className="w-4 h-4" />
        返回聯盟首頁
      </Link>
      <button
        type="button"
        onClick={() => {
          setMobileOpen(false);
          logout();
        }}
        className="block w-full text-left text-red-400 hover:text-red-300"
      >
        登出
      </button>
    </div>
  );

  return (
    <div className="h-dvh max-h-dvh bg-slate-100 flex flex-col overflow-hidden text-pickcourt-navy">
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-[18rem] max-w-[85vw] bg-pickcourt-navy shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 gap-2">
              <div className="min-w-0 flex-1">
                <BrandHeader />
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="p-2 text-white/80">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Nav onSelect={() => setMobileOpen(false)} />
            </div>
            {sidebarFooter}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="hidden lg:flex lg:flex-col lg:w-72 shrink-0 bg-pickcourt-navy min-h-0">
          <div className="h-[4.25rem] flex items-center px-5 border-b border-white/10 bg-gradient-to-br from-pickcourt-navy-dark via-pickcourt-navy to-pickcourt-navy-light">
            <BrandHeader />
          </div>
          <div className="flex-1 overflow-y-auto">
            <Nav />
          </div>
          {sidebarFooter}
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header className="h-16 bg-white border-b border-pickcourt-gold/20 flex items-center justify-between px-4 sm:px-6 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="lg:hidden p-2 -ml-2 rounded-md hover:bg-slate-50"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Bars3Icon className="w-6 h-6 text-pickcourt-navy" />
              </button>
              <div className="lg:hidden flex items-center gap-2 min-w-0">
                <img
                  src={PLATFORM_LOGO_PATH}
                  alt=""
                  className="h-8 w-8 object-contain rounded shrink-0 border border-pickcourt-gold/30"
                />
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">平台管理員</div>
                  <div className="font-semibold text-pickcourt-navy truncate">{current?.name}</div>
                </div>
              </div>
              <div className="hidden lg:block min-w-0">
                <div className="text-xs text-slate-500">平台管理員</div>
                <div className="font-semibold text-pickcourt-navy truncate">{current?.name}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-slate-600 truncate max-w-[8rem] sm:max-w-none">
                {user?.name ? `Hi, ${user.name}` : ''}
              </span>
              <button
                type="button"
                onClick={logout}
                className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors shrink-0"
              >
                登出
              </button>
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-gradient-to-b from-slate-50 to-slate-100/80">
            <motion.div
              key={current?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {current?.element}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminV2;
