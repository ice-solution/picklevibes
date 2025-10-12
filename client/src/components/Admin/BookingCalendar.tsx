import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import CreateBookingModal from './CreateBookingModal';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  EyeIcon,
  XMarkIcon,
  PlusIcon
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
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

const BookingCalendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('dayGridMonth');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/bookings/admin/all?limit=1000');
      setBookings(response.data.bookings);
    } catch (error: any) {
      console.error('獲取預約列表失敗:', error);
      setError(error.response?.data?.message || '獲取預約列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const getCourtTypeColor = (courtType: string, status: string) => {
    // 如果狀態是已取消，統一使用灰色
    if (status === 'cancelled') {
      return '#9CA3AF'; // gray-400
    }
    
    // 根據場地類型設置顏色
    switch (courtType) {
      case 'competition':
        return status === 'confirmed' ? '#3B82F6' : '#60A5FA'; // blue-500 : blue-400
      case 'training':
        return status === 'confirmed' ? '#10B981' : '#34D399'; // green-500 : green-400
      case 'solo':
        return status === 'confirmed' ? '#8B5CF6' : '#A78BFA'; // violet-500 : violet-400
      case 'dink':
        return status === 'confirmed' ? '#F59E0B' : '#FBBF24'; // amber-500 : amber-400
      default:
        return status === 'confirmed' ? '#6B7280' : '#9CA3AF'; // gray-500 : gray-400
    }
  };

  // 將預約數據轉換為FullCalendar事件格式
  const events = bookings.map(booking => {
    const startDate = new Date(booking.date);
    const [startHour, startMinute] = booking.startTime.split(':').map(Number);
    const [endHour, endMinute] = booking.endTime.split(':').map(Number);
    
    startDate.setHours(startHour, startMinute, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(endHour, endMinute, 0, 0);

    return {
      id: booking._id,
      title: `${booking.court.name} - ${booking.user.name}`,
      start: startDate,
      end: endDate,
      backgroundColor: getCourtTypeColor(booking.court.type, booking.status),
      borderColor: getCourtTypeColor(booking.court.type, booking.status),
      textColor: 'white',
      extendedProps: {
        booking: booking
      }
    };
  });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '已確認';
      case 'pending':
        return '待確認';
      case 'cancelled':
        return '已取消';
      default:
        return status;
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

  const handleEventClick = (info: any) => {
    const booking = info.event.extendedProps.booking;
    setSelectedBooking(booking);
    setShowDetailModal(true);
  };

  const handleDateClick = (info: any) => {
    // 當點擊空白日期時，設置選中的日期並打開創建預約模態框
    const clickedDate = info.dateStr;
    setSelectedDate(clickedDate);
    setSelectedCourt('');
    setSelectedTime('');
    setShowCreateModal(true);
  };

  const handleViewChange = (newView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
    setView(newView);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 頁面標題和操作按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">預約日曆</h2>
          <p className="text-gray-600 mt-1">查看和管理預約安排，支持點擊空白區域創建新預約</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          創建預約
        </button>
      </div>

      {/* 錯誤信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 視圖切換和圖例 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* 視圖切換 */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewChange('dayGridMonth')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'dayGridMonth'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              月視圖
            </button>
            <button
              onClick={() => handleViewChange('timeGridWeek')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'timeGridWeek'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              週視圖
            </button>
            <button
              onClick={() => handleViewChange('timeGridDay')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'timeGridDay'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              日視圖
            </button>
          </div>
        </div>

        {/* 圖例 */}
        <div className="mt-4">
          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">比賽場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">訓練場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-violet-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">單人場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">練習場</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-400 rounded mr-2"></div>
              <span className="text-sm text-gray-600">已取消</span>
            </div>
            <div className="text-xs text-gray-500">
              * 深色表示已確認，淺色表示待確認
            </div>
          </div>
        </div>
      </div>

      {/* FullCalendar */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          locale="zh-tw"
          buttonText={{
            today: '今天',
            month: '月',
            week: '週',
            day: '日'
          }}
          eventDisplay="block"
          dayMaxEvents={3}
          moreLinkClick="popover"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          nowIndicator={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          titleFormat={{
            year: 'numeric',
            month: 'long'
          }}
        />
      </div>

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
                <div>
                  <label className="block text-sm font-medium text-gray-700">狀態</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText(selectedBooking.status)}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">用戶信息</label>
                <div className="mt-1 text-sm text-gray-900">
                  <p>{selectedBooking.user.name}</p>
                  <p>{selectedBooking.user.email}</p>
                  {selectedBooking.user.phone && <p>{selectedBooking.user.phone}</p>}
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
              
              {selectedBooking.specialRequests && selectedBooking.specialRequests.trim() && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">特殊要求</label>
                  <p className="text-sm text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg">{selectedBooking.specialRequests}</p>
                </div>
              )}
              
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

      {/* 創建預約模態框 */}
      <CreateBookingModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onBookingCreated={() => {
          fetchBookings();
          setShowCreateModal(false);
        }}
        selectedDate={selectedDate}
        selectedCourt={selectedCourt}
        selectedTime={selectedTime}
      />
    </div>
  );
};

export default BookingCalendar;
