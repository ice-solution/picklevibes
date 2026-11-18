import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, MapPinIcon } from '@heroicons/react/24/outline';
import apiConfig from '../../config/api';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';

type PremiumStore = {
  id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  courtCount?: number;
  premium: {
    badge: string;
    headline: string;
    sortOrder: number;
  } | null;
};

/** 首頁 PickCourt Premium：付費廣告橫滑（類 KeeTa Premium） */
const PickCourtPremium: React.FC = () => {
  const [stores, setStores] = useState<PremiumStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/alliance/stores`)
      .then(async (r) => {
        const data = await r.json();
        const list = (data.stores || []) as PremiumStore[];
        const premium = list
          .filter((s) => s.premium)
          .sort(
            (a, b) =>
              (a.premium?.sortOrder || 0) - (b.premium?.sortOrder || 0) ||
              a.name.localeCompare(b.name, 'zh-HK')
          );
        setStores(premium);
      })
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || stores.length === 0) return null;

  return (
    <section id="premium" className="py-8 lg:py-10 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-pickcourt-navy truncate">
              PickCourt Premium
            </h2>
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-pickcourt-gold/20 text-pickcourt-gold-dark">
              尊享體驗
            </span>
          </div>
          <Link
            to="/book"
            className="shrink-0 text-sm text-slate-500 hover:text-pickcourt-navy inline-flex items-center"
          >
            更多
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
          {stores.map((s) => {
            const cover =
              resolveMediaUrl(s.bannerUrl || s.logoUrl) || '';
            return (
              <Link
                key={s.id}
                to={`/book?store=${encodeURIComponent(s.slug)}`}
                className="snap-start shrink-0 w-[72%] sm:w-56 rounded-2xl border border-slate-200 overflow-hidden bg-white hover:border-pickcourt-gold/40 transition-colors"
              >
                <div className="relative aspect-[4/3] bg-slate-100">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
                      {s.name.slice(0, 1)}
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-pickcourt-gold text-pickcourt-navy-dark">
                    {s.premium?.badge || '廣告'}
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-bold text-pickcourt-navy text-sm line-clamp-1">{s.name}</p>
                  <p className="mt-1 text-xs text-slate-500 flex items-center gap-0.5 line-clamp-1">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                    {s.district || s.address}
                  </p>
                  {(s.premium?.headline || s.tagline) && (
                    <p className="mt-1.5 text-xs text-pickcourt-gold-dark line-clamp-2">
                      {s.premium?.headline || s.tagline}
                    </p>
                  )}
                  {s.courtCount != null && (
                    <p className="mt-1 text-[11px] text-slate-400">{s.courtCount} 個場地</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PickCourtPremium;
