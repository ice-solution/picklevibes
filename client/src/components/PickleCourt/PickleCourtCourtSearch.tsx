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
  HK_REGIONS,
  HK_REGION_OPTIONS,
  areaSearchKey,
  districtShortLabel,
  parseAreaParam,
  type HkRegion,
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
    premium?: { badge?: string; headline?: string } | null;
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

  const initialArea = parseAreaParam(syncUrl ? searchParams.get('district') : '');
  const [region, setRegion] = useState<'' | HkRegion>(initialArea.region);
  const [district, setDistrict] = useState(initialArea.district);
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
  /** Step B：搜尋後或主動展開先顯示場類型 */
  const [showMoreFilters, setShowMoreFilters] = useState(
    () => Boolean(syncUrl && searchParams.get('courtType'))
  );

  const timeOptions = availableTimeOptions(date);
  const regionDistricts = region ? HK_REGIONS[region] : [];
  const areaKey = areaSearchKey(region, district);

  const selectRegion = (next: '' | HkRegion) => {
    setRegion(next);
    setDistrict('');
  };

  const selectDistrict = (next: string) => {
    // 再撳同一細區 → 退回只揀大區
    setDistrict((prev) => (prev === next ? '' : next));
  };

  // 改日期後：若目前開始時間已過，自動跳去下一個可選時段
  useEffect(() => {
    const opts = availableTimeOptions(date);
    if (!opts.includes(startTime)) {
      setStartTime(date === todayYmd() ? defaultStartTime(date) : opts[0] || '10:00');
    }
  }, [date, startTime]);

  const runSearch = useCallback(
    async (
      overrides?: Partial<{
        district: string;
        region: '' | HkRegion;
        date: string;
        startTime: string;
        duration: string;
        courtType: string;
      }>
    ) => {
      const nextRegion = overrides?.region !== undefined ? overrides.region : region;
      const nextDistrict = overrides?.district !== undefined ? overrides.district : district;
      const q = {
        district: areaSearchKey(nextRegion, nextDistrict),
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
    [region, district, date, startTime, duration, courtType, syncUrl, setSearchParams]
  );

  useEffect(() => {
    if (!syncUrl) return;
    if (searchParams.get('date') && searchParams.get('startTime')) {
      const d = searchParams.get('date') || todayYmd();
      const t = defaultStartTime(d, searchParams.get('startTime'));
      const area = parseAreaParam(searchParams.get('district'));
      setRegion(area.region);
      setDistrict(area.district);
      runSearch({
        region: area.region,
        district: area.district,
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
            揀日子，即睇全港空場
          </h1>
          <p className="mt-4 text-white/70 text-lg max-w-2xl">
            先揀地區、日期同打幾耐；要改開場時間或場類型再展開。
          </p>

          <form onSubmit={handleSubmit} className="mt-8 lg:mt-10 space-y-3">
            {/* 地區：先港／九／新，再細區 clickbox */}
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPinIcon className="h-4 w-4 text-white/80 shrink-0" />
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">地區</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {HK_REGION_OPTIONS.map((o) => {
                  const active = region === o.value && !district;
                  const regionActive = o.value !== '' && region === o.value;
                  return (
                    <button
                      key={o.value || 'all'}
                      type="button"
                      onClick={() => selectRegion(o.value)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        active || regionActive
                          ? 'bg-pickcourt-gold text-pickcourt-navy-dark'
                          : 'bg-white/90 text-pickcourt-navy hover:bg-white'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {region && regionDistricts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/15">
                  <p className="text-xs text-white/70 mb-2">
                    {region}細區（可選；唔揀＝成個{region}）
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {regionDistricts.map((d) => {
                      const active = district === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => selectDistrict(d)}
                          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                            active
                              ? 'bg-white text-pickcourt-navy ring-2 ring-pickcourt-gold'
                              : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {districtShortLabel(d)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Step A：日期 · 時長 */}
            <div className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col lg:flex-row lg:items-stretch">
              <div className="flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-gray-200 px-4 py-3 lg:py-4">
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

              <div className="flex-1 min-w-[140px] border-b lg:border-b-0 lg:border-r border-gray-200 px-4 py-3 lg:py-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  時長
                </label>
                <div className="mt-2 inline-flex w-full rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setDuration('60')}
                    className={`flex-1 py-2 font-semibold ${
                      duration === '60' ? 'bg-pickcourt-navy text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    1 小時
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuration('120')}
                    className={`flex-1 py-2 font-semibold ${
                      duration === '120' ? 'bg-pickcourt-navy text-white' : 'bg-white text-gray-700'
                    }`}
                  >
                    2 小時
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || timeOptions.length === 0}
                className="flex items-center justify-center gap-2 bg-[#0062E3] hover:bg-[#0050b8] disabled:opacity-70 text-white font-bold text-lg px-8 py-4 lg:py-0 lg:min-w-[140px] transition-colors shrink-0"
              >
                <MagnifyingGlassIcon className="h-6 w-6" />
                {loading ? '搵緊場…' : '搵場'}
              </button>
            </div>

            <p className="mt-3 text-sm text-white/75 flex items-center gap-1.5">
              <ClockIcon className="h-4 w-4 shrink-0" />
              預設開場 {startTime || '—'}
              {timeOptions.length === 0 ? '（今日已無可用時段，請改明日）' : '（可於下方改）'}
            </p>

            {/* Step B：時段 chips + 場類型 */}
            <div className="mt-3 space-y-3">
              {(showMoreFilters || searched) && (
                <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-3">
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                    開始時間
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {timeOptions.length === 0 ? (
                      <span className="text-sm text-white/70">今日已無可用時段</span>
                    ) : (
                      timeOptions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setStartTime(t)}
                          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                            startTime === t
                              ? 'bg-pickcourt-gold text-pickcourt-navy-dark'
                              : 'bg-white/90 text-pickcourt-navy hover:bg-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {!showMoreFilters ? (
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(true)}
                  className="text-sm text-white/80 hover:text-white underline underline-offset-2"
                >
                  改開場時間／場地類型
                </button>
              ) : (
                <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-3">
                  <label className="block text-xs font-semibold text-white/80 uppercase tracking-wide">
                    場地類型
                  </label>
                  <select
                    value={courtType}
                    onChange={(e) => setCourtType(e.target.value)}
                    className="mt-2 w-full max-w-md rounded-lg border-0 text-base font-medium text-gray-900 px-3 py-2"
                  >
                    {COURT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value || 'all'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {courtType && COURT_TYPE_DESCRIPTIONS[courtType] && (
                    <p className="mt-2 text-sm text-white/85">{COURT_TYPE_DESCRIPTIONS[courtType]}</p>
                  )}
                </div>
              )}
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
            <div className="py-8 space-y-4" aria-busy="true" aria-label="搵緊場">
              <p className="text-center text-sm text-gray-500">搵緊場…正查聯盟各店空缺</p>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-36 rounded-xl border border-gray-100 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse"
                />
              ))}
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
                <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <BuildingStorefrontIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-800 font-semibold">呢個時段暫時無空場</p>
                  <p className="text-sm text-gray-500 mt-1">一鍵改條件再搜，或者改去「訂場」睇全日格子</p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-pickcourt-navy hover:border-pickcourt-gold"
                      onClick={() => {
                        const d = new Date(`${date}T12:00:00+08:00`);
                        d.setDate(d.getDate() + 1);
                        const next = hkYmdFromDate(d);
                        setDate(next);
                        setStartTime(defaultStartTime(next));
                        void runSearch({ date: next, startTime: defaultStartTime(next) });
                      }}
                    >
                      改睇明日
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-pickcourt-navy hover:border-pickcourt-gold"
                      onClick={() => {
                        const next = duration === '60' ? '120' : '60';
                        setDuration(next);
                        void runSearch({ duration: next });
                      }}
                    >
                      改為{duration === '60' ? '2' : '1'}小時
                    </button>
                    {areaKey && (
                      <button
                        type="button"
                        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-pickcourt-navy hover:border-pickcourt-gold"
                        onClick={() => {
                          setRegion('');
                          setDistrict('');
                          void runSearch({ region: '', district: '' });
                        }}
                      >
                        改睇全港
                      </button>
                    )}
                    {courtType && (
                      <button
                        type="button"
                        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-pickcourt-navy hover:border-pickcourt-gold"
                        onClick={() => {
                          setCourtType('');
                          void runSearch({ courtType: '' });
                        }}
                      >
                        取消場類型篩選
                      </button>
                    )}
                    {!showMoreFilters && (
                      <button
                        type="button"
                        className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-pickcourt-navy hover:border-pickcourt-gold"
                        onClick={() => setShowMoreFilters(true)}
                      >
                        加場類型篩選
                      </button>
                    )}
                    <Link
                      to="/book"
                      className="rounded-full border border-pickcourt-navy bg-pickcourt-navy px-4 py-2 text-sm font-medium text-white"
                    >
                      改用訂場全日格
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden">
                  {data.available.map((item) => {
                    const cover =
                      resolveMediaUrl(
                        item.store.coverImage || item.court.image || item.store.bannerUrl || item.store.logoUrl
                      ) || '';
                    const logo = resolveMediaUrl(item.store.logoUrl) || '';
                    const listPrice = Number(item.pricing?.totalPrice) || 0;
                    const typeLabel =
                      COURT_TYPE_BADGE_LABEL[item.court.type] ||
                      COURT_TYPE_OPTIONS.find((o) => o.value === item.court.type)?.label ||
                      '';
                    const tags: Array<{ text: string; tone: 'gold' | 'green' | 'amber' }> = [];
                    if (item.store.premium?.badge) {
                      tags.push({ text: item.store.premium.badge, tone: 'gold' });
                    }
                    if (item.store.enableVipDiscount) {
                      tags.push({ text: 'VIP 場租優惠', tone: 'green' });
                    }
                    if (item.pricing?.slotName) {
                      tags.push({ text: item.pricing.slotName, tone: 'amber' });
                    }
                    if (item.store.premium?.headline) {
                      tags.push({ text: item.store.premium.headline, tone: 'gold' });
                    }
                    const tagClass = {
                      gold: 'bg-amber-50 text-amber-800',
                      green: 'bg-emerald-50 text-emerald-800',
                      amber: 'bg-orange-50 text-orange-800',
                    } as const;

                    return (
                      <li key={`${item.court.id}-${item.startTime}`}>
                        <Link
                          to={allianceBookingPath(item, data.query)}
                          className="flex gap-3 p-3 sm:p-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="relative w-[88px] h-[88px] sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-slate-100">
                            {cover ? (
                              <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                <BuildingStorefrontIcon className="h-8 w-8" />
                              </div>
                            )}
                            {logo && (
                              <img
                                src={logo}
                                alt=""
                                className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full object-contain bg-white border border-white shadow-sm"
                              />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-pickcourt-navy text-[15px] sm:text-base line-clamp-1">
                                  {item.store.name}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                                  {item.court.name}
                                  {typeLabel ? ` · ${typeLabel}` : ''}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-base sm:text-lg font-bold text-[#0062E3]">
                                  {listPrice > 0 ? `$${listPrice}` : '—'}
                                </p>
                                <p className="text-[10px] text-slate-400">時段</p>
                              </div>
                            </div>

                            <p className="mt-1.5 text-xs text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>
                                {item.startTime}–{item.endTime}
                              </span>
                              {(item.store.region || item.store.district) && (
                                <span className="inline-flex items-center gap-0.5">
                                  <MapPinIcon className="h-3 w-3" />
                                  {item.store.region || item.store.district}
                                </span>
                              )}
                            </p>

                            {tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t.text}
                                    className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${tagClass[t.tone]}`}
                                  >
                                    {t.text}
                                  </span>
                                ))}
                              </div>
                            )}

                            <span className="mt-auto pt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#0062E3]">
                              立即預約
                              <ArrowRightIcon className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </Link>
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
