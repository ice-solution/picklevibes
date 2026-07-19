import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import { BOOKING_CANCELLATION_POLICY_LINES } from '../constants/bookingCancellationPolicy';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  MapPinIcon,
  UserIcon,
  TableCellsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  EnvelopeIcon,
  KeyIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';

function resolveStore(booking: any) {
  if (booking?.store && typeof booking.store === 'object') return booking.store;
  if (booking?.court?.store && typeof booking.court.store === 'object') return booking.court.store;
  return null;
}

function hasHikAccessData(booking: any) {
  return !!(booking?.tempAuth?.code || booking?.tempAuth?.password);
}

function getTempAuthQrSrc(code?: string | null) {
  if (!code) return null;
  if (code.startsWith('data:')) return code;
  return `data:image/png;base64,${code}`;
}

const MyBookings: React.FC = () => {
  const { user } = useAuth();
  const { bookings, fetchBookings, loading } = useBooking();
  
  const [viewMode, setViewMode] = useState<'upcoming' | 'all'>('upcoming');
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  
  const itemsPerPage = 10;

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (bookings && bookings.length > 0 && user) {
      const userBookings = bookings.filter(booking => {
        try {
          const userId = typeof booking.user === 'string' ? booking.user : booking.user?._id;
          return userId === user.id;
        } catch (error) {
          console.warn('Error filtering booking by user:', error);
          return false;
        }
      });

      userBookings.sort((a, b) => {
        try {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          if (dateA.getTime() === dateB.getTime()) {
            return b.startTime.localeCompare(a.startTime);
          }
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          console.warn('Error sorting bookings:', error);
          return 0;
        }
      });

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

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentBookings = filteredBookings.slice(startIndex, endIndex);

  const handleViewModeChange = (mode: 'upcoming' | 'all') => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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

  const formatTime = (time: string) => time;

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

  const selectedStore = selectedBooking ? resolveStore(selectedBooking) : null;
  const selectedHasHik = selectedBooking ? hasHikAccessData(selectedBooking) : false;
  const selectedQrSrc = selectedHasHik
    ? getTempAuthQrSrc(selectedBooking?.tempAuth?.code)
    : null;

  const renderBookingCard = (booking: any) => {
    const store = resolveStore(booking);
    const hik = hasHikAccessData(booking);
    return (
      <button
        type="button"
        key={booking._id}
        onClick={() => setSelectedBooking(booking)}
        className="w-full text-left bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-md hover:border-primary-300 transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-medium text-gray-900">
                {booking.court?.name || '未知場地'}
              </span>
              <span className="text-sm text-gray-500">
                ({booking.court?.number}號場)
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                {getStatusText(booking.status)}
              </span>
              {hik && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  <KeyIcon className="w-3.5 h-3.5" />
                  門禁資料
                </span>
              )}
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

              {store?.name && (
                <div className="flex items-center space-x-1">
                  <MapPinIcon className="w-4 h-4" />
                  <span className="truncate">{store.name}</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-primary-600">
              {hik ? '點擊查看門禁 QR Code 與進門密碼（同確認電郵內容）' : '點擊查看預約確認電郵資料'}
            </p>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <p className="text-gray-600">查看預約詳情與門禁／確認電郵資料</p>
            </div>
          </div>
        </motion.div>

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
                  {upcomingBookings.map((booking) => renderBookingCard(booking))}
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
                          電郵／門禁
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentBookings.map((booking) => {
                        const hik = hasHikAccessData(booking);
                        return (
                          <tr
                            key={booking._id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedBooking(booking)}
                          >
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {hik ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <QrCodeIcon className="w-4 h-4" />
                                  查看 QR／密碼
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-primary-600">
                                  <EnvelopeIcon className="w-4 h-4" />
                                  查看確認資料
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

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

      {/* 預約詳情／電郵資料彈窗 */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedHasHik ? '門禁／確認電郵資料' : '預約確認電郵資料'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">與系統發送給您的電郵內容一致</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="關閉"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">預約編號</span>
                  <span className="font-mono text-gray-900 text-xs break-all text-right">{selectedBooking._id}</span>
                </div>
                {selectedStore?.name && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">店鋪</span>
                    <span className="text-gray-900 text-right">{selectedStore.name}</span>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">場地</span>
                  <span className="text-gray-900 text-right">
                    {selectedBooking.court?.name || '未知場地'}
                    {selectedBooking.court?.number != null ? `（${selectedBooking.court.number}號場）` : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">日期</span>
                  <span className="text-gray-900">{formatDate(selectedBooking.date)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">時間</span>
                  <span className="text-gray-900">
                    {formatTime(selectedBooking.startTime)} - {formatTime(selectedBooking.endTime)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">狀態</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>
                    {getStatusText(selectedBooking.status)}
                  </span>
                </div>
                {selectedBooking.players?.[0]?.email && (
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">收件電郵</span>
                    <span className="text-gray-900 text-right break-all">{selectedBooking.players[0].email}</span>
                  </div>
                )}
              </div>

              {selectedHasHik ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-4">
                  <div>
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <KeyIcon className="w-5 h-5" />
                      進場門禁資料
                    </h4>
                    <p className="text-sm text-blue-800 mt-1">
                      系統已發送門禁通知電郵。請於預約時間前約 10 分鐘到達，使用以下 QR Code 或密碼開門。
                    </p>
                  </div>

                  {selectedQrSrc && (
                    <div className="text-center bg-white rounded-lg border border-blue-100 p-4">
                      <p className="text-sm font-medium text-gray-800 mb-3">開門二維碼</p>
                      <img
                        src={selectedQrSrc}
                        alt="開門二維碼"
                        className="mx-auto max-w-[200px] w-full border border-gray-200 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">請在門禁設備前掃描此二維碼</p>
                    </div>
                  )}

                  {selectedBooking.tempAuth?.password && (
                    <div className="text-center bg-white rounded-lg border border-emerald-200 p-4">
                      <p className="text-sm font-medium text-emerald-800 mb-2">進門密碼</p>
                      <p className="text-2xl font-bold tracking-widest font-mono text-emerald-700">
                        {selectedBooking.tempAuth.password}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">若二維碼無法使用，可於門禁設備輸入此密碼</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="font-semibold text-amber-900 flex items-center gap-2">
                    <EnvelopeIcon className="w-5 h-5" />
                    預約確認通知
                  </h4>
                  <p className="text-sm text-amber-900/90 mt-2">
                    系統已發送預約確認電郵。
                    {selectedStore?.enableHikAccess
                      ? '此預約尚未產生門禁資料，如需重發請聯絡客服。'
                      : '此店鋪暫不提供自動門禁密碼，請於預約時段準時到場。'}
                  </p>
                  {selectedStore?.phone && (
                    <p className="text-sm text-amber-900 mt-2">
                      場地電話：{selectedStore.phone}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <h4 className="font-semibold text-yellow-900 text-sm mb-2">重要提醒</h4>
                <ul className="text-sm text-yellow-900/90 space-y-1 list-disc list-inside">
                  <li>請保持場地整潔，使用完畢後請清理現場</li>
                  <li>請穿著合適運動鞋進場</li>
                </ul>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="font-semibold text-gray-900 text-sm mb-2">取消及天氣政策</h4>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  {BOOKING_CANCELLATION_POLICY_LINES.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="w-full px-4 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
