import React, { useState, useEffect } from 'react';
import { useBooking } from '../../contexts/BookingContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface CurrentBookingsProps {
  showAll?: boolean;
  showUpcomingOnly?: boolean;
  limit?: number;
}

const CurrentBookings: React.FC<CurrentBookingsProps> = ({ 
  showAll = false, 
  showUpcomingOnly = false,
  limit = 5 
}) => {
  const { bookings, fetchBookings, loading } = useBooking();
  const { user } = useAuth();
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (bookings && bookings.length > 0) {
      let filtered = bookings;
      
      // 如果只顯示當前用戶的預約
      if (!showAll && user) {
        filtered = bookings.filter(booking => {
          try {
            // booking.user 可能是字符串（用戶ID）或對象
            const userId = typeof booking.user === 'string' ? booking.user : booking.user?._id;
            return userId === user.id;
          } catch (error) {
            console.warn('Error filtering booking by user:', error);
            return false;
          }
        });
      }
      
      // 如果只顯示 upcoming 預約
      if (showUpcomingOnly) {
        const now = new Date();
        filtered = filtered.filter(booking => {
          try {
            const bookingDate = new Date(booking.date);
            const bookingDateTime = new Date(`${bookingDate.toISOString().split('T')[0]}T${booking.startTime}:00`);
            return bookingDateTime > now;
          } catch (error) {
            console.warn('Error filtering upcoming bookings:', error);
            return false;
          }
        });
      }
      
      // 按日期和時間排序
      filtered.sort((a, b) => {
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
      
      // 限制顯示數量
      if (limit && limit > 0) {
        filtered = filtered.slice(0, limit);
      }
      
      setFilteredBookings(filtered);
    } else {
      setFilteredBookings([]);
    }
  }, [bookings, showAll, showUpcomingOnly, user, limit]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
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

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredBookings.length === 0) {
    return (
      <div className="text-center py-8">
        <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">暫無預約記錄</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {showAll ? '所有預約' : '我的預約'}
        </h3>
        <span className="text-sm text-gray-500">
          共 {filteredBookings.length} 筆
        </span>
      </div>
      
      <div className="space-y-3">
        {filteredBookings.map((booking) => (
          <div
            key={booking._id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  {getStatusIcon(booking.status)}
                  <span className="font-medium text-gray-900">
                    {booking.court?.name || '未知場地'}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({booking.court?.number}號場)
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{formatDate(booking.date)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="w-4 h-4" />
                    <span>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <UserGroupIcon className="w-4 h-4" />
                    <span>{booking.totalPlayers} 人</span>
                  </div>
                  
                  <div className="text-right">
                    <span className="font-medium text-green-600">
                      {booking.pricing?.totalPrice || 0} 積分
                    </span>
                  </div>
                </div>
                
                {booking.players && booking.players.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">參與者：</p>
                    <div className="flex flex-wrap gap-1">
                      {booking.players.map((player: any, index: number) => (
                        <span
                          key={index}
                          className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                        >
                          {player.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {booking.specialRequests && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">特殊要求：</p>
                    <p className="text-sm text-gray-700">{booking.specialRequests}</p>
                  </div>
                )}
              </div>
              
              <div className="ml-4 text-right">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  booking.status === 'confirmed' 
                    ? 'bg-green-100 text-green-800'
                    : booking.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : booking.status === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {getStatusText(booking.status)}
                </span>
                
                {booking.payment && (
                  <div className="mt-1">
                    <span className={`text-xs ${
                      booking.payment.status === 'paid'
                        ? 'text-green-600'
                        : booking.payment.status === 'pending'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}>
                      {booking.payment.status === 'paid' ? '已付款' : 
                       booking.payment.status === 'pending' ? '待付款' : '付款失敗'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CurrentBookings;
