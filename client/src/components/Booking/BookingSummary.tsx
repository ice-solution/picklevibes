import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../contexts/BookingContext';
import { useAuth } from '../../contexts/AuthContext';
import RedeemCodeInput from '../Common/RedeemCodeInput';
import apiConfig from '../../config/api';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  UsersIcon,
  MapPinIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface BookingData {
  totalPlayers: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

interface BookingSummaryProps {
  court: any;
  date: string;
  timeSlot: { start: string; end: string } | null;
  bookingData: BookingData;
  availability: any;
  // 預約現在使用積分支付，不再需要支付相關參數
  onReset: () => void;
  onPrevStep?: () => void;
  onEditBooking?: (field: keyof BookingData, value: any) => void;
  includeSoloCourt?: boolean;
  soloCourtAvailable?: boolean;
  onToggleSoloCourt?: (include: boolean) => void;
  storeName?: string;
  storeAddress?: string;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({
  court,
  date,
  timeSlot,
  bookingData,
  availability,
  // 預約現在使用積分支付，不再需要支付相關參數
  onReset,
  onPrevStep,
  onEditBooking,
  includeSoloCourt = false,
  soloCourtAvailable = false,
  onToggleSoloCourt,
  storeName,
  storeAddress,
}) => {
  const { createBooking } = useBooking();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<BookingData>(bookingData);
  
  // 兌換碼相關狀態
  const [redeemData, setRedeemData] = useState<any>(null);

  /** 確認預約前：鞋底政策 lightbox */
  const [showSoleNoticeModal, setShowSoleNoticeModal] = useState(false);
  const [soleNoticeAcknowledged, setSoleNoticeAcknowledged] = useState(false);

  const SOLE_NOTICE_MESSAGE =
    '通知各位波友：場地禁止穿著黑色鞋底的運動鞋。如因黑底鞋在場地上留下黑色痕跡，每條痕跡場方將收取港幣100元清潔費。';

  // 預約現在使用積分支付，不再需要支付狀態追蹤
  

  // 當 bookingData 變化時更新 editData
  useEffect(() => {
    setEditData(bookingData);
  }, [bookingData]);

  // 編輯功能
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onEditBooking) {
      onEditBooking('totalPlayers', editData.totalPlayers);
      onEditBooking('contactName', editData.contactName);
      onEditBooking('contactEmail', editData.contactEmail);
      onEditBooking('contactPhone', editData.contactPhone);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(bookingData);
    setIsEditing(false);
  };

  const handleEditChange = (field: keyof BookingData, value: any) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 兌換碼處理函數
  const handleRedeemApplied = (redeemCodeData: any) => {
    setRedeemData(redeemCodeData);
    console.log('兌換碼已應用:', redeemCodeData);
  };

  const handleRedeemRemoved = () => {
    setRedeemData(null);
    console.log('兌換碼已移除');
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:${minute} ${period}`;
  };

  const calculateDuration = () => {
    if (!timeSlot) return 0;
    const start = timeSlot.start.split(':');
    const end = timeSlot.end.split(':');
    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
    let endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    
    // 如果結束時間是 24:00，則轉換為 1440 分鐘
    if (end[0] === '24' && end[1] === '00') {
      endMinutes = 24 * 60;
    }
    
    return endMinutes - startMinutes;
  };

  // 將 24:00 轉換為 00:00
  const normalizeTime = (time: string) => {
    if (time === '24:00') {
      return '00:00';
    }
    return time;
  };

  /** 僅在使用者於 lightbox 勾選同意後才呼叫，執行建立預約與扣積分 */
  const handleSubmit = async () => {
    console.log('🔍 handleSubmit 開始執行');
    
    if (!user) {
      alert('請先登入');
      return;
    }

    if (!court || !date || !timeSlot || !bookingData.contactName) {
      console.log('🔍 驗證失敗:', { court: !!court, date: !!date, timeSlot: !!timeSlot, contactName: !!bookingData.contactName });
      alert('請完成所有必填信息');
      return;
    }

    console.log('🔍 開始創建預約');
    setIsSubmitting(true);
    try {
      const bookingPayload = {
        court: court._id,
        date,
        startTime: timeSlot.start,
        endTime: normalizeTime(timeSlot.end), // 將 24:00 轉換為 00:00
        players: [{ 
          name: bookingData.contactName, 
          email: bookingData.contactEmail, 
          phone: bookingData.contactPhone 
        }],
        totalPlayers: bookingData.totalPlayers,
        specialRequests: specialRequests.trim() || undefined,
        includeSoloCourt: includeSoloCourt || false,
        // 添加兌換碼信息
        redeemCodeId: redeemData?.id || undefined
      };

      // 調試：記錄預約載荷
      console.log('🔍 預約載荷:', {
        includeSoloCourt: includeSoloCourt,
        courtType: court?.type,
        soloCourtAvailable: soloCourtAvailable,
        payload: bookingPayload
      });

      // 步驟 1: 創建待支付預約
      console.log('🔍 步驟 1: 創建預約');
      const newBooking = await createBooking(bookingPayload);
      console.log('🔍 預約創建結果:', newBooking);
      
      if (!newBooking._id) {
        throw new Error('預約創建失敗，未返回預約 ID');
      }

      // 步驟 2: 預約已使用積分支付，直接完成
      console.log('🔍 步驟 2: 預約已使用積分支付完成');
      
      // 顯示成功消息並跳轉
      alert('預約成功！已扣除積分。請留意您的郵箱，已發送預約碼到您的郵箱。');
      window.location.href = '/my-bookings';
    } catch (error: any) {
      console.error('❌ 支付流程錯誤:', error);
      alert(error.message || '預約失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmBookingClick = () => {
    if (!user) {
      alert('請先登入');
      return;
    }
    if (!court || !date || !timeSlot || !bookingData.contactName) {
      alert('請完成所有必填信息');
      return;
    }
    setSoleNoticeAcknowledged(false);
    setShowSoleNoticeModal(true);
  };

  const handleSoleNoticeModalClose = () => {
    setShowSoleNoticeModal(false);
    setSoleNoticeAcknowledged(false);
  };

  const handleSoleNoticeConfirmProceed = () => {
    if (!soleNoticeAcknowledged) return;
    setShowSoleNoticeModal(false);
    setSoleNoticeAcknowledged(false);
    void handleSubmit();
  };

  // 預約現在使用積分支付，不再需要支付處理函數

  if (!court || !date || !timeSlot) {
    return (
      <div className="text-center py-12">
        <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">請完成前面的步驟</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">確認預約</h2>
      <p className="text-gray-600 mb-8">請確認您的預約信息無誤</p>

      <div className="space-y-6">
        {/* 預約詳情 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">預約詳情</h3>
          
          {/* 場地圖片 */}
          {court.images && court.images.length > 0 && (
            <div className="mb-6">
              <img
                src={`${apiConfig.API_BASE_URL}${court.images[0].url}`}
                alt={court.images[0].alt || court.name}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storeName && (
              <div className="flex items-center gap-3 md:col-span-2">
                <MapPinIcon className="w-5 h-5 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-500">店鋪</p>
                  <p className="font-medium">{storeName}</p>
                  {storeAddress && <p className="text-sm text-gray-600">{storeAddress}</p>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPinIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">場地</p>
                <p className="font-medium">{court.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">日期</p>
                <p className="font-medium">
                  {new Date(date).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long'
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">時間</p>
                <p className="font-medium">
                  {formatTime(timeSlot.start)} - {formatTime(timeSlot.end)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <UsersIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">人數</p>
                <p className="font-medium">{bookingData.totalPlayers} 人</p>
              </div>
            </div>

          </div>
        </div>

        {/* 聯絡信息 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">負責人聯絡信息</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              已自動填入
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{bookingData.contactName}</p>
                <p className="text-sm text-gray-600">{bookingData.contactEmail}</p>
                <p className="text-sm text-gray-600">{bookingData.contactPhone}</p>
              </div>
              <span className="text-sm text-gray-500">負責人</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
            * 聯絡信息已從您的帳戶資料自動填入，如需修改請前往個人資料頁面
          </p>
        </div>

        {/* 特殊要求 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">特殊要求（可選）</h3>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
            placeholder="請輸入任何特殊要求或備註..."
            maxLength={500}
          />
          <p className="text-sm text-gray-500 mt-2">
            {specialRequests.length}/500 字符
          </p>
        </div>

        {/* 單人場租用選項 - 僅在選擇比賽場時顯示 */}
        {(() => {
          console.log('🔍 單人場按鍵顯示條件檢查:');
          console.log('- court?.type === "competition":', court?.type === 'competition');
          console.log('- soloCourtAvailable:', soloCourtAvailable);
          console.log('- onToggleSoloCourt:', !!onToggleSoloCourt);
          console.log('- 所有條件:', court?.type === 'competition' && soloCourtAvailable && onToggleSoloCourt);
          return null;
        })()}
        {court?.type === 'competition' && soloCourtAvailable && onToggleSoloCourt && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">額外服務</h3>
            
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="includeSoloCourt"
                  checked={includeSoloCourt}
                  onChange={(e) => onToggleSoloCourt(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="includeSoloCourt" className="text-sm font-medium text-gray-900">
                  同時租用單人場
                </label>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">額外費用</div>
                <div className="text-lg font-semibold text-primary-600">100 積分</div>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              * 單人場與主場地同時段使用，適合個人練習
            </p>
          </div>
        )}

        {/* 兌換碼輸入 */}
        {availability && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">兌換碼</h3>
            <RedeemCodeInput
              amount={(availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0)}
              orderType="booking"
              onRedeemApplied={handleRedeemApplied}
              onRedeemRemoved={handleRedeemRemoved}
              restrictedCode="booking"
            />
          </div>
        )}

        {/* 價格詳情 */}
        {availability && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">價格詳情</h3>
            
            {/* VIP折扣提示框 */}
            {user?.membershipLevel !== 'vip' && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-400 rounded-lg shadow-md">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl animate-bounce">🎉</span>
                  <span className="text-lg font-bold text-red-600">
                    VIP會員8折!!
                  </span>
                  <span className="text-2xl animate-bounce">🎉</span>
                </div>
                <p className="text-center text-sm text-gray-600">
                  成為VIP會員即可享受所有場地8折優惠
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">場地費用</span>
                <span className="font-medium">{availability.pricing?.totalPrice || 0} 積分</span>
              </div>
              
              {includeSoloCourt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">單人場租用</span>
                  <span className="font-medium">100 積分</span>
                </div>
              )}
              
              {/* VIP 會員折扣 */}
              {user?.membershipLevel === 'vip' && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">VIP</span>
                    會員折扣 (8折)
                  </span>
                  <span className="font-medium">
                    -{Math.round(((availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0)) * 0.2)} 積分
                  </span>
                </div>
              )}
              
              {/* 兌換碼折扣 */}
              {redeemData && (
                <div className="flex justify-between text-blue-600">
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">兌換碼</span>
                    {redeemData.name}
                  </span>
                  <span className="font-medium">
                    -{redeemData.discountAmount} 積分
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">時長</span>
                <span className="font-medium">{calculateDuration()} 分鐘</span>
              </div>
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>總計</span>
                  <span className="text-primary-600">
                    {(() => {
                      let totalPrice = (availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0);
                      
                      // 應用 VIP 折扣
                      if (user?.membershipLevel === 'vip') {
                        totalPrice = Math.round(totalPrice * 0.8);
                      }
                      
                      // 應用兌換碼折扣
                      if (redeemData) {
                        totalPrice = totalPrice - redeemData.discountAmount;
                      }
                      
                      return Math.max(0, totalPrice);
                    })()} 積分
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1 text-right">
                  {user?.membershipLevel === 'vip' && '已享受 VIP 會員 8 折優惠'}
                  {redeemData && ' + 兌換碼折扣'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 重要提醒 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">重要提醒</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• 請提前15分鐘到達場地</li>
                <li>
                  • ‼️避免穿著黑底運動鞋，造成污漬將會收取每一條鞋痕
                  <span className="text-red-600 font-semibold text-[1.2em]">$100</span>
                  清潔費‼️
                </li>
                <li>• 場地內禁止吸煙和飲酒</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 編輯模式按鈕 */}
      {isEditing && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            保存修改
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            取消編輯
          </button>
        </div>
      )}

      {/* 提交按鈕 */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={onPrevStep || onReset}
          className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          上一步
        </button>
        
        <button
          type="button"
          onClick={handleConfirmBookingClick}
          disabled={isSubmitting || !user || isEditing}
          className={`flex-1 font-medium py-3 px-6 rounded-lg transition-colors duration-200 ${
            isSubmitting || !user || isEditing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {isSubmitting ? '提交中...' : '確認預約'}
        </button>
      </div>

      {!user && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">
            請先登入以完成預約
          </p>
        </div>
      )}

      {/* 調試信息 - 總是顯示 */}
      {/* 預約現在使用積分支付，不再需要調試信息 */}

      {/* 預約現在使用積分支付，不再需要 Stripe 支付組件 */}

      {showSoleNoticeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sole-notice-title"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 id="sole-notice-title" className="text-lg font-bold text-gray-900 mb-3">
              場地使用須知
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line border border-gray-200 rounded-lg p-4 bg-gray-50 mb-5">
              {SOLE_NOTICE_MESSAGE}
            </p>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={soleNoticeAcknowledged}
                onChange={(e) => setSoleNoticeAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-800">
                本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSoleNoticeModalClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSoleNoticeConfirmProceed}
                disabled={!soleNoticeAcknowledged || isSubmitting}
                className={`flex-1 py-3 px-4 rounded-lg font-medium ${
                  soleNoticeAcknowledged && !isSubmitting
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? '處理中...' : '確認並扣款'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingSummary;
