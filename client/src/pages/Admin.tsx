import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import CurrentBookings from '../components/Booking/CurrentBookings';
import UserManagement from '../components/Admin/UserManagement';
import RedeemCodeManagement from '../components/Admin/RedeemCodeManagement';
import BookingManagement from '../components/Admin/BookingManagement';
import BookingCalendar from '../components/Admin/BookingCalendar';
import AnalyticsDashboard from '../components/Admin/AnalyticsDashboard';
import CourtManagement from '../components/Admin/CourtManagement';
import RechargeOfferManagement from '../components/Admin/RechargeOfferManagement';
import MaintenanceControl from '../components/Admin/MaintenanceControl';
import BulkUpgrade from '../components/Admin/BulkUpgrade';
import ActivityManagement from '../components/Admin/ActivityManagement';
import HolidayManagement from '../components/Admin/WeekendManagement';
import api from '../services/api';
import { 
  CalendarDaysIcon, 
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UsersIcon,
  TicketIcon,
  CreditCardIcon,
  WrenchScrewdriverIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { bookings, courts, fetchBookings, fetchCourts } = useBooking();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('bookings');
  const [summary, setSummary] = useState<{
    completedBookingsUntilToday: number;
    totalBookings: number;
    totalRechargeAmount: number;
    currentMonthBookings: number;
  } | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get('/stats/admin-summary');
        setSummary(res.data?.data || null);
      } catch (error) {
        console.error('載入管理員概要統計失敗:', error);
      }
    };
    fetchSummary();
  }, []);

  // 從 URL 參數設置活動標籤
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['bookings', 'calendar', 'users', 'redeem', 'courts', 'revenue', 'analytics', 'recharge-offers', 'maintenance', 'bulk-upgrade', 'activities', 'weekend'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // 組件加載時自動獲取數據
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchCourts(),
          fetchBookings()
        ]);
      } catch (error) {
        console.error('載入管理員數據失敗:', error);
      }
    };

    loadData();
  }, [fetchCourts, fetchBookings]);

  // 檢查是否為管理員
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

  // （保留原本基於當前加載預約的統計，用於其他區塊）
  const totalBookingsLocal = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
  const totalRevenueLocal = bookings
    .filter(b => b.payment?.status === 'paid')
    .reduce((sum, b) => sum + (b.pricing?.totalPrice || 0), 0);

  const tabs = [
    { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon },
    { id: 'calendar', name: '預約日曆', icon: CalendarDaysIcon },
    { id: 'users', name: '用戶管理', icon: UsersIcon },
    { id: 'redeem', name: '兌換碼管理', icon: TicketIcon },
    { id: 'courts', name: '場地管理', icon: UserGroupIcon },
    { id: 'activities', name: '活動管理', icon: CalendarIcon },
        { id: 'weekend', name: '假期管理', icon: ClockIcon },
    { id: 'recharge-offers', name: '充值優惠管理', icon: CreditCardIcon },
    { id: 'bulk-upgrade', name: '批量升級', icon: ArrowTrendingUpIcon },
    { id: 'maintenance', name: '系統維護', icon: WrenchScrewdriverIcon },
    { id: 'revenue', name: '收入統計', icon: CurrencyDollarIcon },
    { id: 'analytics', name: '數據分析', icon: ChartBarIcon }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            管理員控制台
          </h1>
          <p className="text-gray-600">
            管理預約、場地和查看系統統計數據
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">完成預約（截至今日）</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary ? summary.completedBookingsUntilToday : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">總預約（全部）</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary ? summary.totalBookings : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">本月總預約</p>
                <p className="text-2xl font-bold text-gray-900">
                  {summary ? summary.currentMonthBookings : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">總收入（累計充值）</p>
                <p className="text-2xl font-bold text-gray-900">
                  HK$ {summary ? summary.totalRechargeAmount.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-xl shadow-lg mb-8"
        >
          <div className="border-b border-gray-200">
            <nav className="flex flex-wrap gap-1 px-2 py-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setSearchParams({ tab: tab.id });
                    }}
                    className={`py-2 px-3 border-b-2 font-medium text-xs sm:text-sm rounded-md transition-all duration-200 flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 bg-primary-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="whitespace-nowrap hidden sm:inline">{tab.name}</span>
                      <span className="whitespace-nowrap sm:hidden">{tab.name.split('').slice(0, 2).join('')}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'bookings' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <BookingManagement />
              </motion.div>
            )}

            {activeTab === 'calendar' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <BookingCalendar />
              </motion.div>
            )}

            {activeTab === 'courts' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CourtManagement />
              </motion.div>
            )}

            {activeTab === 'users' && (
              <UserManagement />
            )}

            {activeTab === 'redeem' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <RedeemCodeManagement />
              </motion.div>
            )}

            {activeTab === 'recharge-offers' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <RechargeOfferManagement />
              </motion.div>
            )}

            {activeTab === 'maintenance' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <MaintenanceControl />
              </motion.div>
            )}

            {activeTab === 'activities' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ActivityManagement />
              </motion.div>
            )}

      {activeTab === 'weekend' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <HolidayManagement />
        </motion.div>
      )}


            {activeTab === 'bulk-upgrade' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <BulkUpgrade />
              </motion.div>
            )}

            {activeTab === 'revenue' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">收入統計</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">總收入</h3>
                    <p className="text-3xl font-bold text-primary-600">
                      HK$ {totalRevenueLocal.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      來自 {confirmedBookings} 個已確認預約
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">平均收入</h3>
                    <p className="text-3xl font-bold text-green-600">
                      HK$ {confirmedBookings > 0 ? Math.round(totalRevenueLocal / confirmedBookings).toLocaleString() : 0}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      每個預約平均收入
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <AnalyticsDashboard />
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
