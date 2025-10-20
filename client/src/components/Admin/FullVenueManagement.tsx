import React, { useState, useEffect } from 'react';
import { 
  CalendarIcon, 
  ClockIcon, 
  UsersIcon, 
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface FullVenueBooking {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPlayers: number;
  status: string;
  pricing: {
    finalPrice: number;
  };
  user: {
    name: string;
    email: string;
    phone: string;
  };
  court: {
    name: string;
    type: string;
  };
  fullVenueBookings: any[];
  notes?: string;
}

const FullVenueManagement: React.FC = () => {
  const [bookings, setBookings] = useState<FullVenueBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<FullVenueBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // 創建包場表單狀態
  const [createForm, setCreateForm] = useState({
    date: '',
    startTime: '',
    endTime: '',
    duration: 120,
    players: [{ name: '', email: '', phone: '' }],
    totalPlayers: 1,
    notes: ''
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch('/api/full-venue/list', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setBookings(data.data);
      }
    } catch (error) {
      console.error('獲取包場預約失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 三次確認
    const confirm1 = window.confirm('確認要創建包場預約嗎？這將預約所有場地。');
    if (!confirm1) return;
    
    const confirm2 = window.confirm('再次確認：包場預約將同時預約單人場、訓練場、比賽場。');
    if (!confirm2) return;
    
    const confirm3 = window.confirm('最後確認：您確定要創建包場預約嗎？');
    if (!confirm3) return;

    try {
      const response = await fetch('/api/full-venue/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(createForm)
      });

      const data = await response.json();
      if (data.success) {
        alert('包場預約創建成功！');
        setShowCreateModal(false);
        fetchBookings();
        resetForm();
      } else {
        alert(`創建失敗: ${data.message}`);
      }
    } catch (error) {
      console.error('創建包場預約失敗:', error);
      alert('創建包場預約失敗');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const confirmed = window.confirm('確認要取消這個包場預約嗎？這將取消所有相關場地的預約。');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/full-venue/${bookingId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (data.success) {
        alert('包場預約已取消');
        fetchBookings();
      } else {
        alert(`取消失敗: ${data.message}`);
      }
    } catch (error) {
      console.error('取消包場預約失敗:', error);
      alert('取消包場預約失敗');
    }
  };

  const resetForm = () => {
    setCreateForm({
      date: '',
      startTime: '',
      endTime: '',
      duration: 120,
      players: [{ name: '', email: '', phone: '' }],
      totalPlayers: 1,
      notes: ''
    });
  };

  const addPlayer = () => {
    setCreateForm(prev => ({
      ...prev,
      players: [...prev.players, { name: '', email: '', phone: '' }]
    }));
  };

  const removePlayer = (index: number) => {
    setCreateForm(prev => ({
      ...prev,
      players: prev.players.filter((_, i) => i !== index)
    }));
  };

  const updatePlayer = (index: number, field: string, value: string) => {
    setCreateForm(prev => ({
      ...prev,
      players: prev.players.map((player, i) => 
        i === index ? { ...player, [field]: value } : player
      )
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircleIcon className="w-5 h-5" />;
      case 'pending': return <ClockIcon className="w-5 h-5" />;
      case 'cancelled': return <XCircleIcon className="w-5 h-5" />;
      default: return <ClockIcon className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 標題和創建按鈕 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">包場管理</h2>
          <p className="text-gray-600">管理包場預約，一次預約所有場地</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          創建包場預約
        </button>
      </div>

      {/* 包場預約列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">包場預約列表</h3>
        </div>
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
                  價格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  狀態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr key={booking._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(booking.date).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.startTime} - {booking.endTime}
                        </div>
                        <div className="text-sm text-gray-500">
                          {booking.totalPlayers} 人
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{booking.user.name}</div>
                    <div className="text-sm text-gray-500">{booking.user.email}</div>
                    <div className="text-sm text-gray-500">{booking.user.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="w-5 h-5 text-gray-400 mr-1" />
                      <span className="text-sm font-medium text-gray-900">
                        ${booking.pricing.finalPrice}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {getStatusIcon(booking.status)}
                      <span className="ml-1">{booking.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        詳情
                      </button>
                      {booking.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          取消
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 創建包場預約模態框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">創建包場預約</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              {/* 日期和時間 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    預約日期 *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.date}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始時間 *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.startTime}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    結束時間 *
                  </label>
                  <input
                    type="time"
                    required
                    value={createForm.endTime}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* 參與者信息 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  參與者信息 *
                </label>
                {createForm.players.map((player, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 border border-gray-200 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        姓名 *
                      </label>
                      <input
                        type="text"
                        required
                        value={player.name}
                        onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="參與者姓名"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        郵箱 *
                      </label>
                      <input
                        type="email"
                        required
                        value={player.email}
                        onChange={(e) => updatePlayer(index, 'email', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="參與者郵箱"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話 *
                      </label>
                      <div className="flex">
                        <input
                          type="tel"
                          required
                          value={player.phone}
                          onChange={(e) => updatePlayer(index, 'phone', e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="參與者電話"
                        />
                        {createForm.players.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePlayer(index)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPlayer}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + 添加參與者
                </button>
              </div>

              {/* 總人數 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  總人數 *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="24"
                  value={createForm.totalPlayers}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, totalPlayers: parseInt(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備註
                </label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="包場預約備註..."
                />
              </div>

              {/* 警告提示 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 mr-2" />
                  <div className="text-sm text-yellow-800">
                    <strong>包場預約警告：</strong>
                    <ul className="mt-1 list-disc list-inside">
                      <li>包場預約將同時預約所有場地（單人場、訓練場、比賽場）</li>
                      <li>請確保時間段內沒有其他預約</li>
                      <li>包場預約無法取消，請謹慎操作</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 按鈕 */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  創建包場預約
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 包場預約詳情模態框 */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">包場預約詳情</h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">預約信息</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <CalendarIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {new Date(selectedBooking.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <ClockIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {selectedBooking.startTime} - {selectedBooking.endTime}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <UsersIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {selectedBooking.totalPlayers} 人
                      </span>
                    </div>
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="w-5 h-5 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        ${selectedBooking.pricing.finalPrice}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">用戶信息</h4>
                  <div className="space-y-2">
                    <div className="text-sm text-gray-900">
                      <strong>姓名：</strong>{selectedBooking.user.name}
                    </div>
                    <div className="text-sm text-gray-900">
                      <strong>郵箱：</strong>{selectedBooking.user.email}
                    </div>
                    <div className="text-sm text-gray-900">
                      <strong>電話：</strong>{selectedBooking.user.phone}
                    </div>
                  </div>
                </div>
              </div>

              {/* 場地詳情 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">場地詳情</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedBooking.fullVenueBookings.map((courtBooking, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="text-sm font-medium text-gray-900">
                        {courtBooking.court?.name || `場地 ${index + 1}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {courtBooking.court?.type || '未知類型'}
                      </div>
                      <div className="text-sm text-gray-500">
                        價格: ${courtBooking.pricing?.finalPrice || 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 備註 */}
              {selectedBooking.notes && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">備註</h4>
                  <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                    {selectedBooking.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
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

export default FullVenueManagement;
