import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiConfig from '../../config/api';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';
import { ArrowRightIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';

type AllianceActivity = {
  id: string;
  title: string;
  startDate: string;
  location: string;
  store: {
    name: string;
    district?: string | null;
    logoUrl?: string | null;
  } | null;
};

function formatWhen(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-HK', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 首頁近期活動：只做瀏覽，報名留喺詳情頁 */
const PickCourtAllianceActivities: React.FC = () => {
  const [activities, setActivities] = useState<AllianceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    setLoading(true);
    setError('');
    fetch(`${base}/platform/alliance/activities?limit=6`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || '載入活動失敗');
        setActivities(data.activities || []);
      })
      .catch((e) => {
        setActivities([]);
        setError(e instanceof Error ? e.message : '載入活動失敗');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section id="activities" className="py-12 lg:py-16 bg-slate-50 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl lg:text-2xl font-bold text-pickcourt-navy">近期活動</h2>
            <p className="mt-1 text-sm text-slate-500">想報名先睇詳情；唔急都可以慢慢揀。</p>
          </div>
          <Link
            to="/activities"
            className="text-sm font-medium text-pickcourt-navy/70 hover:text-pickcourt-navy underline underline-offset-2"
          >
            全部活動
          </Link>
        </div>

        {loading && (
          <div className="space-y-2" aria-busy="true">
            <p className="text-sm text-slate-500">載入活動…</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-200/60 animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-red-700">
            {error}
            <button type="button" className="ml-2 underline" onClick={load}>
              再試
            </button>
          </p>
        )}

        {!loading && !error && activities.length === 0 && (
          <p className="text-sm text-slate-500 py-6">暫時未有活動，有新場次會喺呢度出現。</p>
        )}

        {!loading && !error && activities.length > 0 && (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
            {activities.map((activity) => {
              const logoSrc = resolveMediaUrl(activity.store?.logoUrl);
              return (
                <li key={activity.id}>
                  <Link
                    to={`/activities/${activity.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-9 w-9 rounded-lg object-contain bg-slate-50 shrink-0"
                      />
                    ) : (
                      <span className="h-9 w-9 rounded-lg bg-slate-100 shrink-0" aria-hidden />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-pickcourt-navy truncate">
                        {activity.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {activity.store?.name && <span>{activity.store.name}</span>}
                        <span className="inline-flex items-center gap-0.5">
                          <CalendarDaysIcon className="h-3.5 w-3.5" />
                          {formatWhen(activity.startDate)}
                        </span>
                        {activity.location && (
                          <span className="inline-flex items-center gap-0.5 truncate">
                            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                            {activity.location}
                          </span>
                        )}
                      </span>
                    </span>
                    <ArrowRightIcon className="h-4 w-4 text-slate-300 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default PickCourtAllianceActivities;
