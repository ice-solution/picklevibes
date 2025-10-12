import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  CalendarDaysIcon,
  EyeIcon,
  XMarkIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface Booking {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  court: {
    _id: string;
    name: string;
    number: string;
    type: string;
  };
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  players: Array<{
    name: string;
    email: string;
    phone: string;
  }>;
  specialRequests?: string;
  pricing: {
    totalPrice: number;
    duration: number;
    basePrice: number;
  };
  payment: {
    method: string;
    status: string;
    amount: number;
  };
  createdAt: string;
  updatedAt: string;
}

const BookingManagement: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filters, setFilters] = useState({
    court: '',
    date: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });

  useEffect(() => {
    fetchBookings();
  }, [filters, pagination.current]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: '20'
      });
      
      if (filters.court) params.append('court', filters.court);
      if (filters.date) params.append('date', filters.date);
      
      const response = await axios.get(`/bookings/admin/all?${params.toString()}`);
      setBookings(response.data.bookings);
      setPagination(response.data.pagination);
    } catch (error: any) {
      console.error('獲取預約列表失敗:', error);
      setError(error.response?.data?.message || '獲取預約列表失敗');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };


  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 過濾器 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              日期
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ court: '', date: '' })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              清除過濾器
            </button>
          </div>
        </div>
      </div>

      {/* 錯誤信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircleIcon className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 預約列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            預約列表 ({pagination.total} 筆)
          </h3>
        </div>
        
        {bookings.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDaysIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">沒有找到預約記錄</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    預約信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用戶信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    場地信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    特殊要求
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.map((booking) => (
                  <motion.tr
                    key={booking._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatDate(booking.date)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.startTime} - {booking.endTime}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.players.length} 人
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {booking.user.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.user.email}
                      </div>
                      {booking.user.phone && (
                        <div className="text-sm text-gray-500">
                          {booking.user.phone}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {booking.court.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {booking.court.number}號場
                      </div>
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
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailModal(true);
                        }}
                        className="text-primary-600 hover:text-primary-900 mr-3"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分頁 */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            顯示第 {(pagination.current - 1) * 20 + 1} 到 {Math.min(pagination.current * 20, pagination.total)} 筆，共 {pagination.total} 筆
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPagination({ ...pagination, current: pagination.current - 1 })}
              disabled={pagination.current === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一頁
            </button>
            <button
              onClick={() => setPagination({ ...pagination, current: pagination.current + 1 })}
              disabled={pagination.current === pagination.pages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

      {/* 詳情模態框 */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">預約詳情</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">日期</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedBooking.date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">時間</label>
                  <p className="text-sm text-gray-900">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">場地</label>
                  <p className="text-sm text-gray-900">{selectedBooking.court.name} ({selectedBooking.court.number}號場)</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">參與者</label>
                <div className="mt-1 space-y-2">
                  {selectedBooking.players.map((player, index) => (
                    <div key={index} className="text-sm text-gray-900">
                      {player.name} ({player.email})
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">總價</label>
                  <p className="text-sm text-gray-900">{selectedBooking.pricing.totalPrice} 積分</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">付款方式</label>
                  <p className="text-sm text-gray-900">{selectedBooking.payment.method}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingManagement;
