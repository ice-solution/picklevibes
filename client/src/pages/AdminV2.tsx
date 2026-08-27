import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { canOpenAdminV2, getEffectiveStoreRole } from '../utils/authRedirect';
import { canAccessAdminV2TabForUser, isStoreReadOnly } from '../utils/storeAdminPermissions';

import PendingSettleBookings from '../components/Admin/PendingSettleBookings';
import BookingCalendar from '../components/Admin/BookingCalendar';
import CoachAdminHub from '../components/Admin/CoachAdminHub';
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
import PosManagement from '../components/Admin/PosManagement';
import MaintenanceControl from '../components/Admin/MaintenanceControl';
import ActivityManagement from '../components/Admin/ActivityManagement';
import RegularActivityManagement from '../components/Admin/RegularActivityManagement';
import HolidayManagement from '../components/Admin/WeekendManagement';
import BookingConfig from '../components/Admin/BookingConfig';
import BulkUpgrade from '../components/Admin/BulkUpgrade';
import AnalyticsDashboard from '../components/Admin/AnalyticsDashboard';
import ReportManagement from '../components/Admin/ReportManagement';
import AccountingManagement from '../components/Admin/AccountingManagement';
import ApplicationFormManagement from '../components/Admin/ApplicationFormManagement';
import PaymentLinkManagement from '../components/Admin/PaymentLinkManagement';
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
  EnvelopeIcon,
  BuildingStorefrontIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserPlusIcon,
  BanknotesIcon,
  LinkIcon,
  AcademicCapIcon,
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
  const [activeTab, setActiveTab] = useState<string>('pending-settle');
  const [mobileOpen, setMobileOpen] = useState(false);

  const effectiveRole = getEffectiveStoreRole(user);
  const readOnly = isStoreReadOnly(effectiveRole);

  const allTabs: Tab[] = useMemo(() => ([
    { id: 'pending-settle', name: '待結算', icon: CalendarDaysIcon, element: <PendingSettleBookings /> },
    { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon, element: <BookingCalendar /> },
    { id: 'coaches', name: '教練管理', icon: AcademicCapIcon, element: <CoachAdminHub /> },
    { id: 'stores', name: '店鋪管理', icon: BuildingStorefrontIcon, element: <StoreManagement /> },
    { id: 'tenant-staff', name: '店鋪員工', icon: UserPlusIcon, element: <TenantStaffManagement /> },
    { id: 'courts', name: '場地管理', icon: UserGroupIcon, element: <CourtManagement /> },
    { id: 'users', name: '用戶管理', icon: UsersIcon, element: <UserManagement /> },
    { id: 'tiers', name: 'Tier 管理', icon: TagIcon, element: <TierManagement /> },
    { id: 'vlogs', name: 'Vlog 管理', icon: DocumentChartBarIcon, element: <VlogManagement /> },
    { id: 'hotnews', name: 'HotNews 管理', icon: DocumentChartBarIcon, element: <HotNewsManagement /> },
    { id: 'game-halls', name: 'GameHall 管理', icon: DocumentChartBarIcon, element: <GameHallManagement /> },
    { id: 'game-clients', name: 'GameClient 管理', icon: DocumentChartBarIcon, element: <GameClientManagement /> },
    { id: 'game-leaderboard', name: '排行榜', icon: DocumentChartBarIcon, element: <GameLeaderboardManagement /> },
    { id: 'edm', name: 'EDM 發送', icon: EnvelopeIcon, element: <EdmSend /> },
    { id: 'redeem', name: '兌換碼管理', icon: TicketIcon, element: <RedeemCodeManagement /> },
    { id: 'recharge-offers', name: '充值優惠管理', icon: CreditCardIcon, element: <RechargeOfferManagement /> },
    { id: 'payment-links', name: '收款連結', icon: LinkIcon, element: <PaymentLinkManagement /> },
    { id: 'shop', name: '商店管理', icon: ShoppingBagIcon, element: <ShopManagement /> },
    { id: 'orders', name: '訂單管理', icon: ShoppingBagIcon, element: <OrderManagement /> },
    { id: 'pos', name: 'POS 收銀', icon: BanknotesIcon, element: <PosManagement /> },
    { id: 'activities', name: '活動管理', icon: CalendarIcon, element: <ActivityManagement /> },
    { id: 'application-forms', name: '申請表', icon: DocumentTextIcon, element: <ApplicationFormManagement /> },
    { id: 'regular-activities', name: '恆常活動管理', icon: CalendarIcon, element: <RegularActivityManagement /> },
    { id: 'weekend', name: '假期管理', icon: ClockIcon, element: <HolidayManagement /> },
    { id: 'booking-config', name: '預約設定', icon: Cog6ToothIcon, element: <BookingConfig /> },
    { id: 'bulk-upgrade', name: '批量升級', icon: ArrowTrendingUpIcon, element: <BulkUpgrade /> },
    { id: 'maintenance', name: '系統維護', icon: WrenchScrewdriverIcon, element: <MaintenanceControl /> },
    { id: 'analytics', name: '數據分析', icon: DocumentChartBarIcon, element: <AnalyticsDashboard /> },
    { id: 'reports', name: '報告', icon: DocumentChartBarIcon, element: <ReportManagement /> },
    { id: 'accounting', name: '會計', icon: CurrencyDollarIcon, element: <AccountingManagement /> }
  ]), []);

  const tabs = useMemo(
    () => allTabs.filter((t) => canAccessAdminV2TabForUser(user, t.id)),
    [allTabs, user]
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
      return;
    }
    if (tabs.length && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [searchParams, tabs, activeTab]);

  // 鎖住 document／html scroll，只讓 main／drawer 內層滾
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  // 開 mobile menu 時額外鎖 touch 傳透到背後
  useEffect(() => {
    if (!mobileOpen) return;
    const preventTouch = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-admin-drawer-scroll]')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouch, { passive: false });
    return () => document.removeEventListener('touchmove', preventTouch);
  }, [mobileOpen]);

  const current = useMemo(() => tabs.find((t) => t.id === activeTab) || tabs[0], [tabs, activeTab]);

  // 轉 tab 時把內容區捲回頂，避免殘留 scroll 造成錯覺
  useEffect(() => {
    const el = document.querySelector('[data-admin-main-scroll]');
    if (el instanceof HTMLElement) el.scrollTop = 0;
  }, [current?.id]);

  if (!canOpenAdminV2(user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">權限不足</h1>
          <p className="text-gray-600">您需要管理員或店鋪員工權限才能訪問此頁面</p>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">權限不足</h1>
          <p className="text-gray-600">沒有可使用的後台功能</p>
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
    <div className="bg-gray-50 h-full min-h-0 flex flex-col overflow-hidden">
      {/* Mobile drawer：高於 Navbar(z-50)，backdrop 唔傳 scroll 到後面 */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 overscroll-none"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[18rem] max-w-[85vw] bg-white shadow-xl border-r border-gray-200 flex flex-col overscroll-contain">
            <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-gray-200">
              <div className="font-bold text-gray-900">Admin</div>
              <button type="button" className="p-2 rounded-md hover:bg-gray-50" onClick={() => setMobileOpen(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-700" />
              </button>
            </div>
            <div
              data-admin-drawer-scroll
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            >
              <Nav onSelect={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-white border-r border-gray-200 min-h-0">
          <div className="flex-shrink-0 h-16 flex items-center px-5 border-b border-gray-200">
            <div className="font-bold text-gray-900">Admin Panel</div>
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
                <div className="text-sm text-gray-500">管理員控制台</div>
                <div className="font-semibold text-gray-900 truncate">{current.name}</div>
              </div>
            </div>

            <div className="text-sm text-gray-600 truncate">
              {user?.name ? `Hi, ${user.name}` : ''}
            </div>
          </header>

          <main
            data-admin-main-scroll
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6"
          >
            {effectiveRole === 'staff' && (
              <p className="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                店員權限：預約日曆、商店、訂單、活動與恆常活動。店鋪停用後仍可在此管理內容。
              </p>
            )}
            {readOnly && (
              <p className="mb-4 text-sm text-slate-800 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
                股東帳號為唯讀：可查看數據分析、報告、會計與預約日曆，無法新增或修改資料。
              </p>
            )}
            {/* 只用 opacity，避免 y 位移＋卸載時高度塌縮令版面跳動 */}
            <motion.div
              key={current.id}
              className="min-h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {current.element}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminV2;

