import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../config/api';
import SEO from '../components/SEO/SEO';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import { resolveMediaUrl } from '../utils/storeBrandUtils';
import {
  BuildingStorefrontIcon,
  CalendarIcon,
  MapPinIcon,
  TrophyIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type Item = {
  id: string;
  name: string;
  description: string;
  dateStart: string | null;
  dateEnd: string | null;
  venues: string[];
  status: string;
  tournamentCount: number;
  groupCount: number;
  knockoutCount: number;
  store: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    district?: string | null;
  } | null;
};

function formatDate(d: string | null) {
  if (!d) return '日期待定';
  return new Date(d).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const Tournaments: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/alliance/tournaments?limit=50`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setItems(data.tournaments || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEO
        title="比賽賽事 | PickCourt"
        description="瀏覽 PickCourt 聯盟場地舉辦的匹克球比賽與賽事。"
        url="/tournaments"
      />
      <PickleCourtNav />
      <main className="min-h-screen bg-slate-50">
        <div className="bg-pickcourt-navy text-white py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <TrophyIcon className="h-10 w-10 text-pickcourt-gold mx-auto mb-3" />
            <h1 className="text-3xl font-bold">比賽賽事</h1>
            <p className="mt-2 text-slate-300">聯盟場地賽事一覽（與活動中心分開）</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-slate-500 py-16">暫無公開賽事</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => {
                const logoSrc = resolveMediaUrl(item.store?.logoUrl);
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-pickcourt-gold/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {logoSrc ? (
                        <img src={logoSrc} alt="" className="h-10 w-10 object-contain" />
                      ) : (
                        <BuildingStorefrontIcon className="h-8 w-8 text-slate-400" />
                      )}
                      <div className="text-sm text-pickcourt-gold-dark font-medium">
                        {item.store?.name}
                        {item.store?.district ? ` · ${item.store.district}` : ''}
                      </div>
                    </div>
                    <h2 className="text-lg font-bold text-pickcourt-navy mb-2">{item.name}</h2>
                    {item.description && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{item.description}</p>
                    )}
                    <div className="space-y-1 text-sm text-slate-600 mb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 text-pickcourt-gold" />
                        {formatDate(item.dateStart)}
                        {item.dateEnd && item.dateEnd !== item.dateStart
                          ? ` – ${formatDate(item.dateEnd)}`
                          : ''}
                      </div>
                      {item.venues?.[0] && (
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4 text-pickcourt-gold" />
                          {item.venues[0]}
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/tournaments/${item.id}`}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold"
                    >
                      查看賽事 <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <PickleCourtFooter />
    </>
  );
};

export default Tournaments;
