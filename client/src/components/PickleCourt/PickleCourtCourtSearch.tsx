import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowRightIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';
import apiConfig from '../../config/api';
import { COURT_TYPE_OPTIONS, HK_DISTRICTS } from '../../constants/hkDistricts';

type SearchResult = {
  store: { id: string; name: string; slug: string; address: string; district?: string | null };
  court: { id: string; name: string; slug: string; number: number; type: string };
  available: boolean;
  startTime?: string;
  endTime?: string;
  pricing?: { totalPrice: number; slotName: string };
  bookingUrl?: string;
};

type SearchResponse = {
  query: {
    district: string;
    region: string;
    date: string;
    startTime: string;
    duration: number;
    courtType: string;
  };
  available: SearchResult[];
  meta: { storeCount: number; courtCount: number; availableCount: number };
};

const TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const hour = i + 8;
  return `${String(hour).padStart(2, '0')}:00`;
});

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function maxDateYmd(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const courtTypeBadge: Record<string, string> = {
  competition: '比賽場',
  training: '訓練場',
  solo: '單人場',
  dink: '特色場',
};

function allianceBookingPath(item: SearchResult, query: SearchResponse['query']): string {
  const params = new URLSearchParams();
  if (query.startTime) params.set('startTime', query.startTime);
  if (query.duration) params.set('duration', String(query.duration));
  const qs = params.toString();
  const qSuffix = qs ? `?${qs}` : '';

  if (item.bookingUrl) {
    try {
      const u = new URL(item.bookingUrl);
      return `${u.pathname}${qs ? `?${qs}` : u.search}#time`;
    } catch {
      if (item.bookingUrl.startsWith('/')) {
        const base = item.bookingUrl.split('?')[0];
        return `${base}${qSuffix}#time`;
      }
    }
  }
  return `/booking/${item.store.slug}/${item.court.slug}/${query.date}${qSuffix}#time`;
}

type Props = {
  /** 嵌入首頁時顯示精簡標題 */
  embedded?: boolean;
  /** 是否同步 URL 查詢參數 */
  syncUrl?: boolean;
};

const PickleCourtCourtSearch: React.FC<Props> = ({ embedded = false, syncUrl = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [district, setDistrict] = useState(syncUrl ? searchParams.get('district') || '' : '');
  const [date, setDate] = useState(syncUrl ? searchParams.get('date') || todayYmd() : todayYmd());
  const [startTime, setStartTime] = useState(syncUrl ? searchParams.get('startTime') || '10:00' : '10:00');
  const [duration, setDuration] = useState(syncUrl ? searchParams.get('duration') || '60' : '60');
  const [courtType, setCourtType] = useState(syncUrl ? searchParams.get('courtType') || '' : '');

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);

  const runSearch = useCallback(
    async (overrides?: Partial<{ district: string; date: string; startTime: string; duration: string; courtType: string }>) => {
      const q = {
        district: overrides?.district ?? district,
        date: overrides?.date ?? date,
        startTime: overrides?.startTime ?? startTime,
        duration: overrides?.duration ?? duration,
        courtType: overrides?.courtType ?? courtType,
      };

      setLoading(true);
      setError('');
      setSearched(true);

      const params = new URLSearchParams({
        district: q.district,
        date: q.date,
        startTime: q.startTime,
        duration: q.duration,
      });
      if (q.courtType) params.set('courtType', q.courtType);
      if (syncUrl) setSearchParams(params, { replace: true });

      try {
        const res = await fetch(
          `${apiConfig.API_BASE_URL}/platform/search/courts?${params.toString()}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || '搜尋失敗');
        setData(json);
      } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : '搜尋失敗，請稍後再試');
      } finally {
        setLoading(false);
      }
    },
    [district, date, startTime, duration, courtType, syncUrl, setSearchParams]
  );

  useEffect(() => {
    if (!syncUrl) return;
    if (searchParams.get('date') && searchParams.get('startTime')) {
      runSearch({
        district: searchParams.get('district') || '',
        date: searchParams.get('date') || todayYmd(),
        startTime: searchParams.get('startTime') || '10:00',
        duration: searchParams.get('duration') || '60',
        courtType: searchParams.get('courtType') || '',
      });
    }
    if (window.location.hash === '#search') {
      document.getElementById('search')?.scrollIntoView({ behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch();
  };

  const courtTypeLabel =
    COURT_TYPE_OPTIONS.find((o) => o.value === (data?.query.courtType || courtType))?.label || '全部場地';

  return (
    <div id="search">
      {/* Search hero */}
      <div className={`relative ${embedded ? 'pt-24 lg:pt-28' : 'pt-10 lg:pt-14'} pb-12 lg:pb-16 overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-pickcourt-navy-dark via-pickcourt-navy to-pickcourt-navy-light" />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #c9a227 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, #c9a227 0%, transparent 40%)`,
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white max-w-3xl leading-tight">
            一鍵搜尋，全港匹克球場地輕鬆預約
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-2xl">
            選擇地區、日期、時間與場地類型，即時查看聯盟合作場地的空缺時段。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 lg:mt-10">
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col xl:flex-row xl:items-stretch">
              {/* 地區 */}
              <div className="flex-1 min-w-0 border-b xl:border-b-0 xl:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  地區
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPinIcon className="h-5 w-5 text-gray-400 shrink-0" />
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full text-base font-medium text-gray-900 outline-none bg-transparent cursor-pointer"
                  >
                    <option value="">全港</option>
                    {HK_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 場地類型 */}
              <div className="flex-1 min-w-0 border-b xl:border-b-0 xl:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  場地類型
                </label>
                <select
                  value={courtType}
                  onChange={(e) => setCourtType(e.target.value)}
                  className="mt-2 w-full text-base font-medium text-gray-900 outline-none bg-transparent cursor-pointer"
                >
                  {COURT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 日期 */}
              <div className="flex-1 min-w-0 border-b xl:border-b-0 xl:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  日期
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <CalendarDaysIcon className="h-5 w-5 text-gray-400 shrink-0" />
                  <input
                    type="date"
                    value={date}
                    min={todayYmd()}
                    max={maxDateYmd(30)}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full text-base font-medium text-gray-900 outline-none bg-transparent"
                    required
                  />
                </div>
              </div>

              {/* 時間 */}
              <div className="flex-1 min-w-0 border-b xl:border-b-0 xl:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  開始時間
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <ClockIcon className="h-5 w-5 text-gray-400 shrink-0" />
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-base font-medium text-gray-900 outline-none bg-transparent cursor-pointer"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 時長 */}
              <div className="flex-1 min-w-[100px] border-b xl:border-b-0 xl:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  時長
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="mt-2 w-full text-base font-medium text-gray-900 outline-none bg-transparent cursor-pointer"
                >
                  <option value="60">1 小時</option>
                  <option value="120">2 小時</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-[#0062E3] hover:bg-[#0050b8] disabled:opacity-70 text-white font-bold text-lg px-8 py-4 xl:py-0 xl:min-w-[130px] transition-colors shrink-0"
              >
                <MagnifyingGlassIcon className="h-6 w-6" />
                {loading ? '搜尋中…' : '搜尋'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          {error && (
            <div className="mb-8 p-4 rounded-lg bg-red-50 text-red-700 border border-red-100">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-16 text-gray-500">
              <div className="inline-block h-10 w-10 border-4 border-pickcourt-gold border-t-transparent rounded-full animate-spin mb-4" />
              <p>正在查詢聯盟場地空缺…</p>
            </div>
          )}

          {!loading && searched && data && (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-pickcourt-navy">
                  {data.meta.availableCount > 0
                    ? `找到 ${data.meta.availableCount} 個空缺場地`
                    : '暫無符合條件的空缺場地'}
                </h2>
                <p className="mt-1 text-gray-500 text-sm">
                  {data.query.date} · {data.query.startTime} 起 ·{' '}
                  {Number(data.query.duration) === 120 ? '2 小時' : '1 小時'}
                  {(data.query.district || data.query.region)
                    ? ` · ${data.query.district || data.query.region}`
                    : ' · 全港'}
                  {data.query.courtType ? ` · ${courtTypeLabel}` : ''}
                  {' · '}
                  已搜尋 {data.meta.storeCount} 間聯盟場地、{data.meta.courtCount} 個場地
                </p>
              </div>

              {data.available.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-100">
                  <BuildingStorefrontIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">請嘗試其他日期、時間、地區或場地類型</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {data.available.map((item) => (
                    <li
                      key={`${item.court.id}-${item.startTime}`}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border border-gray-200 hover:border-pickcourt-gold/40 hover:shadow-md transition-all bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/store/${item.store.slug}`}
                          className="font-bold text-lg text-pickcourt-navy hover:text-pickcourt-gold transition-colors"
                        >
                          {item.store.name}
                        </Link>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                          <MapPinIcon className="h-4 w-4 shrink-0" />
                          {item.store.district ? `${item.store.district} · ` : ''}
                          {item.store.address}
                        </p>
                        <p className="mt-2 text-gray-700">
                          <span className="font-semibold">{item.court.name}</span>
                          {courtTypeBadge[item.court.type] && (
                            <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {courtTypeBadge[item.court.type]}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 sm:gap-8">
                        <div className="text-right">
                          <p className="text-sm text-gray-500">時段</p>
                          <p className="font-semibold text-pickcourt-navy">
                            {item.startTime} – {item.endTime}
                          </p>
                          {item.pricing?.slotName && (
                            <p className="text-xs text-gray-400">{item.pricing.slotName}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">費用</p>
                          <p className="text-xl font-bold text-pickcourt-gold-dark">
                            HK${item.pricing?.totalPrice ?? '—'}
                          </p>
                        </div>
                        <Link
                          to={allianceBookingPath(item, data.query)}
                          className="inline-flex items-center gap-2 bg-pickcourt-navy text-white font-semibold px-5 py-3 rounded-lg hover:bg-pickcourt-navy-light transition-colors shrink-0"
                        >
                          預約
                          <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!loading && !searched && (
            <div className="text-center py-12 text-gray-400">
              <MagnifyingGlassIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>選擇條件後按「搜尋」查看聯盟場地空缺</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PickleCourtCourtSearch;
