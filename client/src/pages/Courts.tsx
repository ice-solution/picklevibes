import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import SEO from '../components/SEO/SEO';
import apiConfig from '../config/api';
import {
  BuildingStorefrontIcon,
  MapPinIcon,
  UsersIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type StoreSummary = {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone?: string;
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
  };
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  isActive: boolean;
};

function courtImageUrl(path?: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${apiConfig.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
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
        const initial = (saved && list.find((s) => s._id === saved)?._id) || list[0]?._id || '';
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

  return (
    <>
      <SEO
        title={t('courtsPage.seoTitle')}
        description={t('courtsPage.seoDescription')}
        keywords="pickleball courts,PickleVibes"
      />
      <div className="min-h-screen bg-gradient-to-b from-secondary-50 via-white to-primary-50">
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
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-4 max-w-2xl text-lg text-gray-600"
            >
              {t('courtsPage.subtitle')}
            </motion.p>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="bg-white/80 backdrop-blur border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-sm mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="store-select">
              {t('courtsPage.selectStore')}
            </label>
            {loadingStores ? (
              <p className="text-gray-500 text-sm">{t('courtsPage.loadingStores')}</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="relative flex-1">
                  <BuildingStorefrontIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    id="store-select"
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full appearance-none pl-10 pr-10 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500"
                  >
                    {stores.length === 0 && <option value="">{t('courtsPage.noStores')}</option>}
                    {stores.map((store) => (
                      <option key={store._id} value={store._id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedStore && (
                  <p className="text-sm text-gray-500 flex items-start gap-1.5 sm:max-w-xs">
                    <MapPinIcon className="w-4 h-4 mt-0.5 shrink-0 text-primary-500" />
                    <span>{selectedStore.address}</span>
                  </p>
                )}
              </div>
            )}
          </div>

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
                return (
                  <motion.article
                    key={court._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.05, 0.3) }}
                    className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow"
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
                    <div className="p-5 space-y-3">
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
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div className="text-sm text-gray-600">
                          {court.pricing?.peakHour != null ? (
                            <>
                              {t('courtsPage.peakLabel')}{' '}
                              <span className="font-semibold text-gray-900">
                                {t('courtsPage.points', { n: court.pricing.peakHour })}
                              </span>
                            </>
                          ) : (
                            t('common.seeBookingPage')
                          )}
                        </div>
                        <Link
                          to="/booking"
                          className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                        >
                          {t('courtsPage.goBook')}
                        </Link>
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
