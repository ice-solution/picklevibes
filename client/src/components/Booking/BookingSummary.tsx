import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBooking } from '../../contexts/BookingContext';
import { useAuth } from '../../contexts/AuthContext';
import RedeemCodeInput from '../Common/RedeemCodeInput';
import apiConfig from '../../config/api';
import { BOOKING_CANCELLATION_POLICY_LINES } from '../../constants/bookingCancellationPolicy';
import { hasBookingVipDiscount, applyBookingVipDiscount } from '../../utils/memberBenefits';
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
  const { t, i18n } = useTranslation();
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
      alert(t('bookingPage.bookingSummary.loginFirst'));
      return;
    }

    if (!court || !date || !timeSlot || !bookingData.contactName) {
      console.log('🔍 驗證失敗:', { court: !!court, date: !!date, timeSlot: !!timeSlot, contactName: !!bookingData.contactName });
      alert(t('bookingPage.bookingSummary.fillRequired'));
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
      alert(t('bookingPage.bookingSummary.success'));
      window.location.href = '/my-bookings';
    } catch (error: any) {
      console.error('❌ 支付流程錯誤:', error);
      const message = error?.message || t('bookingPage.bookingSummary.failed');
      const isInsufficientBalance =
        error?.isInsufficientBalance === true ||
        message.includes('積分餘額不足') ||
        message.includes('餘額不足');

      if (isInsufficientBalance) {
        alert(t('bookingPage.bookingSummary.insufficient'));
        window.location.assign('/recharge?from=booking&reason=insufficient_balance');
        return;
      }
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmBookingClick = () => {
    if (!user) {
      alert(t('bookingPage.bookingSummary.loginFirst'));
      return;
    }
    if (!court || !date || !timeSlot || !bookingData.contactName) {
      alert(t('bookingPage.bookingSummary.fillRequired'));
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
        <p className="text-gray-600">{t('bookingPage.bookingSummary.incomplete')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('bookingPage.bookingSummary.title')}</h2>
      <p className="text-gray-600 mb-8">{t('bookingPage.bookingSummary.subtitle')}</p>

      <div className="space-y-6">
        {/* 預約詳情 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bookingPage.bookingSummary.details')}</h3>
          
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
                  <p className="text-sm text-gray-500">{t('common.store')}</p>
                  <p className="font-medium">{storeName}</p>
                  {storeAddress && <p className="text-sm text-gray-600">{storeAddress}</p>}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MapPinIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">{t('common.court')}</p>
                <p className="font-medium">{court.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CalendarDaysIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">{t('bookingPage.bookingSummary.date')}</p>
                <p className="font-medium">
                  {new Date(date).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'zh-TW', {
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
                <p className="text-sm text-gray-500">{t('bookingPage.bookingSummary.time')}</p>
                <p className="font-medium">
                  {formatTime(timeSlot.start)} - {formatTime(timeSlot.end)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <UsersIcon className="w-5 h-5 text-primary-600" />
              <div>
                <p className="text-sm text-gray-500">{t('bookingPage.bookingSummary.players')}</p>
                <p className="font-medium">{bookingData.totalPlayers} {t('common.people')}</p>
              </div>
            </div>

          </div>
        </div>

        {/* 聯絡信息 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('bookingPage.bookingSummary.contactInfo')}</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {t('common.autoFilled')}
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{bookingData.contactName}</p>
                <p className="text-sm text-gray-600">{bookingData.contactEmail}</p>
                <p className="text-sm text-gray-600">{bookingData.contactPhone}</p>
              </div>
              <span className="text-sm text-gray-500">{t('bookingPage.bookingSummary.role')}</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
            {t('bookingPage.bookingSummary.contactNote')}
          </p>
        </div>

        {/* 特殊要求 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bookingPage.bookingSummary.specialRequests')}</h3>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            rows={3}
            placeholder={t('bookingPage.bookingSummary.specialRequestsPlaceholder')}
            maxLength={500}
          />
          <p className="text-sm text-gray-500 mt-2">
            {specialRequests.length}/500
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bookingPage.bookingSummary.extraService')}</h3>
            
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
                  {t('bookingPage.bookingSummary.includeSoloCourt')}
                </label>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">{t('bookingPage.bookingSummary.extraFee')}</div>
                <div className="text-lg font-semibold text-primary-600">100 {t('common.currency')}</div>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-2">
              {t('bookingPage.bookingSummary.soloCourtNote')}
            </p>
          </div>
        )}

        {/* 兌換碼輸入 */}
        {availability && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bookingPage.bookingSummary.redeemTitle')}</h3>
            <RedeemCodeInput
              amount={(availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0)}
              orderType="booking"
              onRedeemApplied={handleRedeemApplied}
              onRedeemRemoved={handleRedeemRemoved}
              restrictedCode="booking"
              bookingContext={{
                courtId: court?._id,
                date,
                startTime: timeSlot?.start,
                pricingSlotName: availability?.pricing?.slotName,
              }}
            />
          </div>
        )}

        {/* 價格詳情 */}
        {availability && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('bookingPage.bookingSummary.pricingTitle')}</h3>
            
            {/* VIP折扣提示框 */}
            {user?.membershipLevel !== 'vip' && (
              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-400 rounded-lg shadow-md">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl animate-bounce">🎉</span>
                  <span className="text-lg font-bold text-red-600">
                    {t('bookingPage.courtSelector.vipBanner')}
                  </span>
                  <span className="text-2xl animate-bounce">🎉</span>
                </div>
                <p className="text-center text-sm text-gray-600">
                  {t('bookingPage.courtSelector.vipBannerSub')}
                </p>
              </div>
            )}
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('bookingPage.bookingSummary.courtFee')}</span>
                <span className="font-medium">{availability.pricing?.totalPrice || 0} {t('common.currency')}</span>
              </div>
              
              {includeSoloCourt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('bookingPage.bookingSummary.soloCourtFee')}</span>
                  <span className="font-medium">100 {t('common.currency')}</span>
                </div>
              )}
              
              {/* VIP 會員折扣 */}
              {hasBookingVipDiscount(user) && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">VIP</span>
                    {t('bookingPage.bookingSummary.vipDiscount')}
                  </span>
                  <span className="font-medium">
                    -{Math.round(((availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0)) * 0.2)} {t('common.currency')}
                  </span>
                </div>
              )}
              
              {/* 兌換碼折扣 */}
              {redeemData && (
                <div className="flex justify-between text-blue-600">
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{t('bookingPage.bookingSummary.redeemTitle')}</span>
                    {redeemData.name}
                  </span>
                  <span className="font-medium">
                    -{redeemData.discountAmount} {t('common.currency')}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-600">{t('common.duration')}</span>
                <span className="font-medium">{t('common.minutes', { n: calculateDuration() })}</span>
              </div>
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>{t('bookingPage.bookingSummary.total')}</span>
                  <span className="text-primary-600">
                    {(() => {
                      let totalPrice = (availability.pricing?.totalPrice || 0) + (includeSoloCourt ? 100 : 0);
                      
                      // 應用 VIP 折扣
                      if (hasBookingVipDiscount(user)) {
                        totalPrice = applyBookingVipDiscount(totalPrice, user);
                      }
                      
                      // 應用兌換碼折扣
                      if (redeemData) {
                        totalPrice = totalPrice - redeemData.discountAmount;
                      }
                      
                      return Math.max(0, totalPrice);
                    })()} {t('common.currency')}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1 text-right">
                  {hasBookingVipDiscount(user) && t('bookingPage.bookingSummary.vipApplied')}
                  {redeemData && t('bookingPage.bookingSummary.plusRedeem')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 取消及惡劣天氣政策 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-900 mb-2">{t('bookingPage.bookingSummary.policyTitle')}</h4>
              <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
                {BOOKING_CANCELLATION_POLICY_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* 重要提醒 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-800 mb-2">{t('bookingPage.bookingSummary.importantNotice')}</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• {t('bookingPage.bookingSummary.notice1')}</li>
                <li>
                  • ‼️{t('bookingPage.bookingSummary.notice2Before')}
                  <span className="text-red-600 font-semibold text-[1.2em]">$100</span>
                  {t('bookingPage.bookingSummary.notice2After')}‼️
                </li>
                <li>• {t('bookingPage.bookingSummary.notice3')}</li>
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
            {t('bookingPage.bookingSummary.save')}
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            {t('bookingPage.bookingSummary.cancelEdit')}
          </button>
        </div>
      )}

      {/* 提交按鈕 */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={onPrevStep || onReset}
          className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          {t('bookingPage.nav.prev')}
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
          {isSubmitting ? t('bookingPage.bookingSummary.submitting') : t('bookingPage.bookingSummary.confirm')}
        </button>
      </div>

      {!user && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">
            {t('bookingPage.sidebar.loginNotice')}
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
              {t('bookingPage.bookingSummary.soleTitle')}
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
                {t('bookingPage.bookingSummary.soleAcknowledge')}
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSoleNoticeModalClose}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                {t('bookingPage.bookingSummary.soleCancel')}
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
                {isSubmitting ? t('common.processing') : t('bookingPage.bookingSummary.soleConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingSummary;
