import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../../contexts/BookingContext';
import apiConfig from '../../config/api';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  useEffect(() => {
    fetchCourts();
  }, []);

  const highlightBadgeClass =
    'inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm';

  const highlights = [
    {
      title: t('pricingPage.intro.highlights.simpleTitle'),
      description: <>{t('pricingPage.intro.highlights.simpleDesc')}</>
    },
    {
      title: t('pricingPage.intro.highlights.transparentTitle'),
      description: (
        <>
          {t('pricingPage.intro.highlights.transparentPrefix')}
          <span className={highlightBadgeClass}>{t('pricingPage.intro.highlights.transparentBadge')}</span>
          {t('pricingPage.intro.highlights.transparentSuffix')}
        </>
      )
    },
    {
      title: t('pricingPage.intro.highlights.rewardsTitle'),
      description: <>{t('pricingPage.intro.highlights.rewardsDesc')}</>
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
        return t('pricingPage.intro.amenities.air_conditioning');
      case 'lighting':
        return t('pricingPage.intro.amenities.lighting');
      case 'net':
        return t('pricingPage.intro.amenities.net');
      case 'paddles':
        return t('pricingPage.intro.amenities.paddles');
      case 'balls':
        return t('pricingPage.intro.amenities.balls');
      case 'water':
        return t('pricingPage.intro.amenities.water');
      case 'shower':
        return t('pricingPage.intro.amenities.shower');
      case 'vending_machine':
        return t('pricingPage.intro.amenities.vending_machine');
      default:
        return amenity;
    }
  };

  const getCourtTypeText = (type: string) => {
    switch (type) {
      case 'competition':
        return t('bookingPage.courtSelector.types.competition');
      case 'training':
        return t('bookingPage.courtSelector.types.training');
      case 'solo':
        return t('bookingPage.courtSelector.types.solo');
      case 'dink':
        return t('bookingPage.courtSelector.types.dink');
      default:
        return t('bookingPage.courtSelector.types.default');
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
                {t('pricingPage.intro.feeModeLabel')}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {t('pricingPage.intro.heading')}
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                {t('pricingPage.intro.description1')}
                <br />
                {t('pricingPage.intro.description2')}
                <span className={`ml-2 ${highlightBadgeClass}`}>
                  {t('pricingPage.intro.badgeText')}
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
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('pricingPage.intro.courtsDetailsTitle')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('pricingPage.intro.courtsDetailsSubtitle')}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">{t('pricingPage.intro.loadingCourts')}</p>
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
                  <span className="mx-2">{t('pricingPage.intro.vipBannerTitle')}</span>
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
                      {court.description || t('bookingPage.courtSelector.defaultDescription')}
                    </p>

                    {/* 場地特色 */}
                    <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <UsersIcon className="w-4 h-4" />
                        <span>{t('bookingPage.courtSelector.capacity', { n: court.capacity })}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPinIcon className="w-4 h-4" />
                        <span>{t('bookingPage.courtSelector.courtNumber', { n: court.number })}</span>
                      </div>
                    </div>

                    {/* 設施列表 */}
                    {court.amenities && court.amenities.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">{t('pricingPage.intro.amenitiesLabel')}</h4>
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
                      <h4 className="text-sm font-medium text-gray-700 mb-2">{t('pricingPage.intro.operatingHoursTitle')}</h4>
                      <div className="text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          <span>
                            {court.type === 'solo' ? t('pricingPage.intro.soloHours') : t('pricingPage.intro.fullHours')}
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
                            {t('pricingPage.intro.vipBannerTitle')}
                          </span>
                          <span className="text-2xl animate-bounce">🎉</span>
                        </div>
                        <p className="text-xs text-gray-600 text-center mt-1">
                          {t('pricingPage.intro.vipBannerSub')}
                        </p>
                      </div>

                      {court.pricing.timeSlots && court.pricing.timeSlots.length > 0 ? (
                        court.pricing.timeSlots.map((slot, idx) => (
                          <div key={idx} className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500">{slot.name}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
                                {t('common.perHourPoints', { n: slot.price })}
                              </span>
                              <span className="text-xs text-red-600 font-semibold">
                                VIP: {t('common.perHourPoints', { n: Math.round(slot.price * 0.8) })}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500">{t('pricingPage.intro.offPeakLabel')}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
                                {t('common.perHourPoints', { n: court.pricing.offPeak })}
                              </span>
                              <span className="text-xs text-red-600 font-semibold">
                                VIP: {t('common.perHourPoints', { n: Math.round(court.pricing.offPeak * 0.8) })}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-500">{t('pricingPage.intro.peakLabel')}</span>
                            <div className="flex flex-col items-end">
                              <span className="text-lg font-bold text-primary-600">
                                {t('common.perHourPoints', { n: court.pricing.peakHour })}
                              </span>
                              <span className="text-xs text-red-600 font-semibold">
                                VIP: {t('common.perHourPoints', { n: Math.round(court.pricing.peakHour * 0.8) })}
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

