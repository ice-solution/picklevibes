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
      default: return '場地';
    }
  };

  const getCourtTypeColor = (type: string) => {
    switch (type) {
      case 'competition': return 'bg-red-100 text-red-800';
      case 'training': return 'bg-purple-100 text-purple-800';
      case 'solo': return 'bg-orange-100 text-orange-800';
      case 'dink': return 'bg-yellow-100 text-yellow-800';
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courts.map((court, index) => (
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

              {/* 價格信息 */}
              <div className="space-y-2">
                {court.pricing.timeSlots && court.pricing.timeSlots.length > 0 ? (
                  court.pricing.timeSlots.map((slot, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{slot.name}</span>
                      <span className="text-sm font-bold text-primary-600">
                        {slot.price} 積分/小時
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">非繁忙時間</span>
                      <span className="text-sm font-bold text-primary-600">
                        {court.pricing.offPeak} 積分/小時
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">繁忙時間</span>
                      <span className="text-sm font-bold text-primary-600">
                        {court.pricing.peakHour} 積分/小時
                      </span>
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
