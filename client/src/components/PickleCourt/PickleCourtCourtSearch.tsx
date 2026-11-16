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
import {
  COURT_TYPE_BADGE_LABEL,
  COURT_TYPE_DESCRIPTIONS,
  COURT_TYPE_OPTIONS,
  HK_REGION_OPTIONS,
} from '../../constants/hkDistricts';
import { suggestCourtSlug } from '../../constants/courtSlug';
import { isValidBookingDate } from '../../utils/bookingRoutes';
import { resolveMediaUrl } from '../../utils/storeBrandUtils';

type SearchResult = {
  store: {
    id: string;
    name: string;
    slug: string;
    address: string;
    district?: string | null;
    region?: string | null;
    tagline?: string | null;
    intro?: string | null;
    coverImage?: string | null;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    amenities?: string[];
    policySnippet?: string | null;
    enableVipDiscount?: boolean;
  };
  court: {
    id: string;
    name: string;
    slug: string;
    number: number;
    type: string;
    amenities?: string[];
    image?: string | null;
  };
  available: boolean;
  startTime?: string;
  endTime?: string;
  pricing?: { totalPrice: number; slotName: string };
  bookingUrl?: string;
};

const AMENITY_LABEL: Record<string, string> = {
  air_conditioning: '冷氣',
  lighting: '燈光',
  net: '球網',
  paddles: '球拍',
  balls: '球',
  water: '飲用水',
  shower: '淋浴',
  vending_machine: '售賣機',
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

const ALL_TIME_OPTIONS = Array.from({ length: 15 }, (_, i) => {
  const hour = i + 8;
  return `${String(hour).padStart(2, '0')}:00`;
});

/** 香港日曆 YYYY-MM-DD（與後端 bookingDateTime 一致） */
function hkYmdFromDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function todayYmd() {
  return hkYmdFromDate(new Date());
}

function maxDateYmd(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return hkYmdFromDate(d);
}

/** 與 TimeSlotSelector／後端一致：開始前 15 分鐘內視作已過 */
function isStartTimePast(dateYmd: string, startTime: string, now = new Date()) {
  if (dateYmd !== hkYmdFromDate(now)) return false;
  const [hour, minute] = startTime.split(':').map(Number);
  const startMs = new Date(`${dateYmd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`).getTime();
  return startMs <= now.getTime() + 15 * 60 * 1000;
}

function availableTimeOptions(dateYmd: string, now = new Date()) {
  return ALL_TIME_OPTIONS.filter((t) => !isStartTimePast(dateYmd, t, now));
}

function hkHourMinute(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? '0'),
  };
}

/** 下一個整點：4:09 → 17:00；剛好 5:00 → 17:00 */
function nextUpcomingHour(now = new Date()): string {
  const { hour, minute } = hkHourMinute(now);
  let h = minute === 0 ? hour : hour + 1;
  if (h < 8) h = 8;
  if (h > 22) h = 22;
  return `${String(h).padStart(2, '0')}:00`;
}

function firstAvailableStartTime(dateYmd: string, preferred?: string) {
  const opts = availableTimeOptions(dateYmd);
  if (preferred && opts.includes(preferred)) return preferred;
  return opts[0] || ALL_TIME_OPTIONS[ALL_TIME_OPTIONS.length - 1];
}

/** 打開頁面預設：今日 → 最近下一個可預約整點；其他日期 → 10:00 */
function defaultStartTime(dateYmd: string, preferredFromUrl?: string | null) {
  if (preferredFromUrl && availableTimeOptions(dateYmd).includes(preferredFromUrl)) {
    return preferredFromUrl;
  }
  if (dateYmd === todayYmd()) {
    return firstAvailableStartTime(dateYmd, nextUpcomingHour());
  }
  if (preferredFromUrl && ALL_TIME_OPTIONS.includes(preferredFromUrl)) {
    return preferredFromUrl;
  }
  return '10:00';
}

function searchCourtSlug(item: SearchResult): string {
  if (item.court.slug?.trim()) return item.court.slug.trim().toLowerCase();
  return suggestCourtSlug(item.court.type, item.court.number);
}

/** 後端 bookingUrl 缺 court slug 時會變成 /booking/store/date（3 段），不可直接用 */
function isBrokenSearchBookingPath(pathname: string): boolean {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts[0] !== 'booking' || parts.length !== 3) return false;
  return isValidBookingDate(parts[2]);
}

function allianceBookingPath(item: SearchResult, query: SearchResponse['query']): string {
  const params = new URLSearchParams();
  if (query.startTime) params.set('startTime', query.startTime);
  if (query.duration) params.set('duration', String(query.duration));
  params.set('courtId', item.court.id);
  const qs = params.toString();
  const qSuffix = qs ? `?${qs}` : '';

  const courtSlug = searchCourtSlug(item);
  const canonical = `/booking/${item.store.slug}/${courtSlug}/${query.date}${qSuffix}#time`;

  if (item.bookingUrl) {
    try {
      const u = new URL(item.bookingUrl);
      if (!isBrokenSearchBookingPath(u.pathname)) {
        return `${u.pathname}${qs ? `?${qs}` : u.search}#time`;
      }
    } catch {
      if (item.bookingUrl.startsWith('/') && !isBrokenSearchBookingPath(item.bookingUrl.split('?')[0])) {
        const base = item.bookingUrl.split('?')[0];
        return `${base}${qSuffix}#time`;
      }
    }
  }
  return canonical;
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
  const [startTime, setStartTime] = useState(() => {
    const d = syncUrl ? searchParams.get('date') || todayYmd() : todayYmd();
    const urlTime = syncUrl ? searchParams.get('startTime') : null;
    return defaultStartTime(d, urlTime);
  });
  const [duration, setDuration] = useState(syncUrl ? searchParams.get('duration') || '60' : '60');
  const [courtType, setCourtType] = useState(syncUrl ? searchParams.get('courtType') || '' : '');

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);

  const timeOptions = availableTimeOptions(date);

  // 改日期後：若目前開始時間已過，自動跳去下一個可選時段
  useEffect(() => {
    const opts = availableTimeOptions(date);
    if (!opts.includes(startTime)) {
      setStartTime(date === todayYmd() ? defaultStartTime(date) : opts[0] || '10:00');
    }
  }, [date, startTime]);

  const runSearch = useCallback(
    async (overrides?: Partial<{ district: string; date: string; startTime: string; duration: string; courtType: string }>) => {
      const q = {
        district: overrides?.district ?? district,
        date: overrides?.date ?? date,
        startTime: overrides?.startTime ?? startTime,
        duration: overrides?.duration ?? duration,
        courtType: overrides?.courtType ?? courtType,
      };

      if (isStartTimePast(q.date, q.startTime)) {
        setSearched(true);
        setData(null);
        setError('不可搜尋已過去的時段，請選擇稍後或明日的時間');
        return;
      }

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
      const d = searchParams.get('date') || todayYmd();
      const t = defaultStartTime(d, searchParams.get('startTime'));
      runSearch({
        district: searchParams.get('district') || '',
        date: d,
        startTime: t,
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

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate);
    setStartTime(defaultStartTime(nextDate));
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
              {/* 地區：香港／九龍／新界 */}
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
                    {HK_REGION_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
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
                    onChange={(e) => handleDateChange(e.target.value)}
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
                    disabled={timeOptions.length === 0}
                  >
                    {timeOptions.length === 0 ? (
                      <option value="">今日已無可用時段</option>
                    ) : (
                      timeOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))
                    )}
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
                disabled={loading || timeOptions.length === 0}
                className="flex items-center justify-center gap-2 bg-[#0062E3] hover:bg-[#0050b8] disabled:opacity-70 text-white font-bold text-lg px-8 py-4 xl:py-0 xl:min-w-[130px] transition-colors shrink-0"
              >
                <MagnifyingGlassIcon className="h-6 w-6" />
                {loading ? '搜尋中…' : '搜尋'}
              </button>
            </div>
            {courtType && COURT_TYPE_DESCRIPTIONS[courtType] && (
              <p className="mt-3 text-sm text-white/85 bg-white/10 border border-white/15 rounded-lg px-4 py-3">
                {COURT_TYPE_DESCRIPTIONS[courtType]}
              </p>
            )}
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
                <ul className="space-y-5">
                  {data.available.map((item) => {
                    const cover =
                      resolveMediaUrl(
                        item.store.coverImage || item.court.image || item.store.bannerUrl || item.store.logoUrl
                      ) || '';
                    const amenities = (item.court.amenities?.length
                      ? item.court.amenities
                      : item.store.amenities || []
                    ).slice(0, 4);
                    const listPrice = Number(item.pricing?.totalPrice) || 0;
                    return (
                      <li
                        key={`${item.court.id}-${item.startTime}`}
                        className="overflow-hidden rounded-xl border border-gray-200 hover:border-pickcourt-gold/40 hover:shadow-md transition-all bg-white"
                      >
                        <div className="flex flex-col md:flex-row">
                          <div className="relative md:w-64 lg:w-72 shrink-0 bg-slate-100 aspect-[16/10] md:aspect-auto md:min-h-[180px]">
                            {cover ? (
                              <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                <BuildingStorefrontIcon className="h-14 w-14" />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0 p-5 flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/store/${item.store.slug}`}
                                className="font-bold text-xl text-pickcourt-navy hover:text-pickcourt-gold transition-colors"
                              >
                                {item.store.name}
                              </Link>
                              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                <MapPinIcon className="h-4 w-4 shrink-0" />
                                {item.store.region || item.store.district
                                  ? `${item.store.region || item.store.district} · `
                                  : ''}
                                {item.store.address}
                                <Link
                                  to={`/store/${item.store.slug}`}
                                  className="ml-1 text-[#0062E3] hover:underline shrink-0"
                                >
                                  詳情
                                </Link>
                              </p>
                              {(item.store.tagline || item.store.intro) && (
                                <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                                  {item.store.tagline || item.store.intro}
                                </p>
                              )}

                              <div className="mt-3 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2.5">
                                <p className="font-semibold text-gray-900">
                                  {item.court.name}
                                  {(COURT_TYPE_BADGE_LABEL[item.court.type] ||
                                    COURT_TYPE_OPTIONS.find((o) => o.value === item.court.type)?.label) && (
                                    <span className="ml-2 text-xs font-medium bg-white text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                                      {COURT_TYPE_BADGE_LABEL[item.court.type] ||
                                        COURT_TYPE_OPTIONS.find((o) => o.value === item.court.type)?.label}
                                    </span>
                                  )}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">
                                  {item.startTime} – {item.endTime}
                                  {item.pricing?.slotName ? ` · ${item.pricing.slotName}` : ''}
                                </p>
                                {amenities.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {amenities.map((a) => AMENITY_LABEL[a] || a).join(' · ')}
                                  </p>
                                )}
                                {item.store.policySnippet && (
                                  <p className="text-xs text-amber-700 mt-1.5">{item.store.policySnippet}</p>
                                )}
                              </div>
                            </div>

                            <div className="sm:w-44 shrink-0 flex flex-col items-stretch sm:items-end justify-between gap-3">
                              <div className="text-left sm:text-right">
                                <p className="text-sm text-gray-500">時段費用</p>
                                <p className="text-2xl font-bold text-[#0062E3]">
                                  {listPrice > 0 ? `HK$${listPrice}` : '—'}
                                </p>
                                {item.store.enableVipDiscount && (
                                  <p className="text-xs text-emerald-700 mt-0.5">本店可享 VIP 場租優惠</p>
                                )}
                              </div>
                              <Link
                                to={allianceBookingPath(item, data.query)}
                                className="inline-flex items-center justify-center gap-2 bg-[#0062E3] text-white font-semibold px-5 py-3 rounded-lg hover:bg-[#0050b8] transition-colors"
                              >
                                查看可訂
                                <ArrowRightIcon className="h-4 w-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
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
