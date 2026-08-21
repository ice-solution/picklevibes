import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import SEO from '../components/SEO/SEO';
import apiConfig from '../config/api';
import { resolveTimeSlotsFromCourt, PricingTimeSlot } from '../constants/courtPricing';
import {
  MapPinIcon,
  UsersIcon,
  SparklesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

type StoreOperatingHours = {
  is24Hours?: boolean;
  start?: string;
  end?: string;
  monday?: { start?: string; end?: string };
};

type StoreSummary = {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone?: string;
  description?: string;
  operatingHours?: StoreOperatingHours;
  isDefault?: boolean;
};

type Court = {
  _id: string;
  name: string;
  number: number;
  type: 'competition' | 'training' | 'solo' | 'dink' | 'full_venue';
  description?: string;
  capacity: number;
  amenities: string[];
  pricing?: {
    peakHour?: number;
    offPeak?: number;
    timeSlots?: PricingTimeSlot[];
  };
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  isActive: boolean;
};

const VIP_RATE = 0.8;

function courtImageUrl(path?: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${apiConfig.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function formatSlotHours(slot: PricingTimeSlot) {
  const end = slot.endTime === '24:00' ? '24:00' : slot.endTime;
  return `${slot.startTime}–${end}`;
}

function formatStoreHours(
  hours: StoreOperatingHours | undefined,
  t: (key: string) => string
): string {
  if (!hours) return t('courtsPage.noOperatingHours');
  if (hours.is24Hours) return t('courtsPage.open24Hours');
  if (hours.start && hours.end) return `${hours.start}–${hours.end}`;
  // 舊資料：取星期一
  if (hours.monday?.start && hours.monday?.end) {
    return `${hours.monday.start}–${hours.monday.end}`;
  }
  return t('courtsPage.noOperatingHours');
}

const Courts: React.FC = () => {
  const { t } = useTranslation();
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingStores(true);
        const res = await axios.get('/stores');
        if (cancelled) return;
        const list: StoreSummary[] = res.data.stores || [];
        setStores(list);
        const saved = localStorage.getItem('picklevibes_selected_store_id');
        const savedOk = saved && list.find((s) => s._id === saved)?._id;
        const defaultStore = list.find((s) => s.isDefault)?._id;
        // 後台「預設顯示」優先；否則用上次選擇；再否則第一間
        const initial = defaultStore || savedOk || list[0]?._id || '';
        setSelectedStoreId(initial);
      } catch (err: any) {
        if (!cancelled) setError(err.response?.data?.message || t('courtsPage.loadStoresError'));
      } finally {
        if (!cancelled) setLoadingStores(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedStoreId) {
      setCourts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoadingCourts(true);
        setError('');
        localStorage.setItem('picklevibes_selected_store_id', selectedStoreId);
        const res = await axios.get(`/courts?store=${selectedStoreId}`);
        if (cancelled) return;
        setCourts(res.data.courts || []);
      } catch (err: any) {
        if (!cancelled) {
          setCourts([]);
          setError(err.response?.data?.message || t('courtsPage.loadCourtsError'));
        }
      } finally {
        if (!cancelled) setLoadingCourts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, t]);

  const selectedStore = stores.find((s) => s._id === selectedStoreId) || null;

  const storeDescription =
    selectedStore?.description?.trim() || t('courtsPage.noStoreDescription');
  const hoursText = formatStoreHours(selectedStore?.operatingHours, t);

  return (
    <>
      <SEO
        title={t('courtsPage.seoTitle')}
        description={t('courtsPage.seoDescription')}
        keywords="pickleball courts,pricing,VIP,PickleVibes"
      />
      <div className="min-h-screen bg-gradient-to-b from-secondary-50 via-white to-primary-50">
        {/* 店鋪 Tabs（banner 上方） */}
        <div className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0 flex flex-col items-center">
            <p className="text-base sm:text-lg font-semibold text-gray-800 mb-2 text-center">{t('courtsPage.selectStore')}</p>
            {loadingStores ? (
              <p className="text-gray-500 text-sm pb-4 text-center">{t('courtsPage.loadingStores')}</p>
            ) : stores.length === 0 ? (
              <p className="text-gray-500 text-sm pb-4 text-center">{t('courtsPage.noStores')}</p>
            ) : (
              <div
                role="tablist"
                aria-label={t('courtsPage.selectStore')}
                className="flex gap-1 overflow-x-auto scrollbar-thin -mb-px justify-center max-w-full"
              >
                {stores.map((store) => {
                  const active = store._id === selectedStoreId;
                  return (
                    <button
                      key={store._id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedStoreId(store._id)}
                      className={`shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        active
                          ? 'border-primary-600 text-primary-700'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                      }`}
                    >
                      {store.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <section className="relative overflow-hidden border-b border-secondary-100">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(236,72,153,0.18), transparent 40%), radial-gradient(circle at 80% 0%, rgba(20,184,166,0.2), transparent 35%)',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-semibold tracking-[0.2em] uppercase text-secondary-600 mb-3"
            >
              {t('courtsPage.eyebrow')}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight"
            >
              {t('courtsPage.title')}
            </motion.h1>
            {selectedStore?.address && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="mt-3 text-sm text-gray-500 flex items-start gap-1.5 max-w-2xl"
              >
                <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0 text-primary-500" />
                <span>{selectedStore.address}</span>
              </motion.p>
            )}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-2xl text-lg text-gray-600 whitespace-pre-line"
            >
              {selectedStoreId ? storeDescription : t('courtsPage.subtitle')}
            </motion.p>

            {selectedStoreId && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-8 max-w-2xl"
              >
                <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5 mb-2">
                  <ClockIcon className="w-4 h-4 text-secondary-600" />
                  {t('courtsPage.operatingHoursTitle')}
                </h2>
                <p className="text-lg font-medium text-gray-900">{hoursText}</p>
              </motion.div>
            )}
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loadingCourts ? (
            <div className="text-center py-16 text-gray-500">{t('courtsPage.loadingCourts')}</div>
          ) : !selectedStoreId ? (
            <div className="text-center py-16 text-gray-500">{t('courtsPage.pickStore')}</div>
          ) : courts.length === 0 ? (
            <div className="text-center py-16 text-gray-500">{t('courtsPage.noCourts')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courts.map((court, index) => {
                const image =
                  court.images?.find((img) => img.isPrimary)?.url || court.images?.[0]?.url || '';
                const slots = resolveTimeSlotsFromCourt(court);
                return (
                  <motion.article
                    key={court._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col"
                  >
                    <div className="aspect-[16/9] bg-gradient-to-br from-secondary-100 to-primary-100 relative">
                      {image ? (
                        <img
                          src={courtImageUrl(image)}
                          alt={court.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-secondary-700/70">
                          <SparklesIcon className="w-12 h-12" />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/60 text-white">
                        {t(`courtsPage.types.${court.type}`, { defaultValue: court.type })}
                      </span>
                    </div>
                    <div className="p-5 space-y-3 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{court.name}</h2>
                          <p className="text-sm text-gray-500">
                            {t('courtsPage.courtNumber', { number: court.number })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <UsersIcon className="w-4 h-4" />
                          {court.capacity} {t('common.people')}
                        </div>
                      </div>
                      {court.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{court.description}</p>
                      )}
                      {court.amenities?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {court.amenities.slice(0, 6).map((item) => (
                            <span
                              key={item}
                              className="px-2 py-0.5 rounded-md text-xs bg-secondary-50 text-secondary-800 border border-secondary-100"
                            >
                              {t(`pricingPage.intro.amenities.${item}`, { defaultValue: item })}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto pt-3 border-t border-gray-100 space-y-3">
                        <div className="rounded-xl bg-primary-50 border border-primary-100 px-3 py-2.5">
                          <p className="text-sm font-semibold text-primary-800">
                            {t('courtsPage.vipBannerTitle')}
                          </p>
                          <p className="text-xs text-primary-700/80 mt-0.5">
                            {t('courtsPage.vipBannerSub')}
                          </p>
                        </div>

                        <div>
                          <h3 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1.5">
                            <ClockIcon className="w-4 h-4 text-gray-500" />
                            {t('courtsPage.pricingTitle')}
                          </h3>
                          {slots.length > 0 ? (
                            <ul className="space-y-2">
                              {slots.map((slot, idx) => (
                                <li
                                  key={`${slot.name}-${slot.startTime}-${idx}`}
                                  className="flex items-start justify-between gap-3 text-sm"
                                >
                                  <div className="min-w-0">
                                    <p className="font-medium text-gray-800">{slot.name}</p>
                                    <p className="text-xs text-gray-500">{formatSlotHours(slot)}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="font-semibold text-gray-900">
                                      {t('common.perHourPoints', { n: slot.price })}
                                    </p>
                                    <p className="text-xs font-semibold text-primary-700">
                                      {t('courtsPage.vipPrice', {
                                        n: Math.round(slot.price * VIP_RATE),
                                      })}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500">{t('common.seeBookingPage')}</p>
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <Link
                            to="/booking"
                            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                          >
                            {t('courtsPage.goBook')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Courts;
