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
  CheckCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import UserAutocomplete from '../Common/UserAutocomplete';
import { isFullVenueEnabledForStoreSlug } from '../../constants/storeFeatures';

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
  isActive?: boolean;
}

interface BookingConflictDetail {
  bookingId: string;
  courtName: string;
  courtType: string;
  date: string;
  startTime: string;
  endTime: string;
  statusLabel: string;
  userName: string;
  source: string;
  summary: string;
}

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookingCreated: () => void;
  selectedDate?: string;
  selectedCourt?: string;
  selectedTime?: string;
  /** 從日曆店鋪篩選帶入預設店鋪 */
  initialStoreId?: string;
}

const BookingConflictList: React.FC<{ conflicts: BookingConflictDetail[] }> = ({
  conflicts
}) => (
  <ul className="mt-2 space-y-1.5 text-left max-h-40 overflow-y-auto overscroll-contain pr-1">
    {conflicts.map((c) => (
      <li
        key={c.bookingId}
        className="text-xs bg-white/80 border border-red-200 rounded-md px-2.5 py-1.5"
      >
        <div className="font-medium text-red-900 leading-tight">{c.courtName}</div>
        <div className="text-red-800 mt-0.5 leading-tight">
          {c.date} {c.startTime}–{c.endTime}
          <span className="text-red-600/90"> · {c.statusLabel}</span>
        </div>
        <div className="text-red-700/80 text-[11px] mt-0.5 truncate">
          {c.source} · {c.userName}
        </div>
      </li>
    ))}
  </ul>
);

const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onBookingCreated,
  selectedDate,
  selectedCourt,
  selectedTime,
  initialStoreId
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictDetails, setConflictDetails] = useState<BookingConflictDetail[]>([]);
  
  // 表單數據
  const [formData, setFormData] = useState({
    userId: '',
    courtId: selectedCourt || '',
    date: selectedDate || '',
    startTime: selectedTime || '',
    endTime: '',
    totalPlayers: 1,
    playerName: '',
    playerEmail: '',
    playerPhone: '',
    specialRequests: '',
    bypassRestrictions: false,
    isCustomPoints: false,
    customPoints: 0
  });

  // 選中的用戶
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // 包場確認狀態
  const [showFullVenueConfirm, setShowFullVenueConfirm] = useState(false);
  const [fullVenueStep, setFullVenueStep] = useState('price'); // 'price', 'confirm', 'points'
  const [fullVenueDeduction, setFullVenueDeduction] = useState(0);
  

  // 數據選項
  const [stores, setStores] = useState<{ _id: string; name: string; slug?: string; isActive?: boolean; fullVenueHourlyRate?: number }[]>([]);
  const [storeId, setStoreId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);

  const selectedStore = stores.find((s) => s._id === storeId);
  const fullVenueEnabled = isFullVenueEnabledForStoreSlug(selectedStore?.slug);

  const calcBookingHours = (startTime: string, endTime: string) => {
    const toMin = (t: string) => {
      if (t === '24:00') return 24 * 60;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    if (!startTime || !endTime) return 1;
    const mins = Math.max(0, toMin(endTime) - toMin(startTime));
    return Math.max(1, Math.round(mins / 60) || 1);
  };

  const suggestedFullVenueCharge = () => {
    const hours = calcBookingHours(formData.startTime, formData.endTime);
    const rate = Math.max(0, Number(selectedStore?.fullVenueHourlyRate) || 0);
    return rate > 0 ? rate * hours : 0;
  };

  useEffect(() => {
    if (isOpen) {
      axios.get('/stores/admin/all').then((r) => setStores(r.data.stores || [])).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialStoreId) {
      setStoreId(initialStoreId);
    }
  }, [isOpen, initialStoreId]);

  useEffect(() => {
    if (isOpen && storeId) {
      fetchCourts(storeId);
    } else if (isOpen) {
      setCourts([]);
    }
  }, [isOpen, storeId]);

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


  const fetchCourts = async (sid: string) => {
    try {
      const response = await axios.get(`/courts?all=true&store=${sid}`);
      setCourts(response.data.courts || []);
    } catch (error) {
      console.error('載入場地失敗:', error);
    }
  };


  const applyApiError = (err: any, fallback: string) => {
    const data = err?.response?.data;
    const conflicts: BookingConflictDetail[] = data?.conflicts || [];
    setConflictDetails(conflicts);
    setError(data?.message || err?.message || fallback);
  };

  const checkFullVenueAvailability = async (): Promise<boolean> => {
    if (!storeId) {
      setError('請先選擇店鋪');
      return false;
    }
    if (!formData.date || !formData.startTime || !formData.endTime) {
      setError('請先選擇日期與時段');
      return false;
    }
    try {
      const res = await axios.post('/full-venue/check-availability', {
        storeId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime
      });
      const conflicts: BookingConflictDetail[] = res.data?.data?.conflicts || [];
      if (!res.data?.data?.available) {
        setConflictDetails(conflicts);
        setError('以下時段已有預約，無法包場：');
        return false;
      }
      setConflictDetails([]);
      return true;
    } catch (err: any) {
      applyApiError(err, '檢查包場可用性失敗');
      return false;
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (['date', 'startTime', 'endTime', 'courtId'].includes(field)) {
      setConflictDetails([]);
      if (field !== 'courtId') setError(null);
    }
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

  // 處理用戶選擇
  const handleUserSelect = (user: User | null) => {
    setSelectedUser(user);
    if (user) {
      setFormData(prev => ({
        ...prev,
        userId: user._id,
        playerName: user.name,
        playerEmail: user.email,
        playerPhone: user.phone || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        userId: '',
        playerName: '',
        playerEmail: '',
        playerPhone: ''
      }));
    }
  };

  const handleFullVenueBooking = async () => {
    setLoading(true);
    setError(null);
    setConflictDetails([]);
    // 失敗時保持 overlay 開啟，方便看到錯誤並按取消／重試

    try {
      if (!storeId) {
        throw new Error('請先選擇店鋪');
      }

      // 包場扣款由 API 統一處理（含自訂議價；避免重複扣款）
      const hours = calcBookingHours(formData.startTime, formData.endTime);
      const fullVenueData = {
        storeId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        duration: hours * 60,
        totalPlayers: formData.totalPlayers,
        players: [{
          name: formData.playerName,
          email: formData.playerEmail,
          phone: formData.playerPhone
        }],
        specialRequests: formData.specialRequests.trim() || undefined,
        userId: formData.userId, // 管理員為指定用戶創建
        pointsDeduction: fullVenueDeduction, // 傳遞積分扣除數量（可改店鋪預設）
        bypassRestrictions: formData.bypassRestrictions
      };

      console.log('🔍 創建包場預約:', fullVenueData);
      const response = await axios.post('/full-venue/create', fullVenueData);
      console.log('✅ 包場預約成功:', response.data);
      
      const createdBookings = response.data.data.bookings;

      setShowFullVenueConfirm(false);
      setFullVenueStep('price');
      onBookingCreated();
      onClose();
      
      const successMessage = `包場預約創建成功！\n已創建 ${createdBookings.length} 個預約記錄。${fullVenueDeduction > 0 ? `\n已扣除 ${fullVenueDeduction} 積分。` : ''}`;
      alert(successMessage);
      
    } catch (error: any) {
      console.error('包場預約創建失敗:', error);
      applyApiError(error, '包場預約創建失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 驗證必填字段
      if (!storeId || !formData.userId || !formData.courtId || !formData.date || !formData.startTime || !formData.endTime) {
        throw new Error('請填寫所有必填字段（含店鋪）');
      }

      if (!formData.totalPlayers || formData.totalPlayers < 1) {
        throw new Error('請選擇參與人數');
      }

      if (!formData.playerName.trim()) {
        throw new Error('請填寫參與者姓名');
      }

      if (formData.courtId === 'full_venue' && !fullVenueEnabled) {
        throw new Error('此店鋪暫不開放包場預約');
      }

      // 如果選擇了包場，顯示確認對話框
      if (formData.courtId === 'full_venue') {
        // 確保所有必填字段都已填寫
        if (!formData.endTime) {
          throw new Error('請選擇結束時間');
        }
        setShowFullVenueConfirm(true);
        setFullVenueStep('price');
        setLoading(false);
        return;
      }

      // 創建預約
      await axios.post('/bookings', {
        user: formData.userId,
        court: formData.courtId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        totalPlayers: formData.totalPlayers,
        players: [{
          name: formData.playerName.trim(),
          email: formData.playerEmail.trim(),
          phone: formData.playerPhone.trim()
        }],
        specialRequests: formData.specialRequests,
        bypassRestrictions: formData.bypassRestrictions, // 管理員 bypass 所有限制
        isCustomPoints: formData.isCustomPoints, // 自訂積分選項
        customPoints: formData.customPoints, // 自訂積分數量
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
        totalPlayers: 1,
        playerName: '',
        playerEmail: '',
        playerPhone: '',
        specialRequests: '',
        bypassRestrictions: false,
        isCustomPoints: false,
        customPoints: 0
      });
      setSelectedUser(null);

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
              <p>{error}</p>
              {conflictDetails.length > 0 && (
                <BookingConflictList conflicts={conflictDetails} />
              )}
            </div>
          )}

          {/* 用戶選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="w-4 h-4 inline mr-2" />
              選擇用戶 *
            </label>
            <UserAutocomplete
              value={selectedUser ? `${selectedUser.name} (${selectedUser.email})` : ''}
              onChange={handleUserSelect}
              placeholder="輸入用戶姓名或郵箱搜索..."
              className="w-full"
            />
            {selectedUser && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckIcon className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm text-green-800">
                    已選擇用戶：{selectedUser.name} ({selectedUser.email})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 店鋪選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">選擇店鋪 *</label>
            <select
              value={storeId}
              onChange={(e) => {
                setStoreId(e.target.value);
                handleInputChange('courtId', '');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="">請選擇店鋪</option>
              {stores.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}{s.isActive === false ? '（未上線）' : ''}
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
              disabled={!storeId}
            >
              <option value="">請選擇場地</option>
              {courts
                .filter(court => court.type !== 'full_venue') // 過濾掉包場場地
                .map(court => (
                  <option key={court._id} value={court._id}>
                    {court.name} ({court.number}號場) - {court.type}
                    {court.isActive === false ? ' [停用]' : ''}
                  </option>
                ))}
              {fullVenueEnabled && (
                <option value="full_venue">🏢 包場 (所有場地)</option>
              )}
            </select>
            {storeId && !fullVenueEnabled && (
              <p className="mt-1 text-xs text-amber-700">此店鋪暫不開放包場預約。</p>
            )}
            {storeId &&
              formData.courtId === 'full_venue' &&
              courts.filter((c) => c.type !== 'full_venue').length === 0 && (
              <p className="mt-1 text-xs text-red-600">
                此店鋪目前沒有可包場的場地資料，請先在「場地管理」為該店建立／啟用場地。
              </p>
            )}
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

          {/* 參與人數 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UsersIcon className="w-4 h-4 inline mr-2" />
              參與人數 *
            </label>
            <select
              value={formData.totalPlayers}
              onChange={(e) => handleInputChange('totalPlayers', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                <option key={num} value={num}>
                  {num} 人
                </option>
              ))}
            </select>
          </div>

          {/* 參與者信息 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              <UsersIcon className="w-4 h-4 inline mr-2" />
              參與者信息
              {selectedUser && (
                <span className="text-xs text-gray-500 ml-2">
                  (已自動填入選中用戶的信息，可手動修改)
                </span>
              )}
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
            <p className="mt-2 text-xs text-gray-700">
              <strong>未勾選</strong>時：後台建單可超出一般用戶的「可預約最遠天數」與「營業時段」，
              其餘規則與一般用戶相同（場地須啟用、1～2 小時、時段不可重疊），並依價格<strong>扣除積分</strong>。
            </p>
          </div>

          {/* 自訂積分選項 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isCustomPoints"
                checked={formData.isCustomPoints}
                onChange={(e) => handleCheckboxChange('isCustomPoints', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isCustomPoints" className="ml-3 text-sm font-medium text-gray-900">
                <span className="text-blue-800 font-semibold">自訂積分扣除：</span>
                使用自訂積分數量而非系統計算的價格
              </label>
            </div>
            {formData.isCustomPoints && (
              <div className="mt-3">
                <label htmlFor="customPoints" className="block text-sm font-medium text-gray-700 mb-1">
                  自訂積分數量
                </label>
                <input
                  type="number"
                  id="customPoints"
                  value={formData.customPoints}
                  onChange={(e) => handleInputChange('customPoints', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="輸入自訂積分數量"
                  min="0"
                />
                <p className="mt-1 text-xs text-blue-700">
                  💡 系統將使用此積分數量進行扣除，而非根據場地和時段計算的標準價格
                </p>
              </div>
            )}
          </div>

          {/* 包場確認對話框 */}
          {showFullVenueConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-md w-full max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pt-6 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                  </div>

                  {error && (
                    <div className="mb-4 text-left bg-red-50 border border-red-200 text-red-700 px-3 py-3 rounded-lg">
                      <p className="text-sm font-medium">{error}</p>
                      {conflictDetails.length > 0 && (
                        <BookingConflictList conflicts={conflictDetails} />
                      )}
                    </div>
                  )}
                  
                  {fullVenueStep === 'price' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        包場價格提醒
                      </h3>
                      
                      {/* 價格提醒 */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">💰 包場價格參考</h4>
                        <div className="text-xs text-blue-800 space-y-1">
                          {suggestedFullVenueCharge() > 0 ? (
                            <>
                              <div>• 店鋪包場時薪：{selectedStore?.fullVenueHourlyRate} 積分／小時</div>
                              <div>
                                • 此時段建議：{suggestedFullVenueCharge()} 積分
                                （{calcBookingHours(formData.startTime, formData.endTime)} 小時）
                              </div>
                              <div className="text-blue-700/80">下一步可自行修改扣款金額</div>
                            </>
                          ) : (
                            <>
                              <div>• 此店尚未設定包場時薪</div>
                              <div>• 未輸入扣款時，將改用各場牌價加總</div>
                              <div>• 請至「店鋪管理」設定 fullVenueHourlyRate，或下一步手動輸入</div>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-4">
                        包場將同時 hold 店鋪內所有場地（含停用），該時段不可再被預約
                      </p>
                    </div>
                  )}
                  
                  {fullVenueStep === 'confirm' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        確認包場
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        您確定要包場嗎？這將為該店所有場地建立預約。
                      </p>
                      <p className="text-xs text-gray-600 mb-4">
                        {formData.date} {formData.startTime}–{formData.endTime}
                      </p>
                    </div>
                  )}
                  
                  {fullVenueStep === 'points' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        扣除積分
                      </h3>
                      
                      {/* 積分扣除選項 */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-yellow-900 mb-2">💳 扣除積分數量</h4>
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={fullVenueDeduction}
                            onChange={(e) => setFullVenueDeduction(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-yellow-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            placeholder="請輸入扣除積分數量"
                            min="0"
                          />
                          {suggestedFullVenueCharge() > 0 && (
                            <p className="text-xs text-yellow-800">
                              建議（店鋪時薪 × 時數）：{suggestedFullVenueCharge()} 積分
                              <button
                                type="button"
                                className="ml-2 underline"
                                onClick={() => setFullVenueDeduction(suggestedFullVenueCharge())}
                              >
                                套用
                              </button>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-4">
                        可依店鋪包場價預填，亦可自行修改。餘額不足時不會建立預約。
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 flex gap-3 px-6 py-4 border-t border-gray-100 bg-white">
                  <button
                    type="button"
                    onClick={() => {
                      setShowFullVenueConfirm(false);
                      setFullVenueStep('price');
                      setError(null);
                      setConflictDetails([]);
                      setFormData(prev => ({ ...prev, courtId: '' }));
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={loading || (fullVenueStep === 'price' && conflictDetails.length > 0)}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (fullVenueStep === 'price') {
                        setLoading(true);
                        setError(null);
                        setConflictDetails([]);
                        const ok = await checkFullVenueAvailability();
                        setLoading(false);
                        if (!ok) return;
                        setFullVenueStep('confirm');
                      } else if (fullVenueStep === 'confirm') {
                        const suggested = suggestedFullVenueCharge();
                        if (suggested > 0) {
                          setFullVenueDeduction(suggested);
                        }
                        setFullVenueStep('points');
                      } else if (fullVenueStep === 'points') {
                        await handleFullVenueBooking();
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? '處理中…'
                      : fullVenueStep === 'price'
                        ? '繼續'
                        : fullVenueStep === 'confirm'
                          ? '繼續'
                          : '確認包場'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
