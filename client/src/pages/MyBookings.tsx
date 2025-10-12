import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import CurrentBookings from '../components/Booking/CurrentBookings';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  MapPinIcon,
  UserIcon,
  TableCellsIcon,
  ListBulletIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const MyBookings: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { bookings, fetchBookings, loading } = useBooking();
  
  // 狀態管理
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming');
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  
  const itemsPerPage = 10;

  // 獲取預約數據
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 處理預約數據
  useEffect(() => {
    if (bookings && bookings.length > 0 && user) {
      // 過濾當前用戶的預約
      const userBookings = bookings.filter(booking => {
        try {
          const userId = typeof booking.user === 'string' ? booking.user : booking.user?._id;
          return userId === user.id;
        } catch (error) {
          console.warn('Error filtering booking by user:', error);
          return false;
        }
      });

      // 按日期和時間排序
      userBookings.sort((a, b) => {
        try {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (dateA.getTime() === dateB.getTime()) {
            return a.startTime.localeCompare(b.startTime);
          }
          return dateA.getTime() - dateB.getTime();
        } catch (error) {
          console.warn('Error sorting bookings:', error);
          return 0;
        }
      });

      // 分離即將到來的預約（今天及以後）
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const upcoming = userBookings.filter(booking => {
        try {
          const bookingDate = new Date(booking.date);
          const bookingDateOnly = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
          return bookingDateOnly >= today;
        } catch (error) {
          console.warn('Error filtering upcoming bookings:', error);
          return false;
        }
      });

      setUpcomingBookings(upcoming);
      setFilteredBookings(userBookings);
    } else {
      setUpcomingBookings([]);
      setFilteredBookings([]);
    }
  }, [bookings, user]);

  // 分頁計算
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBookings = filteredBookings.slice(startIndex, endIndex);

  // 切換視圖模式
  const handleViewModeChange = (mode: 'upcoming' | 'all') => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  // 分頁處理
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 格式化函數
  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    });
  };

  const formatTime = (time: string) => {
    return time;
  };

  const formatCreatedDate = (dateString: string) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '已確認';
      case 'pending':
        return '待確認';
      case 'cancelled':
        return '已取消';
      case 'completed':
        return '已完成';
      case 'no_show':
        return '未到場';
      default:
        return '未知狀態';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'no_show':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <CalendarDaysIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">我的預約</h1>
              <p className="text-gray-600">查看和管理您的所有預約</p>
            </div>
          </div>
        </motion.div>

        {/* 視圖切換按鈕 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex gap-2">
            <button
              onClick={() => handleViewModeChange('upcoming')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'upcoming'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CalendarDaysIcon className="w-5 h-5" />
              即將到來的預約
              {upcomingBookings.length > 0 && (
                <span className="bg-primary-100 text-primary-600 text-xs px-2 py-1 rounded-full">
                  {upcomingBookings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => handleViewModeChange('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <TableCellsIcon className="w-5 h-5" />
              全部記錄
              {filteredBookings.length > 0 && (
                <span className="bg-primary-100 text-primary-600 text-xs px-2 py-1 rounded-full">
                  {filteredBookings.length}
                </span>
              )}
            </button>
          </div>
        </motion.div>

        {/* 即將到來的預約 */}
        {viewMode === 'upcoming' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarDaysIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">即將到來的預約</h2>
                </div>
                <div className="text-sm text-gray-500">
                  顯示今天及以後的預約
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="animate-pulse">
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="bg-gray-100 rounded-lg p-4">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingBookings.map((booking) => (
                    <div
                      key={booking._id}
                      className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="font-medium text-gray-900">
                              {booking.court?.name || '未知場地'}
                            </span>
                            <span className="text-sm text-gray-500">
                              ({booking.court?.number}號場)
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {getStatusText(booking.status)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <CalendarDaysIcon className="w-4 h-4" />
                              <span>{formatDate(booking.date)}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <ClockIcon className="w-4 h-4" />
                              <span>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                            </div>
                            
                            <div className="flex items-center space-x-1">
                              <UserIcon className="w-4 h-4" />
                              <span>{booking.totalPlayers} 人</span>
                            </div>
                            
                            <div className="text-right">
                              <span className="font-medium text-green-600">
                                {booking.pricing?.totalPrice || 0} 積分
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarDaysIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暫無即將到來的預約</h3>
                  <p className="text-gray-500">您還沒有任何即將到來的預約記錄</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* 全部記錄 - 表格格式 */}
        {viewMode === 'all' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TableCellsIcon className="w-6 h-6 text-primary-600" />
                  <h2 className="text-xl font-semibold text-gray-900">全部預約記錄</h2>
                </div>
                <div className="text-sm text-gray-500">
                  共 {filteredBookings.length} 筆記錄
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="animate-pulse p-6">
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              ) : filteredBookings.length > 0 ? (
                <>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          場地
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          訂單日期
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          日期時間
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          人數
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          狀態
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          特殊要求
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          費用
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentBookings.map((booking) => (
                        <tr key={booking._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <MapPinIcon className="w-4 h-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {booking.court?.name || '未知場地'}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {booking.court?.number}號場
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCreatedDate(booking.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDate(booking.date)}</div>
                            <div className="text-sm text-gray-500">
                              {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {booking.totalPlayers} 人
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {getStatusText(booking.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                            {booking.specialRequests && booking.specialRequests.trim() ? (
                              <div className="truncate" title={booking.specialRequests}>
                                {booking.specialRequests}
                              </div>
                            ) : (
                              <span className="text-gray-400">無</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                            {booking.pricing?.totalPrice || 0} 積分
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 分頁 */}
                  {totalPages > 1 && (
                    <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                      <div className="flex items-center">
                        <p className="text-sm text-gray-700">
                          顯示第 {startIndex + 1} 到 {Math.min(endIndex, filteredBookings.length)} 筆，
                          共 {filteredBookings.length} 筆記錄
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="p-2 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeftIcon className="w-5 h-5" />
                        </button>
                        
                        <div className="flex space-x-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => handlePageChange(page)}
                              className={`px-3 py-1 rounded-md text-sm font-medium ${
                                page === currentPage
                                  ? 'bg-primary-600 text-white'
                                  : 'text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <TableCellsIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">暫無預約記錄</h3>
                  <p className="text-gray-500">您還沒有任何預約記錄</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;
