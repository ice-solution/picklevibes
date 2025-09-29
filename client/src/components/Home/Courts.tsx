import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useBooking } from '../../contexts/BookingContext';
import { 
  MapPinIcon, 
  ClockIcon, 
  UsersIcon,
  ArrowRightIcon 
} from '@heroicons/react/24/outline';

const Courts: React.FC = () => {
  const { courts, loading } = useBooking();

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

  if (loading) {
    return (
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">載入場地信息中...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            您來玩的地方
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            讓我們誠實地說，匹克球可以在很多地方玩，但我們喜歡認為我們不僅僅是這樣。我們是一個通過積極生活方式和共同體驗團結人們的社區。
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courts.map((court, index) => (
            <motion.div
              key={court._id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden border border-gray-200"
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
                    <ClockIcon className="w-4 h-4" />
                    <span>7am-11pm</span>
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
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">非高峰時段</span>
                    <span className="text-lg font-bold text-primary-600">
                      ${court.pricing.offPeak}/小時
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">高峰時段</span>
                    <span className="text-lg font-bold text-primary-600">
                      ${court.pricing.peakHour}/小時
                    </span>
                  </div>
                </div>

                {/* 預約按鈕 */}
                <Link
                  to="/booking"
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 group"
                >
                  立即預約
                  <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 如果沒有場地 */}
        {courts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏓</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              場地信息載入中
            </h3>
            <p className="text-gray-600 mb-8">
              我們正在為您準備最佳的匹克球體驗
            </p>
            <Link
              to="/booking"
              className="btn-primary inline-flex items-center gap-2"
            >
              查看預約
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </motion.div>
        )}

        {/* 行動呼籲 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              準備好開始您的匹克球之旅了嗎？
            </h3>
            <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
              加入我們的社區，體驗最棒的匹克球設施和友善的環境
            </p>
            <Link
              to="/booking"
              className="bg-white text-primary-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-full text-lg transition-colors duration-200 inline-flex items-center gap-2"
            >
              立即預約場地
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Courts;
