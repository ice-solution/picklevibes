import { useAuth } from '../../contexts/AuthContext';
import { applyBookingVipRateOnly } from '../../utils/memberBenefits';
import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useBooking } from '../../contexts/BookingContext';
import apiConfig from '../../config/api';
import { 
  UsersIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface CourtSelectorProps {
  onSelect: (court: any) => void;
  selectedCourt: any;
}

const CourtSelector: React.FC<CourtSelectorProps> = ({ onSelect, selectedCourt }) => {
  const { user } = useAuth();
  const { courts, loading } = useBooking();
  const { t } = useTranslation();

  /** 依用戶會籍顯示單價；未登入／無折扣則為牌價 */
  const displayPrice = (listPrice: number) => applyBookingVipRateOnly(listPrice, user);

  const getCourtTypeText = (type: string) => {
    switch (type) {
      case 'competition': return t('bookingPage.courtSelector.types.competition');
      case 'training': return t('bookingPage.courtSelector.types.training');
      case 'solo': return t('bookingPage.courtSelector.types.solo');
      case 'dink': return t('bookingPage.courtSelector.types.dink');
      case 'full_venue': return t('bookingPage.courtSelector.types.full_venue');
      default: return t('bookingPage.courtSelector.types.default');
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

  const lowestPrice = (court: any): number | null => {
    if (court?.pricing?.timeSlots?.length) {
      const prices = court.pricing.timeSlots.map((s: any) => Number(s.price) || 0).filter((p: number) => p > 0);
      return prices.length ? Math.min(...prices) : null;
    }
    const off = Number(court?.pricing?.offPeak);
    const peak = Number(court?.pricing?.peakHour);
    const vals = [off, peak].filter((n) => Number.isFinite(n) && n > 0);
    return vals.length ? Math.min(...vals) : null;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('bookingPage.courtSelector.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-6">
        {t('bookingPage.courtSelector.title')}
      </h2>
      <p className="text-gray-600 mb-4 sm:mb-8 text-sm sm:text-base">
        {t('bookingPage.courtSelector.subtitle')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        {courts
          .filter(court => court.type !== 'full_venue')
          .map((court, index) => {
            const fromPrice = lowestPrice(court);
            return (
          <motion.div
            key={court._id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            onClick={() => onSelect(court)}
            className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 ${
              selectedCourt?._id === court._id
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
            }`}
          >
            {/* 圖片：mobile 矮圖；desktop 原高 */}
            <div className="h-28 sm:h-48 bg-gradient-to-br from-primary-500 to-primary-700 rounded-t-xl relative overflow-hidden">
              {court.images && court.images.length > 0 ? (
                <img
                  src={`${apiConfig.API_BASE_URL}${court.images[0].url}`}
                  alt={court.images[0].alt || court.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl sm:text-6xl">🏓</span>
                </div>
              )}
              
              <div className="absolute top-2 right-2 sm:top-4 sm:right-4">
                <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${getCourtTypeColor(court.type)}`}>
                  {getCourtTypeText(court.type)}
                </span>
              </div>

              {selectedCourt?._id === court._id && (
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                  <CheckCircleIcon className="w-6 h-6 text-white bg-primary-600 rounded-full" />
                </div>
              )}
            </div>

            <div className="p-3 sm:p-6">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base sm:text-xl font-bold text-gray-900">
                  {court.name}
                </h3>
                {/* mobile：由某價起（依會籍） */}
                {fromPrice != null && (
                  <div className="sm:hidden text-right shrink-0">
                    <div className="text-xs text-gray-500">由</div>
                    <div className="text-sm font-bold text-primary-600">
                      {displayPrice(fromPrice)} {t('common.currency')}
                    </div>
                  </div>
                )}
              </div>

              {/* desktop：說明 */}
              <p className="hidden sm:block text-gray-600 mb-4 line-clamp-2 mt-2">
                {court.description || t('bookingPage.courtSelector.defaultDescription')}
              </p>

              <div className="flex items-center gap-3 mt-1 sm:mt-0 sm:mb-4 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <UsersIcon className="w-4 h-4" />
                  <span>{t('bookingPage.courtSelector.capacity', { n: court.capacity })}</span>
                </div>
              </div>

              {/* 設施／空調等：僅 desktop */}
              {court.amenities && court.amenities.length > 0 && (
                <div className="hidden sm:block mb-4">
                  <div className="flex flex-wrap gap-2">
                    {court.amenities.slice(0, 3).map((amenity: string, idx: number) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        {amenity.replace('_', ' ')}
                      </span>
                    ))}
                    {court.amenities.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {t('bookingPage.courtSelector.moreAmenities', { n: court.amenities.length - 3 })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 完整價表：僅 desktop；只顯示用戶會籍對應價錢 */}
              <div className="hidden sm:block space-y-2">
                {court.pricing.timeSlots && court.pricing.timeSlots.length > 0 ? (
                  court.pricing.timeSlots.map((slot: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{slot.name}</span>
                      <span className="text-sm font-bold text-primary-600">
                        {t('common.perHourPoints', { n: displayPrice(slot.price) })}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{t('bookingPage.courtSelector.offPeak')}</span>
                      <span className="text-sm font-bold text-primary-600">
                        {t('common.perHourPoints', {
                          n: displayPrice(court.pricing.offPeak),
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">{t('bookingPage.courtSelector.peak')}</span>
                      <span className="text-sm font-bold text-primary-600">
                        {t('common.perHourPoints', {
                          n: displayPrice(court.pricing.peakHour),
                        })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
            );
          })}
      </div>

      {courts.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🏓</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {t('bookingPage.courtSelector.emptyTitle')}
          </h3>
          <p className="text-gray-600">
            {t('bookingPage.courtSelector.emptySubtitle')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CourtSelector;
