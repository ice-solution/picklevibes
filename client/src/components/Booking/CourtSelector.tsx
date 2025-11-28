import React from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../../contexts/BookingContext';
import apiConfig from '../../config/api';
import { 
  MapPinIcon, 
  UsersIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface CourtSelectorProps {
  onSelect: (court: any) => void;
  selectedCourt: any;
}

const CourtSelector: React.FC<CourtSelectorProps> = ({ onSelect, selectedCourt }) => {
  const { courts, loading } = useBooking();

  const getCourtTypeText = (type: string) => {
    switch (type) {
      case 'competition': return '比賽場';
      case 'training': return '訓練場';
      case 'solo': return '單人場';
      case 'dink': return '練習場';
      case 'full_venue': return '包場';
      default: return '場地';
    }
  };

  const getCourtTypeColor = (type: string) => {
    switch (type) {
      case 'competition': return 'bg-red-100 text-red-800';
      case 'training': return 'bg-purple-100 text-purple-800';
      case 'solo': return 'bg-orange-100 text-orange-800';
      case 'dink': return 'bg-yellow-100 text-yellow-800';
      case 'full_venue': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">載入場地信息中...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">選擇場地</h2>
      <p className="text-gray-600 mb-8">請選擇您想要預約的場地</p>

      {/* VIP折扣提示 */}
      <div className="mb-6 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 text-white px-6 py-4 rounded-xl shadow-lg animate-pulse">
        <div className="flex items-center justify-center gap-3">
          <span className="text-2xl animate-bounce">🎉</span>
          <span className="text-xl font-bold">VIP會員8折!!</span>
          <span className="text-2xl animate-bounce">🎉</span>
        </div>
        <p className="text-center text-sm mt-2 text-red-100">
          成為VIP會員即可享受所有場地8折優惠
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courts
          .filter(court => court.type !== 'full_venue') // 過濾掉包場場地
          .map((court, index) => (
          <motion.div
            key={court._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            onClick={() => onSelect(court)}
            className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 ${
              selectedCourt?._id === court._id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
            }`}
          >
            {/* 場地圖片 */}
            <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 rounded-t-xl relative overflow-hidden">
              {court.images && court.images.length > 0 ? (
                <img
                  src={`${apiConfig.API_BASE_URL}${court.images[0].url}`}
                  alt={court.images[0].alt || court.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl">🏓</span>
                </div>
              )}
              
              {/* 場地類型標籤 */}
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCourtTypeColor(court.type)}`}>
                  {getCourtTypeText(court.type)}
                </span>
              </div>

              {/* 選中標記 */}
              {selectedCourt?._id === court._id && (
                <div className="absolute top-4 left-4">
                  <CheckCircleIcon className="w-6 h-6 text-white bg-primary-600 rounded-full" />
                </div>
              )}
            </div>

            {/* 場地信息 */}
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {court.name}
              </h3>
              
              <p className="text-gray-600 mb-4 line-clamp-2">
                {court.description || '專業的匹克球場地，配備現代化設施'}
              </p>

              {/* 場地特色 */}
              <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <UsersIcon className="w-4 h-4" />
                  <span>最多 {court.capacity} 人</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPinIcon className="w-4 h-4" />
                  <span>場地 {court.number}</span>
                </div>
              </div>

              {/* 設施列表 */}
              {court.amenities && court.amenities.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {court.amenities.slice(0, 3).map((amenity, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {amenity.replace('_', ' ')}
                      </span>
                    ))}
                    {court.amenities.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        +{court.amenities.length - 3} 更多
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* VIP折扣提示框 */}
              <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-400 rounded-lg shadow-md">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl animate-bounce">🎉</span>
                  <span className="text-base font-bold text-red-600">
                    VIP會員8折!!
                  </span>
                  <span className="text-xl animate-bounce">🎉</span>
                </div>
              </div>

              {/* 價格信息 */}
              <div className="space-y-2">
                {court.pricing.timeSlots && court.pricing.timeSlots.length > 0 ? (
                  court.pricing.timeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{slot.name}</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-primary-600">
                          {slot.price} 積分/小時
                        </span>
                        <span className="text-xs text-red-600 font-semibold">
                          VIP: {Math.round(slot.price * 0.8)} 積分/小時
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">非繁忙時間</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-primary-600">
                          {court.pricing.offPeak} 積分/小時
                        </span>
                        <span className="text-xs text-red-600 font-semibold">
                          VIP: {Math.round(court.pricing.offPeak * 0.8)} 積分/小時
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">繁忙時間</span>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-primary-600">
                          {court.pricing.peakHour} 積分/小時
                        </span>
                        <span className="text-xs text-red-600 font-semibold">
                          VIP: {Math.round(court.pricing.peakHour * 0.8)} 積分/小時
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {courts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🏓</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            暫無可用場地
          </h3>
          <p className="text-gray-600">
            請稍後再試或聯繫我們了解更多信息
          </p>
        </div>
      )}
    </div>
  );
};

export default CourtSelector;
