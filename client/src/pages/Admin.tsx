import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import CurrentBookings from '../components/Booking/CurrentBookings';
import UserManagement from '../components/Admin/UserManagement';
import { 
  CalendarDaysIcon, 
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  UsersIcon
} from '@heroicons/react/24/outline';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { bookings, courts } = useBooking();
  const [activeTab, setActiveTab] = useState('bookings');

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

  // 計算統計數據
  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
  const totalRevenue = bookings
    .filter(b => b.payment?.status === 'paid')
    .reduce((sum, b) => sum + (b.pricing?.totalPrice || 0), 0);

  const tabs = [
    { id: 'bookings', name: '預約管理', icon: CalendarDaysIcon },
    { id: 'users', name: '用戶管理', icon: UsersIcon },
    { id: 'courts', name: '場地管理', icon: UserGroupIcon },
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
                <p className="text-sm font-medium text-gray-500">總預約</p>
                <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">已確認</p>
                <p className="text-2xl font-bold text-gray-900">{confirmedBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">待確認</p>
                <p className="text-2xl font-bold text-gray-900">{pendingBookings}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">總收入</p>
                <p className="text-2xl font-bold text-gray-900">HK$ {totalRevenue.toLocaleString()}</p>
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
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'bookings' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">所有預約</h2>
                  <div className="flex space-x-2">
                    <button className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                      已確認: {confirmedBookings}
                    </button>
                    <button className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded-full">
                      待確認: {pendingBookings}
                    </button>
                    <button className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-full">
                      已取消: {cancelledBookings}
                    </button>
                  </div>
                </div>
                <CurrentBookings showAll={true} />
              </div>
            )}

            {activeTab === 'courts' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">場地管理</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courts.map((court) => (
                    <div key={court._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{court.name}</h3>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          court.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {court.isActive ? '啟用' : '停用'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{court.description}</p>
                      <div className="text-sm text-gray-500">
                        <p>容量: {court.capacity} 人</p>
                        <p>類型: {court.type === 'indoor' ? '室內' : '戶外'}</p>
                        <p>價格: HK$ {court.pricing?.offPeak} - HK$ {court.pricing?.peakHour}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <UserManagement />
            )}

            {activeTab === 'revenue' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">收入統計</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">總收入</h3>
                    <p className="text-3xl font-bold text-primary-600">
                      HK$ {totalRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      來自 {confirmedBookings} 個已確認預約
                    </p>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">平均收入</h3>
                    <p className="text-3xl font-bold text-green-600">
                      HK$ {confirmedBookings > 0 ? Math.round(totalRevenue / confirmedBookings).toLocaleString() : 0}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      每個預約平均收入
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">數據分析</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">預約狀態分佈</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">已確認</span>
                        <span className="text-sm font-medium">{confirmedBookings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">待確認</span>
                        <span className="text-sm font-medium">{pendingBookings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">已取消</span>
                        <span className="text-sm font-medium">{cancelledBookings}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">場地使用率</h3>
                    <div className="space-y-2">
                      {courts.map((court) => {
                        const courtBookings = bookings.filter(b => b.court?._id === court._id);
                        const usageRate = totalBookings > 0 ? (courtBookings.length / totalBookings * 100).toFixed(1) : 0;
                        return (
                          <div key={court._id} className="flex justify-between">
                            <span className="text-sm text-gray-600">{court.name}</span>
                            <span className="text-sm font-medium">{usageRate}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
