import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiConfig from '../config/api';
import { resolveMediaUrl } from '../utils/storeBranding';
import { PICKCOURT_HOME, pickcourtHomeHash } from '../utils/pickcourtRoutes';
import { MapPinIcon, PhoneIcon, CalendarDaysIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

type StorePublic = {
  id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  phone?: string;
  intro?: string;
  tagline?: string | null;
  logoUrl?: string | null;
  courtCount?: number;
};

const StorePublic: React.FC = () => {
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  const [store, setStore] = useState<StorePublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/stores/${encodeURIComponent(storeSlug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setStore(data.store))
      .catch(() => setStore(null))
      .finally(() => setLoading(false));
  }, [storeSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
        <h1 className="text-2xl font-bold text-gray-900">找不到此場地</h1>
        <Link to={PICKCOURT_HOME} className="mt-6 text-primary-600 font-medium">返回 PickCourt</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-pickcourt-navy-dark via-pickcourt-navy to-pickcourt-navy-light text-white">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
          <Link to={PICKCOURT_HOME} className="text-sm text-white/70 hover:text-white">← PickCourt</Link>
          <div className="mt-6 flex flex-col sm:flex-row gap-6 items-start">
            {store.logoUrl ? (
              <img src={resolveMediaUrl(store.logoUrl) || ''} alt="" className="w-24 h-24 rounded-xl object-contain bg-white/10 p-1" />
            ) : null}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold">{store.name}</h1>
              {store.tagline && <p className="mt-2 text-pickcourt-gold text-lg">{store.tagline}</p>}
              {store.district && (
                <p className="mt-3 flex items-center gap-2 text-white/80 text-sm">
                  <MapPinIcon className="w-4 h-4" />
                  {store.district} · {store.address}
                </p>
              )}
              {store.phone && (
                <p className="mt-1 flex items-center gap-2 text-white/80 text-sm">
                  <PhoneIcon className="w-4 h-4" />
                  {store.phone}
                </p>
              )}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={`/booking/${store.slug}`}
              className="inline-flex items-center gap-2 bg-pickcourt-gold text-pickcourt-navy-dark font-bold px-6 py-3 rounded-xl hover:bg-pickcourt-gold-light"
            >
              <CalendarDaysIcon className="w-5 h-5" />
              立即預約
            </Link>
            <Link
              to={pickcourtHomeHash('search')}
              className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10"
            >
              搜尋其他時段
              <ArrowRightIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 sm:py-14">
        {store.intro ? (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">場地介紹</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{store.intro}</p>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-gray-500">
            場地介紹即將推出
          </section>
        )}
        {store.courtCount != null && store.courtCount > 0 && (
          <p className="mt-6 text-sm text-gray-500 text-center">{store.courtCount} 個可預約場地</p>
        )}
      </main>
    </div>
  );
};

export default StorePublic;
