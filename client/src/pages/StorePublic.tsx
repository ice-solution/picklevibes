import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../config/api';
import SEO from '../components/SEO/SEO';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import { resolveMediaUrl, storeBrandStyles, storePrimaryColor } from '../utils/storeBrandUtils';
import { PICKCOURT_HOME, pickcourtHomeHash } from '../utils/pickcourtRoutes';
import { suggestCourtSlug } from '../constants/courtSlug';
import { useStoreTenantHost } from '../contexts/StoreTenantHostContext';
import {
  MapPinIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

type StoreCourt = {
  id: string;
  name: string;
  slug: string;
  number: number;
  type: string;
  capacity: number;
  description?: string;
};

type GameHall = {
  id: string;
  name: string;
  description?: string;
  seasonKey: string;
};

type StorePublicData = {
  id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  phone?: string;
  intro?: string;
  tagline?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  courtCount?: number;
  courts?: StoreCourt[];
  gameHalls?: GameHall[];
};

const COURT_TYPE_LABEL: Record<string, string> = {
  competition: '比賽場',
  training: '訓練場',
  solo: '單人場',
  dink: '特色場',
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.4 },
};

const StorePublic: React.FC = () => {
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  const { isConsumerHost } = useStoreTenantHost();
  const [store, setStore] = useState<StorePublicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/stores/${encodeURIComponent(storeSlug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setStore(data.store))
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [storeSlug]);

  const primary = useMemo(
    () => storePrimaryColor(store ? { branding: { primaryColor: store.primaryColor || undefined } } : null),
    [store]
  );
  const brandStyle = useMemo(() => storeBrandStyles(primary), [primary]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        {!isConsumerHost && <PickleCourtNav />}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-24">
          <h1 className="text-2xl font-bold text-gray-900">找不到此場地</h1>
          <p className="mt-2 text-gray-500 text-sm">場地可能未加入 PickCourt 聯盟或已下架</p>
          <Link to={PICKCOURT_HOME} className="mt-6 text-pickcourt-navy font-medium hover:text-pickcourt-gold">
            返回 PickCourt
          </Link>
        </div>
        {!isConsumerHost && <PickleCourtFooter />}
      </div>
    );
  }

  const courts = store.courts || [];
  const gameHalls = store.gameHalls || [];

  return (
    <div className="min-h-screen bg-slate-50" style={brandStyle}>
      <SEO
        title={`${store.name} | PickCourt 聯盟場地`}
        description={store.tagline || store.intro?.slice(0, 120) || `${store.name} — PickCourt 聯盟匹克球場地`}
        url={`/store/${store.slug}`}
      />

      {!isConsumerHost && <PickleCourtNav />}

      <header
        className={`relative text-white overflow-hidden ${isConsumerHost ? 'pt-8' : 'pt-24 lg:pt-28'}`}
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 88%, black) 0%, ${primary} 45%, color-mix(in srgb, ${primary} 70%, #c9a227) 100%)`,
        }}
      >
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 15% 40%, rgba(255,255,255,0.35) 0%, transparent 45%),
                radial-gradient(circle at 85% 20%, rgba(201,162,39,0.4) 0%, transparent 40%)`,
            }}
          />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          {!isConsumerHost && (
            <Link to={PICKCOURT_HOME} className="text-sm text-white/70 hover:text-white">
              ← PickCourt
            </Link>
          )}

          <div className={`flex flex-col sm:flex-row gap-6 items-start ${isConsumerHost ? '' : 'mt-6'}`}>
            {store.logoUrl ? (
              <img
                src={resolveMediaUrl(store.logoUrl) || ''}
                alt=""
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-contain bg-white/15 p-2 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-white/15 flex items-center justify-center text-3xl font-bold">
                {store.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{store.name}</h1>
              {store.tagline && (
                <p className="mt-2 text-lg text-white/90 font-medium">{store.tagline}</p>
              )}
              <div className="mt-4 space-y-1.5 text-sm text-white/80">
                {(store.district || store.address) && (
                  <p className="flex items-start gap-2">
                    <MapPinIcon className="w-4 h-4 shrink-0 mt-0.5" />
                    {store.district ? `${store.district} · ` : ''}
                    {store.address}
                  </p>
                )}
                {store.phone && (
                  <p className="flex items-center gap-2">
                    <PhoneIcon className="w-4 h-4 shrink-0" />
                    <a href={`tel:${store.phone}`} className="hover:text-white">
                      {store.phone}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/booking/${store.slug}#court`}
              className="inline-flex items-center gap-2 bg-white font-bold px-6 py-3 rounded-xl shadow-md hover:bg-white/95 transition-colors"
              style={{ color: primary }}
            >
              <CalendarDaysIcon className="w-5 h-5" />
              立即預約
            </Link>
            <Link
              to={pickcourtHomeHash('search')}
              className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors"
            >
              搜尋其他時段
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {store.intro ? (
          <motion.section {...fadeUp} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">場地介紹</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{store.intro}</p>
          </motion.section>
        ) : null}

        {courts.length > 0 && (
          <motion.section {...fadeUp} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">可預約場地</h2>
                <p className="text-sm text-gray-500 mt-1">共 {courts.length} 個場地</p>
              </div>
              <UserGroupIcon className="w-8 h-8 text-gray-300 hidden sm:block" />
            </div>
            <ul className="grid sm:grid-cols-2 gap-4">
              {courts.map((court) => (
                <li
                  key={court.id}
                  className="flex flex-col rounded-xl border border-slate-200 p-4 hover:border-[var(--store-primary-border)] hover:shadow-sm transition-all"
                  style={{ backgroundColor: 'var(--store-primary-soft)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-gray-900">{court.name}</p>
                      {COURT_TYPE_LABEL[court.type] && (
                        <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 text-gray-600">
                          {COURT_TYPE_LABEL[court.type]}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">#{court.number}</span>
                  </div>
                  {court.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{court.description}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">最多 {court.capacity} 人</p>
                  <Link
                    to={`/booking/${store.slug}/${court.slug || suggestCourtSlug(court.type, court.number)}#date`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold hover:opacity-80"
                    style={{ color: primary }}
                  >
                    選擇時段預約
                    <ArrowRightIcon className="w-4 h-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {gameHalls.length > 0 && (
          <motion.section {...fadeUp} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <TrophyIcon className="w-7 h-7 text-pickcourt-gold" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">計分廳 · 比賽</h2>
                <p className="text-sm text-gray-500">場內比賽與排行榜</p>
              </div>
            </div>
            <ul className="space-y-3">
              {gameHalls.map((hall) => (
                <li
                  key={hall.id}
                  className="rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{hall.name}</p>
                    {hall.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{hall.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">賽季 {hall.seasonKey}</span>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {!store.intro && courts.length === 0 && (
          <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-gray-500">
            場地資訊整理中，請直接按「立即預約」查看可選時段
          </section>
        )}
      </main>

      {!isConsumerHost && <PickleCourtFooter />}
    </div>
  );
};

export default StorePublic;
