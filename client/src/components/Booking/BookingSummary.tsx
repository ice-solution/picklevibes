import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useBooking } from '../../contexts/BookingContext';
import { useAuth } from '../../contexts/AuthContext';
import StripePayment from '../Payment/StripePayment';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  UsersIcon,
  MapPinIcon,
  CurrencyDollarIcon,
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
  onReset: () => void;
}

const BookingSummary: React.FC<BookingSummaryProps> = ({
  court,
  date,
  timeSlot,
  bookingData,
  availability,
  onReset
}) => {
  const { createBooking } = useBooking();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialRequests, setSpecialRequests] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string>('');

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
    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
    return endMinutes - startMinutes;
  };

  const handleSubmit = async () => {
    if (!user) {
      alert('請先登入');
      return;
    }

    if (!court || !date || !timeSlot || !bookingData.contactName) {
      alert('請完成所有必填信息');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingPayload = {
        court: court._id,
        date,
        startTime: timeSlot.start,
        endTime: timeSlot.end,
        players: [{ 
          name: bookingData.contactName, 
          email: bookingData.contactEmail, 
          phone: bookingData.contactPhone 
        }],
        totalPlayers: bookingData.totalPlayers,
        specialRequests: specialRequests.trim() || undefined
      };

      // 先創建待支付預約
      const newBooking = await createBooking(bookingPayload);
      setCreatedBookingId(newBooking._id);
      setShowPayment(true);
    } catch (error: any) {
      alert(error.message || '預約失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    navigate('/payment-result?status=success&message=支付成功！您的預約已確認。');
  };

  const handlePaymentError = (error: string) => {
    navigate(`/payment-result?status=error&message=${encodeURIComponent(error)}`);
  };

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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">負責人聯絡信息</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
              <div>
                <p className="font-medium text-primary-900">{bookingData.contactName}</p>
                <p className="text-sm text-primary-700">{bookingData.contactEmail}</p>
                <p className="text-sm text-primary-700">{bookingData.contactPhone}</p>
              </div>
              <span className="text-sm text-primary-600">負責人</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>參加人數:</strong> {bookingData.totalPlayers} 人
            </p>
            <p className="text-xs text-gray-500 mt-1">
              實際參與者名單可於現場確認
            </p>
          </div>
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

        {/* 價格詳情 */}
        {availability && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">價格詳情</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">場地費用</span>
                <span className="font-medium">HK$ {availability.pricing?.totalPrice || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">時長</span>
                <span className="font-medium">{calculateDuration()} 分鐘</span>
              </div>
              
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span>總計</span>
                  <span className="text-primary-600">HK$ {availability.pricing?.totalPrice || 0}</span>
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
                <li>• 如需取消，請至少提前2小時通知</li>
                <li>• 請攜帶有效的身份證明文件</li>
                <li>• 場地內禁止吸煙和飲酒</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 提交按鈕 */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={onReset}
          className="flex-1 bg-gray-200 text-gray-700 hover:bg-gray-300 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
        >
          重新選擇
        </button>
        
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !user}
          className={`flex-1 font-medium py-3 px-6 rounded-lg transition-colors duration-200 ${
            isSubmitting || !user
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

      {/* Stripe 支付組件 */}
      {showPayment && createdBookingId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-8 p-6 bg-gray-50 rounded-xl"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            完成支付
          </h3>
          
          <StripePayment
            bookingId={createdBookingId}
            amount={availability?.pricing?.totalPrice || 0}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </motion.div>
      )}
    </div>
  );
};

export default BookingSummary;
