import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../contexts/BookingContext';
import { 
  MapPinIcon, 
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  WifiIcon,
  SunIcon,
  BeakerIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';

const Facilities: React.FC = () => {
  const { courts, fetchCourts, loading } = useBooking();

  useEffect(() => {
    fetchCourts();
  }, []); // 移除 fetchCourts 依賴，只在組件掛載時調用一次

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
      default:
        return amenity;
    }
  };

  const getCourtTypeText = (type: string) => {
    switch (type) {
      case 'indoor': return '室內場地';
      case 'outdoor': return '室外場地';
      case 'dink': return '練習場';
      default: return '場地';
    }
  };

  const getCourtTypeColor = (type: string) => {
    switch (type) {
      case 'indoor': return 'bg-blue-100 text-blue-800';
      case 'outdoor': return 'bg-green-100 text-green-800';
      case 'dink': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const facilities = [
    {
      title: '3個室內場地 + 2個練習場',
      description: '配備空調的現代化室內場地，不受天氣影響，全年無休',
      icon: MapPinIcon,
      features: ['空調控制', '專業照明', '防滑地面', '標準尺寸']
    },
    {
      title: '更衣室和淋浴設施',
      description: '舒適的更衣室和現代化淋浴設施，讓您運動後保持清爽',
      icon: BeakerIcon,
      features: ['私人更衣室', '熱水淋浴', '毛巾服務', '儲物櫃']
    },
    {
      title: 'PickleVibes 商店',
      description: '提供專業匹克球裝備和紀念品，滿足您的所有需求',
      icon: ShoppingBagIcon,
      features: ['專業球拍', '運動服裝', '配件用品', '紀念品']
    },
    {
      title: 'WiFi 和休息區',
      description: '免費WiFi和舒適的休息區，讓您在運動間隙也能保持連接',
      icon: WifiIcon,
      features: ['免費WiFi', '舒適座椅', '充電站', '雜誌報紙']
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              我們的設施
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto">
              現代化的設施，為您提供最佳的運動體驗
            </p>
          </motion.div>
        </div>
      </section>

      {/* 場地詳情 */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">場地詳情</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              每個場地都經過精心設計，確保您獲得最佳的匹克球體驗
            </p>
          </motion.div>

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
                  className="bg-white rounded-2xl shadow-lg overflow-hidden"
                >
                  {/* 場地圖片 */}
                  <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 relative">
                    {court.images && court.images.length > 0 ? (
                      <img
                        src={court.images[0].url}
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
                          <span>每天 7am - 11pm</span>
                        </div>
                      </div>
                    </div>

                    {/* 價格信息 */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">非高峰時段</span>
                        <span className="text-lg font-bold text-primary-600">
                          ${court.pricing.offPeak}/小時
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">高峰時段</span>
                        <span className="text-lg font-bold text-primary-600">
                          ${court.pricing.peakHour}/小時
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 其他設施 */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-6">其他設施</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              除了專業的匹克球場地，我們還提供各種便利設施
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {facilities.map((facility, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gray-50 rounded-2xl p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <facility.icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {facility.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {facility.description}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {facility.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-6">準備體驗我們的設施嗎？</h2>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              立即預約場地，體驗最棒的匹克球設施
            </p>
            <a
              href="/booking"
              className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-block"
            >
              立即預約
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Facilities;
