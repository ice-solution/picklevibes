import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../../contexts/BookingContext';
import apiConfig from '../../config/api';
import { 
  MapPinIcon, 
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  SunIcon,
  BeakerIcon
} from '@heroicons/react/24/outline';

/**
 * PricingIntro
 * -----------------------------------------------------------------------------
 * 這個元件位於會員方案區塊的上方，用來介紹收費模式或提供重點資訊。
 * 包含場地資料展示。
 */
const PricingIntro: React.FC = () => {
  const { courts, fetchCourts, loading } = useBooking();

  useEffect(() => {
    fetchCourts();
  }, []);

  const highlightBadgeClass =
    'inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm';

  const highlights = [
    {
      title: '簡單易明',
      description: (
        <>
          我們採用積分制訂場，目的是想讓用戶簡單使用，不用複雜的計算。
        </>
      )
    },
    {
      title: '透明公開',
      description: (
        <>
          我們積分儲值採用{' '}
          <span className={highlightBadgeClass}>"HKD 1 = 1 積分"</span>
          ，絕無任何附加收費。
        </>
      )
    },
    {
      title: '積分回饋',
      description: (
        <>
          公司定期會有特別充值優惠，多充多送。
        </>
      )
    }
  ];

  const getAmenityIcon = (amenity: string) => {
    switch (amenity) {
      case 'air_conditioning':
        return <SunIcon className="w-5 h-5" />;
      case 'lighting':
        return <SunIcon className="w-5 h-5" />;
      case 'net':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'paddles':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'balls':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'water':
        return <BeakerIcon className="w-5 h-5" />;
      case 'shower':
        return <BeakerIcon className="w-5 h-5" />;
      default:
        return <CheckCircleIcon className="w-5 h-5" />;
    }
  };

  const getAmenityText = (amenity: string) => {
    switch (amenity) {
      case 'air_conditioning':
        return '空調';
      case 'lighting':
        return '照明';
      case 'net':
        return '球網';
      case 'paddles':
        return '球拍租借';
      case 'balls':
        return '球類提供';
      case 'water':
        return '飲水機';
      case 'shower':
        return '淋浴設施';
      case 'vending_machine':
        return '售賣機';
      default:
        return amenity;
    }
  };

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

  return (
    <div className="mb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-10 md:px-10 md:py-12 mb-16"
      >
        <div className="max-w-4xl mx-auto text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
            <div>
              <p className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3">
                收費模式簡介
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                找出最適合你的匹克球方案
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                我們依據不同玩家的使用頻率與需求，提供具彈性且透明的收費模式。
                你可以先從基本會員開始體驗，也可以直接升級為 VIP 享受更多權益。
                <span className={`ml-2 ${highlightBadgeClass}`}>
                  新張期限定：享免費 VIP 升級
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {highlights.map((item, index) => (
              <div
                key={index}
                className="h-full rounded-xl border border-gray-100 px-5 py-6 bg-gray-50 hover:bg-white hover:shadow-md transition-shadow duration-200"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 場地詳情 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="bg-white border border-gray-200 shadow-sm rounded-2xl px-6 py-10 md:px-10 md:py-12"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">場地詳情</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              每個場地都經過精心設計，確保您獲得最佳的匹克球體驗
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">載入場地信息中...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {courts.map((court, index) => (
                <motion.div
                  key={court._id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-gray-50 rounded-2xl shadow-lg overflow-hidden"
                >
                  {/* VIP折扣提示 - 最醒目的位置 */}
                  <div className="bg-gradient-to-r from-red-500 via-pink-500 to-red-500 text-white px-4 py-3 text-center font-bold text-lg shadow-lg animate-pulse">
                    <span className="inline-block animate-bounce">🎉</span>
                    <span className="mx-2">VIP會員8折!!</span>
                    <span className="inline-block animate-bounce">🎉</span>
                  </div>

                  {/* 場地圖片 */}
                  <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 relative">
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
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCourtTypeColor(court.type)}`}>
                        {getCourtTypeText(court.type)}
                      </span>
                    </div>
                  </div>

                  {/* 場地信息 */}
                  <div className="p-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">
                      {court.name}
                    </h3>
                    
                    <p className="text-gray-600 mb-4">
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
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">設施</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {court.amenities.map((amenity, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="text-primary-600">
                                {getAmenityIcon(amenity)}
                              </div>
                              <span>{getAmenityText(amenity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 營業時間 */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">營業時間</h4>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>
                            {court.type === 'solo' ? '每天 08:00-23:00' : '24小時營業(需預約方可進場)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 價格信息 */}
                    <div className="border-t border-gray-200 pt-4">
                      {/* VIP折扣提示框 */}
                      <div className="mb-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-400 rounded-lg shadow-md">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-2xl animate-bounce">🎉</span>
                          <span className="text-lg font-bold text-red-600">
                            VIP會員8折!!
                          </span>
                          <span className="text-2xl animate-bounce">🎉</span>
                        </div>
                        <p className="text-xs text-gray-600 text-center mt-1">
                          成為VIP會員即可享受所有場地8折優惠
                        </p>
                      </div>

                      {court.pricing.timeSlots && court.pricing.timeSlots.length > 0 ? (
                        court.pricing.timeSlots.map((slot, idx) => (
                          <div key={idx} className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500">{slot.name}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
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
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500">非繁忙時間</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
                                {court.pricing.offPeak} 積分/小時
                              </span>
                              <span className="text-xs text-red-600 font-semibold">
                                VIP: {Math.round(court.pricing.offPeak * 0.8)} 積分/小時
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">繁忙時間</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
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
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PricingIntro;

