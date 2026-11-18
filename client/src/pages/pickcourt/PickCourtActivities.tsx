import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import apiConfig from '../../config/api';
import PickleCourtNav from '../../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../../components/PickleCourt/PickleCourtFooter';
import SEO from '../../components/SEO/SEO';
import { PICKCOURT_BOOK } from '../../utils/pickcourtRoutes';

type ActivityRow = {
  id: string;
  title: string;
  startDate: string;
  location: string;
  price?: number;
  store: {
    name: string;
    district?: string | null;
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

/**
 * 活動列表：同一聯盟 API 與首頁 teaser。
 * 主線＝揀一場睇詳情；比賽／已完結等次要選項摺疊。
 */
const PickCourtActivities: React.FC = () => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    setLoading(true);
    setError('');
    fetch(`${base}/platform/alliance/activities?limit=30`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || '載入活動失敗');
        setItems(data.activities || []);
      })
      .catch((e) => {
        setItems([]);
        setError(e instanceof Error ? e.message : '載入活動失敗');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0 flex flex-col">
      <SEO title="活動 | PickCourt" description="聯盟近期活動" url="/activities" />
      <PickleCourtNav />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-24 lg:pt-28 pb-10">
        <h1 className="text-2xl font-bold text-pickcourt-navy">活動</h1>
        <p className="mt-1 text-sm text-slate-500 mb-6">揀一場睇詳情；報名喺詳情頁先做。</p>

        {loading && (
          <div className="space-y-2" aria-busy="true">
            <p className="text-sm text-slate-500">載入活動…</p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-200/70 animate-pulse" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button type="button" className="ml-2 underline" onClick={load}>
              再試
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="py-10 text-center">
            <CalendarDaysIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-medium">暫時未有活動</p>
            <p className="text-sm text-slate-500 mt-1 mb-5">可以先去訂場，有空檔就開波。</p>
            <Link
              to={PICKCOURT_BOOK}
              className="inline-flex items-center gap-1 text-sm font-semibold text-pickcourt-navy underline underline-offset-2"
            >
              去訂場
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/activities/${a.id}`}
                  className="block rounded-xl bg-white border border-slate-200 px-4 py-3.5 hover:border-pickcourt-gold/40 transition-colors"
                >
                  <p className="font-semibold text-pickcourt-navy">{a.title}</p>
                  <p className="mt-1 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                    {a.store?.name && <span>{a.store.name}</span>}
                    <span className="inline-flex items-center gap-0.5">
                      <CalendarDaysIcon className="h-3.5 w-3.5" />
                      {formatWhen(a.startDate)}
                    </span>
                    {a.location && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {a.location}
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-8 group rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-600 flex items-center justify-between">
            <span>其他選項</span>
            <span className="text-xs text-slate-400 group-open:hidden">展開</span>
            <span className="text-xs text-slate-400 hidden group-open:inline">收起</span>
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
            <Link to="/tournaments" className="block text-pickcourt-navy/80 hover:underline">
              比賽賽事
            </Link>
            <Link to={PICKCOURT_BOOK} className="block text-pickcourt-navy/80 hover:underline">
              改去訂場
            </Link>
          </div>
        </details>
      </div>

      <div className="hidden lg:block mt-auto">
        <PickleCourtFooter />
      </div>
    </div>
  );
};

export default PickCourtActivities;
