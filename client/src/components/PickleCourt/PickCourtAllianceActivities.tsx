import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../../config/api';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';
import {
  BuildingStorefrontIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';

type AllianceActivity = {
  id: string;
  title: string;
  description: string;
  poster?: string | null;
  posterThumb?: string | null;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  location: string;
  price: number;
  maxParticipants: number;
  totalRegistered: number;
  availableSpots: number;
  status: string;
  isEffectivelyPinned?: boolean;
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

function getImageUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
  return `${base}${path}`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDerivedStatus(a: AllianceActivity) {
  const now = new Date();
  const start = new Date(a.startDate);
  const end = new Date(a.endDate);
  if (now >= end) return 'completed';
  if (now >= start && now < end) return 'ongoing';
  return 'upcoming';
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
      return 'bg-green-100 text-green-800';
    case 'completed':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
}

const PickCourtAllianceActivities: React.FC = () => {
  const [activities, setActivities] = useState<AllianceActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/alliance/activities?limit=12`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setActivities(data.activities || []))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="activities" className="py-16 lg:py-20 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold text-pickcourt-navy">活動中心</h2>
          <p className="mt-3 text-slate-600">
            聯盟各場地的課堂與活動，依最近日期為你整理
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">
            暫無聯盟活動，請稍後再來查看
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity, index) => {
              const derived = getDerivedStatus(activity);
              const logoSrc = resolveMediaUrl(activity.store?.logoUrl);
              const posterSrc = getImageUrl(activity.posterThumb || activity.poster);

              return (
                <motion.article
                  key={activity.id}
                  {...fadeUp}
                  transition={{ delay: index * 0.04 }}
                  className={`bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-pickcourt-gold/40 hover:shadow-md transition-all flex flex-col ${
                    activity.isEffectivelyPinned ? 'ring-2 ring-amber-400' : ''
                  }`}
                >
                  {posterSrc ? (
                    <div className="relative h-40 bg-slate-100 overflow-hidden">
                      <img
                        src={posterSrc}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {activity.isEffectivelyPinned && (
                        <span className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                          置頂
                        </span>
                      )}
                    </div>
                  ) : null}

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex flex-col items-center text-center mb-4">
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt={activity.store?.name || ''}
                          className="h-12 max-w-[140px] object-contain mb-2"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center mb-2">
                          <BuildingStorefrontIcon className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                      {activity.store && (
                        <p className="text-xs font-medium text-pickcourt-gold-dark">
                          {activity.store.name}
                          {activity.store.district ? ` · ${activity.store.district}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(derived)}`}
                      >
                        {getStatusLabel(derived)}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">
                        {formatDate(activity.registrationDeadline)} 截止
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-pickcourt-navy line-clamp-2 mb-2">
                      {activity.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4 flex-1">
                      {activity.description}
                    </p>

                    <div className="space-y-1.5 text-sm text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4 shrink-0 text-pickcourt-gold" />
                        <span className="line-clamp-1">{formatDate(activity.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-pickcourt-gold" />
                        <span className="line-clamp-1">{activity.location}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <UsersIcon className="h-4 w-4 text-pickcourt-gold" />
                          {activity.totalRegistered}/{activity.maxParticipants}
                        </span>
                        <span className="flex items-center gap-1">
                          <CurrencyDollarIcon className="h-4 w-4 text-pickcourt-gold" />
                          {activity.price > 0 ? `${activity.price} 積分` : '免費'}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/activities/${activity.id}`}
                      className="inline-flex items-center justify-center gap-1 text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold transition-colors mt-auto"
                    >
                      查看詳情
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {!loading && activities.length > 0 && (
          <div className="text-center mt-10">
            <Link
              to="/activities"
              className="inline-flex items-center gap-2 text-sm font-semibold text-pickcourt-navy border border-pickcourt-gold/40 px-6 py-3 rounded-xl hover:bg-pickcourt-gold/10 transition-colors"
            >
              查看全部活動
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default PickCourtAllianceActivities;
