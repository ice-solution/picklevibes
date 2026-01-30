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
  PlusIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon
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
  specialRequestsProcessed?: boolean;
  adminNotes?: Array<{
    _id: string;
    content: string;
    createdBy: {
      _id: string;
      name: string;
      email: string;
    };
    createdAt: string;
  }>;
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
  const [resendingEmail, setResendingEmail] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState<string>('');

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

    // 檢查狀態
    const hasSpecialRequests = booking.specialRequests && booking.specialRequests.trim().length > 0;
    const hasAdminNotes = booking.adminNotes && booking.adminNotes.length > 0;
    const isSpecialRequestsProcessed = booking.specialRequestsProcessed === true;
    
    // 計算邊框顏色和樣式
    // 如果特殊要求已處理，使用綠色；否則如果有特殊要求，使用紅色
    // 如果有留言，使用藍色
    // 如果有多個狀態，使用漸變色
    let borderColor = getCourtTypeColor(booking.court.type, booking.status);
    let classNames: string[] = [];
    
    // 構建狀態數組
    const states: string[] = [];
    if (hasSpecialRequests && !isSpecialRequestsProcessed) {
      states.push('special-request');
    }
    if (isSpecialRequestsProcessed) {
      states.push('processed');
    }
    if (hasAdminNotes) {
      states.push('has-notes');
    }
    
    // 根據狀態設置邊框
    if (states.length === 1) {
      // 單一狀態
      if (states[0] === 'special-request') {
        borderColor = '#DC2626'; // 紅色 - 特殊要求未處理
        classNames.push('booking-red-border');
      } else if (states[0] === 'processed') {
        borderColor = '#10B981'; // 綠色 - 已處理
        classNames.push('booking-green-border');
      } else if (states[0] === 'has-notes') {
        borderColor = '#3B82F6'; // 藍色 - 有留言
        classNames.push('booking-blue-border');
      }
    } else if (states.length === 2) {
      // 兩個狀態，使用漸變色
      classNames.push('booking-gradient-border');
      // 根據狀態組合決定漸變方向
      if (states.includes('special-request') && states.includes('has-notes')) {
        classNames.push('gradient-red-blue');
      } else if (states.includes('special-request') && states.includes('processed')) {
        classNames.push('gradient-red-green');
      } else if (states.includes('processed') && states.includes('has-notes')) {
        classNames.push('gradient-green-blue');
      }
    } else if (states.length === 3) {
      // 三個狀態，使用三色漸變
      classNames.push('booking-gradient-border');
      classNames.push('gradient-red-blue-green');
    }

    // 計算最終的邊框顏色和寬度
    let finalBorderColor = borderColor;
    let finalBorderWidth = 1;
    
    if (classNames.includes('booking-gradient-border')) {
      // 漸變色邊框時，使用透明邊框，讓 CSS 處理漸變
      finalBorderColor = 'transparent';
      finalBorderWidth = 0;
    } else if (states.length > 0) {
      // 單一狀態時，使用實色邊框
      // 已處理狀態使用更粗的邊框（5px），其他狀態使用 3px
      if (states[0] === 'processed') {
        finalBorderWidth = 5;
      } else {
        finalBorderWidth = 3;
      }
    }

    return {
      id: booking._id,
      title: `${booking.court.name} - ${booking.user.name}`,
      start: startDate,
      end: endDate,
      backgroundColor: getCourtTypeColor(booking.court.type, booking.status),
      borderColor: finalBorderColor,
      borderWidth: finalBorderWidth,
      textColor: 'white',
      classNames: classNames.length > 0 ? classNames.join(' ') : undefined,
      extendedProps: {
        booking: booking,
        states: states
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
    setNewNoteContent('');
    setEditingNoteId(null);
    setEditingNoteContent('');
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

  const handleResendEmail = async () => {
    if (!selectedBooking) return;
    
    if (!window.confirm('確認要重新發送開門通知郵件嗎？')) {
      return;
    }
    
    try {
      setResendingEmail(true);
      const response = await axios.post(`/bookings/${selectedBooking._id}/resend-access-email`);
      alert(`郵件已重新發送到：${response.data.email}`);
    } catch (error: any) {
      console.error('重發郵件失敗:', error);
      alert(error.response?.data?.message || '重發郵件失敗，請稍後再試');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedBooking || !newNoteContent.trim()) return;

    try {
      setAddingNote(true);
      const response = await axios.post(`/bookings/${selectedBooking._id}/admin-notes`, {
        content: newNoteContent.trim()
      });
      setSelectedBooking(response.data.booking);
      setNewNoteContent('');
      fetchBookings();
    } catch (error: any) {
      console.error('添加留言失敗:', error);
      alert(error.response?.data?.message || '添加留言失敗，請稍後再試');
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!selectedBooking || !editingNoteContent.trim()) return;

    try {
      const response = await axios.put(`/bookings/${selectedBooking._id}/admin-notes/${noteId}`, {
        content: editingNoteContent.trim()
      });
      setSelectedBooking(response.data.booking);
      setEditingNoteId(null);
      setEditingNoteContent('');
      fetchBookings();
    } catch (error: any) {
      console.error('編輯留言失敗:', error);
      alert(error.response?.data?.message || '編輯留言失敗，請稍後再試');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedBooking) return;
    
    if (!window.confirm('確定要刪除此留言嗎？')) return;

    try {
      const response = await axios.delete(`/bookings/${selectedBooking._id}/admin-notes/${noteId}`);
      setSelectedBooking(response.data.booking);
      fetchBookings();
      alert('留言已刪除');
    } catch (error: any) {
      console.error('刪除留言失敗:', error);
      alert(error.response?.data?.message || '刪除留言失敗，請稍後再試');
    }
  };

  const handleMarkAsProcessed = async () => {
    if (!selectedBooking) return;

    try {
      const response = await axios.put(`/bookings/${selectedBooking._id}/special-requests-processed`, {
        specialRequestsProcessed: true
      });
      setSelectedBooking(response.data.booking);
      fetchBookings();
      alert('已標記為已處理');
    } catch (error: any) {
      console.error('更新處理狀態失敗:', error);
      alert(error.response?.data?.message || '更新失敗，請稍後再試');
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
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-red-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">有特殊要求（未處理）</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-green-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">特殊要求已處理</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-blue-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">有管理員留言</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded mr-2" style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderImage: 'linear-gradient(135deg, #DC2626 0%, #3B82F6 50%, #10B981 100%) 1'
              }}></div>
              <span className="text-sm text-gray-600">多種狀態（漸變色）</span>
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
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">預約詳情</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedBooking(null);
                  setNewNoteContent('');
                  setEditingNoteId(null);
                  setEditingNoteContent('');
                }}
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">特殊要求</label>
                    {!selectedBooking.specialRequestsProcessed && (
                      <button
                        onClick={handleMarkAsProcessed}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>標記為已處理</span>
                      </button>
                    )}
                    {selectedBooking.specialRequestsProcessed && (
                      <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-lg">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>已處理</span>
                      </span>
                    )}
                  </div>
                  <div className={`text-sm text-gray-900 mt-1 p-3 rounded-lg ${
                    selectedBooking.specialRequestsProcessed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {selectedBooking.specialRequests}
                  </div>
                </div>
              )}

              {/* 管理員留言 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    <span>管理員留言 ({selectedBooking.adminNotes?.length || 0})</span>
                  </label>
                </div>

                {/* 留言列表 */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {selectedBooking.adminNotes && selectedBooking.adminNotes.length > 0 ? (
                    selectedBooking.adminNotes.map((note) => (
                      <div key={note._id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        {editingNoteId === note._id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteContent('');
                                }}
                                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleEditNote(note._id)}
                                className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                                <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                                  <span>{note.createdBy?.name || '未知管理員'}</span>
                                  <span>•</span>
                                  <span>{new Date(note.createdAt).toLocaleString('zh-TW')}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note._id);
                                    setEditingNoteContent(note.content);
                                  }}
                                  className="p-1 text-gray-500 hover:text-primary-600 transition-colors"
                                  title="編輯留言"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note._id)}
                                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                  title="刪除留言"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-400 italic">暫無留言</p>
                    </div>
                  )}
                </div>

                {/* 添加新留言 */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-start space-x-2">
                    <textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      rows={3}
                      placeholder="添加新留言..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote || !newNoteContent.trim()}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center space-x-1"
                    >
                      {addingNote ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>添加中...</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon className="w-4 h-4" />
                          <span>添加</span>
                        </>
                      )}
                    </button>
                  </div>
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

              {/* 管理動作 */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendingEmail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded flex items-center gap-2"
                  >
                    {resendingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        發送中...
                      </>
                    ) : (
                      '重發開門通知郵件'
                    )}
                  </button>
                  {selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={async () => {
                        if (!window.confirm('確認要取消此預約並退回積分嗎？')) return;
                        try {
                          await axios.put(`/bookings/${selectedBooking._id}/cancel`, { reason: 'Admin cancel via calendar' });
                          alert('預約已取消，積分已退回');
                          setShowDetailModal(false);
                          fetchBookings();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || '取消失敗');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      取消預約並退款
                    </button>
                  )}
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
