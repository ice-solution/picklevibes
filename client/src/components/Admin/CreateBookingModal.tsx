import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  XMarkIcon,
  UserIcon,
  MapPinIcon,
  ClockIcon,
  UsersIcon,
  CalendarDaysIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface Court {
  _id: string;
  name: string;
  number: string;
  type: string;
  capacity: number;
}

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
  selectedDate?: string;
  selectedCourt?: string;
  selectedTime?: string;
}

const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onBookingCreated,
  selectedDate,
  selectedCourt,
  selectedTime
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 表單數據
  const [formData, setFormData] = useState({
    userId: '',
    courtId: selectedCourt || '',
    date: selectedDate || '',
    startTime: selectedTime || '',
    endTime: '',
    playerName: '',
    playerEmail: '',
    playerPhone: '',
    specialRequests: '',
    bypassRestrictions: false
  });

  // 數據選項
  const [users, setUsers] = useState<User[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);

  // 載入數據
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchCourts();
    }
  }, [isOpen]);

  // 更新表單數據當選中的日期/場地/時間改變時
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      date: selectedDate || prev.date,
      courtId: selectedCourt || prev.courtId,
      startTime: selectedTime || prev.startTime
    }));
  }, [selectedDate, selectedCourt, selectedTime]);

  // 生成所有時間選項
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      times.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return times;
  };

  // 生成結束時間選項
  const getAvailableEndTimes = (startTime: string) => {
    if (!startTime) return [];
    
    const startHour = parseInt(startTime.split(':')[0]);
    const endTimes = [];
    
    for (let i = startHour + 1; i <= 24; i++) {
      endTimes.push(`${i.toString().padStart(2, '0')}:00`);
    }
    
    return endTimes;
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users?limit=100');
      setUsers(response.data.users || response.data || []);
    } catch (error) {
      console.error('載入用戶失敗:', error);
    }
  };

  const fetchCourts = async () => {
    try {
      const response = await axios.get('/courts?all=true');
      setCourts(response.data.courts || []);
    } catch (error) {
      console.error('載入場地失敗:', error);
    }
  };


  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCheckboxChange = (field: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 驗證必填字段
      if (!formData.userId || !formData.courtId || !formData.date || !formData.startTime || !formData.endTime) {
        throw new Error('請填寫所有必填字段');
      }

      if (!formData.playerName.trim()) {
        throw new Error('請填寫參與者姓名');
      }

      // 創建預約
      await axios.post('/bookings', {
        user: formData.userId,
        court: formData.courtId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        players: [{
          name: formData.playerName.trim(),
          email: formData.playerEmail.trim(),
          phone: formData.playerPhone.trim()
        }],
        specialRequests: formData.specialRequests,
        bypassRestrictions: formData.bypassRestrictions, // 管理員 bypass 所有限制
        payment: {
          method: 'admin_created',
          status: 'completed',
          amount: 0 // 管理員創建的預約可以設為免費
        }
      });

      // 重置表單
      setFormData({
        userId: '',
        courtId: selectedCourt || '',
        date: selectedDate || '',
        startTime: selectedTime || '',
        endTime: '',
        playerName: '',
        playerEmail: '',
        playerPhone: '',
        specialRequests: '',
        bypassRestrictions: false
      });

      onBookingCreated();
      onClose();
    } catch (error: any) {
      console.error('創建預約失敗:', error);
      setError(error.response?.data?.message || error.message || '創建預約失敗');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* 標題欄 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">手動創建預約</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* 用戶選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="w-4 h-4 inline mr-2" />
              選擇用戶 *
            </label>
            <select
              value={formData.userId}
              onChange={(e) => handleInputChange('userId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              <option value="">請選擇用戶</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          {/* 場地選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MapPinIcon className="w-4 h-4 inline mr-2" />
              選擇場地 *
            </label>
            <select
              value={formData.courtId}
              onChange={(e) => handleInputChange('courtId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              <option value="">請選擇場地</option>
              {courts.map(court => (
                <option key={court._id} value={court._id}>
                  {court.name} ({court.number}號場) - {court.type}
                </option>
              ))}
            </select>
          </div>

          {/* 日期選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarDaysIcon className="w-4 h-4 inline mr-2" />
              預約日期 *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* 時間選擇 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ClockIcon className="w-4 h-4 inline mr-2" />
                開始時間 *
              </label>
              <select
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">請選擇開始時間</option>
                {generateTimeOptions().map((time, index) => (
                  <option key={index} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <ClockIcon className="w-4 h-4 inline mr-2" />
                結束時間 *
              </label>
              <select
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">請選擇結束時間</option>
                {getAvailableEndTimes(formData.startTime).map(time => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 參與者信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <UsersIcon className="w-4 h-4 inline mr-2" />
              參與者信息
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="參與者姓名 *"
                value={formData.playerName}
                onChange={(e) => handleInputChange('playerName', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
              <input
                type="email"
                placeholder="郵箱"
                value={formData.playerEmail}
                onChange={(e) => handleInputChange('playerEmail', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <input
                type="tel"
                placeholder="電話"
                value={formData.playerPhone}
                onChange={(e) => handleInputChange('playerPhone', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* 特殊要求 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              特殊要求
            </label>
            <textarea
              value={formData.specialRequests}
              onChange={(e) => handleInputChange('specialRequests', e.target.value)}
              placeholder="如有特殊要求請在此填寫..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* 管理員選項 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="bypassRestrictions"
                checked={formData.bypassRestrictions}
                onChange={(e) => handleCheckboxChange('bypassRestrictions', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="bypassRestrictions" className="ml-3 text-sm font-medium text-gray-900">
                <span className="text-yellow-800 font-semibold">管理員權限：</span>
                繞過所有限制（積分不足、時間限制、可用性檢查等）
              </label>
            </div>
            <p className="mt-2 text-xs text-yellow-700">
              ⚠️ 勾選此選項將忽略所有系統限制，包括：用戶積分餘額、預約時間限制、場地可用性檢查等。
              請謹慎使用此功能。
            </p>
          </div>

          {/* 按鈕 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <CheckCircleIcon className="w-4 h-4 mr-2" />
              )}
              {loading ? '創建中...' : '創建預約'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CreateBookingModal;
