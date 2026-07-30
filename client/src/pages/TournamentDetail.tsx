import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import apiConfig from '../config/api';
import SEO from '../components/SEO/SEO';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import { resolveMediaUrl } from '../utils/storeBrandUtils';
import {
  ArrowLeftIcon,
  BuildingStorefrontIcon,
  CalendarIcon,
  MapPinIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

type Phase = {
  id: string;
  name: string;
  phase: 'group' | 'knockout';
  advancePerGroup?: number;
  competitionDate?: string;
};

type Detail = {
  id: string;
  name: string;
  description: string;
  dateStart: string | null;
  dateEnd: string | null;
  venues: string[];
  status: string;
  store: {
    name: string;
    slug: string;
    logoUrl?: string | null;
    district?: string | null;
    address?: string | null;
  };
  phases: Phase[];
};

function formatDate(d: string | null) {
  if (!d) return '日期待定';
  return new Date(d).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function statusLabel(s: string) {
  if (s === 'ongoing') return '進行中';
  if (s === 'completed') return '已完結';
  return '即將開始';
}

const TournamentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    setLoading(true);
    fetch(`${base}/platform/alliance/tournaments/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message || '載入失敗');
        }
        return r.json();
      })
      .then((data) => setDetail(data.tournament))
      .catch((e) => {
        setError(e.message || '載入失敗');
        setDetail(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const logoSrc = resolveMediaUrl(detail?.store?.logoUrl);

  return (
    <>
      <SEO
        title={detail ? `${detail.name} | PickCourt` : '賽事詳情 | PickCourt'}
        description={detail?.description || 'PickCourt 聯盟賽事詳情'}
        url={`/tournaments/${id || ''}`}
      />
      <PickleCourtNav />
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-pickcourt-navy mb-6"
          >
            <ArrowLeftIcon className="h-4 w-4" /> 返回比賽列表
          </Link>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold" />
            </div>
          ) : error || !detail ? (
            <div className="text-center py-16">
              <p className="text-slate-500">{error || '賽事不存在'}</p>
              <Link to="/tournaments" className="text-pickcourt-gold mt-4 inline-block">
                返回列表
              </Link>
            </div>
          ) : (
            <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="bg-pickcourt-navy text-white px-6 py-8">
                <div className="flex items-center gap-3 mb-4">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt=""
                      className="h-12 max-w-[120px] object-contain bg-white/90 rounded-lg px-2 py-1"
                    />
                  ) : (
                    <BuildingStorefrontIcon className="h-10 w-10 text-pickcourt-gold" />
                  )}
                  <div className="text-sm text-pickcourt-gold">
                    {detail.store.name}
                    {detail.store.district ? ` · ${detail.store.district}` : ''}
                  </div>
                </div>
                <div className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-pickcourt-gold/20 text-pickcourt-gold mb-3">
                  {statusLabel(detail.status)}
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold">{detail.name}</h1>
              </div>

              <div className="p-6 space-y-6">
                {detail.description && (
                  <p className="text-slate-700 whitespace-pre-wrap">{detail.description}</p>
                )}

                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-pickcourt-gold" />
                    <span>
                      {formatDate(detail.dateStart)}
                      {detail.dateEnd && detail.dateEnd !== detail.dateStart
                        ? ` – ${formatDate(detail.dateEnd)}`
                        : ''}
                    </span>
                  </div>
                  {(detail.venues?.[0] || detail.store.address) && (
                    <div className="flex items-start gap-2">
                      <MapPinIcon className="h-5 w-5 text-pickcourt-gold shrink-0 mt-0.5" />
                      <span>{detail.venues?.[0] || detail.store.address}</span>
                    </div>
                  )}
                </div>

                <section>
                  <h2 className="text-lg font-bold text-pickcourt-navy mb-3 flex items-center gap-2">
                    <TrophyIcon className="h-5 w-5 text-pickcourt-gold" />
                    賽制
                  </h2>
                  {detail.phases.length === 0 ? (
                    <p className="text-sm text-slate-500">賽制籌備中，稍後公布</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.phases.map((p) => (
                        <li
                          key={p.id}
                          className="border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="font-medium text-pickcourt-navy">{p.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {p.phase === 'group' ? '小組賽' : '淘汰賽'}
                              {p.competitionDate ? ` · ${p.competitionDate}` : ''}
                              {p.phase === 'group' && p.advancePerGroup
                                ? ` · 每組晉級 ${p.advancePerGroup} 名`
                                : ''}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <Link
                  to={`/store/${detail.store.slug}`}
                  className="inline-flex text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold"
                >
                  查看主辦場地 →
                </Link>
              </div>
            </article>
          )}
        </div>
      </main>
      <PickleCourtFooter />
    </>
  );
};

export default TournamentDetail;
