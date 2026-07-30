import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../../config/api';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';
import {
  BuildingStorefrontIcon,
  CalendarIcon,
  MapPinIcon,
  TrophyIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type AllianceTournament = {
  id: string;
  name: string;
  slug: string;
  description: string;
  dateStart: string | null;
  dateEnd: string | null;
  venues: string[];
  status: 'upcoming' | 'ongoing' | 'completed' | string;
  tournamentCount: number;
  groupCount: number;
  knockoutCount: number;
  store: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    district?: string | null;
  } | null;
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.4 },
};

function formatDate(dateString: string | null) {
  if (!dateString) return '日期待定';
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return '日期待定';
  if (start && end) {
    const s = formatDate(start);
    const e = formatDate(end);
    return s === e ? s : `${s} – ${e}`;
  }
  return formatDate(start || end);
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'ongoing':
      return '進行中';
    case 'completed':
      return '已完結';
    default:
      return '即將開始';
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case 'ongoing':
      return 'bg-emerald-100 text-emerald-800';
    case 'completed':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

const PickCourtAllianceTournaments: React.FC = () => {
  const [items, setItems] = useState<AllianceTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/alliance/tournaments?limit=12`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setItems(data.tournaments || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="tournaments" className="py-16 lg:py-20 bg-pickcourt-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-pickcourt-gold/20 mb-4">
            <TrophyIcon className="h-6 w-6 text-pickcourt-gold" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-white">比賽賽事</h2>
          <p className="mt-3 text-slate-300">
            聯盟場地舉辦的賽事與賽制，與活動中心分開列出
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-12">
            暫無公開賽事，請稍後再來查看
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => {
              const logoSrc = resolveMediaUrl(item.store?.logoUrl);
              const venue = item.venues?.[0];

              return (
                <motion.article
                  key={item.id}
                  {...fadeUp}
                  transition={{ delay: index * 0.04 }}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-pickcourt-gold/40 hover:bg-white/10 transition-all flex flex-col"
                >
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex flex-col items-center text-center mb-4">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={item.store?.name || ''}
                          className="h-12 max-w-[140px] object-contain mb-2 bg-white/90 rounded-lg px-2 py-1"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-2">
                          <BuildingStorefrontIcon className="h-6 w-6 text-slate-300" />
                        </div>
                      )}
                      {item.store && (
                        <p className="text-xs font-medium text-pickcourt-gold">
                          {item.store.name}
                          {item.store.district ? ` · ${item.store.district}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(item.status)}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                      <span className="text-xs text-slate-400 shrink-0">
                        {item.tournamentCount > 0
                          ? `${item.tournamentCount} 個賽制`
                          : '賽制籌備中'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white line-clamp-2 mb-2">
                      {item.name}
                    </h3>
                    {item.description ? (
                      <p className="text-sm text-slate-300 line-clamp-2 mb-4 flex-1">
                        {item.description}
                      </p>
                    ) : (
                      <div className="flex-1 mb-4" />
                    )}

                    <div className="space-y-1.5 text-sm text-slate-300 mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-pickcourt-gold" />
                        <span className="line-clamp-1">
                          {formatDateRange(item.dateStart, item.dateEnd)}
                        </span>
                      </div>
                      {(venue || item.store) && (
                        <div className="flex items-center gap-2">
                          <MapPinIcon className="h-4 w-4 shrink-0 text-pickcourt-gold" />
                          <span className="line-clamp-1">
                            {venue || item.store?.name}
                          </span>
                        </div>
                      )}
                      {(item.groupCount > 0 || item.knockoutCount > 0) && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                          <TrophyIcon className="h-4 w-4 shrink-0 text-pickcourt-gold" />
                          <span>
                            {[
                              item.groupCount > 0 ? `小組賽 ${item.groupCount}` : null,
                              item.knockoutCount > 0 ? `淘汰賽 ${item.knockoutCount}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <Link
                      to={`/tournaments/${item.id}`}
                      className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-pickcourt-gold hover:text-white transition-colors mt-auto"
                    >
                      查看賽事
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="text-center mt-10">
            <Link
              to="/tournaments"
              className="inline-flex items-center gap-2 text-sm font-semibold text-pickcourt-navy bg-pickcourt-gold px-6 py-3 rounded-xl hover:bg-pickcourt-gold/90 transition-colors"
            >
              查看全部比賽
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PickCourtAllianceTournaments;
