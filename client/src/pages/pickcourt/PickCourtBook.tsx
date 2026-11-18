import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapPinIcon } from '@heroicons/react/24/outline';
import apiConfig from '../../config/api';
import PickleCourtNav from '../../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../../components/PickleCourt/PickleCourtFooter';
import SEO from '../../components/SEO/SEO';
import { COURT_TYPE_BADGE_LABEL } from '../../constants/hkDistricts';
import { suggestCourtSlug } from '../../constants/courtSlug';
import { PICKCOURT_HOME } from '../../utils/pickcourtRoutes';

type AllianceStore = {
  id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  logoUrl?: string | null;
};

type StoreCourt = {
  id: string;
  name: string;
  slug: string;
  number: number;
  type: string;
};

type SlotCell = {
  startTime: string;
  endTime: string;
  available: boolean;
  price?: number;
  reason?: string;
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08–21

function hkYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addMinutes(start: string, minutes: number) {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const eh = Math.floor(total / 60);
  const em = total % 60;
  if (eh > 24 || (eh === 24 && em > 0)) return null;
  if (eh === 24) return '24:00';
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function hhmm(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`;
}

const PickCourtBook: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState<AllianceStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState('');
  const storeSlug = searchParams.get('store') || '';
  const [date, setDate] = useState(searchParams.get('date') || hkYmd());
  const [duration, setDuration] = useState(searchParams.get('duration') || '60');
  const [courts, setCourts] = useState<StoreCourt[]>([]);
  const [grid, setGrid] = useState<Record<string, SlotCell[]>>({});
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState('');

  const selectedStore = useMemo(
    () => stores.find((s) => s.slug === storeSlug) || null,
    [stores, storeSlug]
  );

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    setStoresLoading(true);
    setStoresError('');
    fetch(`${base}/platform/alliance/stores`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || '載入場地失敗');
        setStores(j.stores || []);
      })
      .catch((e) => {
        setStores([]);
        setStoresError(e instanceof Error ? e.message : '載入場地失敗');
      })
      .finally(() => setStoresLoading(false));
  }, []);

  useEffect(() => {
    if (!storeSlug && stores.length > 0) {
      const next = new URLSearchParams(searchParams);
      next.set('store', stores[0].slug);
      if (!next.get('date')) next.set('date', date);
      if (!next.get('duration')) next.set('duration', duration);
      setSearchParams(next, { replace: true });
    }
  }, [stores, storeSlug, searchParams, setSearchParams, date, duration]);

  const loadGrid = useCallback(async () => {
    if (!storeSlug) return;
    setGridLoading(true);
    setGridError('');
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    const dur = Number(duration) || 60;
    try {
      const storeRes = await fetch(`${base}/platform/stores/${encodeURIComponent(storeSlug)}`);
      const storeJson = await storeRes.json();
      if (!storeRes.ok) throw new Error(storeJson.message || '找不到場地');
      const courtList: StoreCourt[] = (storeJson.store?.courts || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug || suggestCourtSlug(c.type, c.number),
        number: c.number,
        type: c.type,
      }));
      setCourts(courtList);

      const hourSlots = HOURS.map((h) => {
        const startTime = hhmm(h);
        const endTime = addMinutes(startTime, dur);
        return { startTime, endTime, valid: Boolean(endTime) };
      });
      const requestSlots = hourSlots
        .filter((s) => s.valid && s.endTime)
        .map((s) => ({ startTime: s.startTime, endTime: s.endTime as string }));

      const nextGrid: Record<string, SlotCell[]> = {};
      await Promise.all(
        courtList.map(async (court) => {
          try {
            const res = await fetch(`${base}/courts/${court.id}/availability/batch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date, timeSlots: requestSlots }),
            });
            const json = await res.json();
            const rows = Array.isArray(json.timeSlots) ? json.timeSlots : [];
            const byStart = new Map(
              rows.map((row: SlotCell & { pricing?: { totalPrice?: number }; totalPrice?: number }) => [
                row.startTime,
                row,
              ])
            );
            nextGrid[court.id] = hourSlots.map((s) => {
              if (!s.valid || !s.endTime) {
                return {
                  startTime: s.startTime,
                  endTime: s.startTime,
                  available: false,
                  reason: '超出可訂時段',
                };
              }
              const row = byStart.get(s.startTime) as
                | (SlotCell & { pricing?: { totalPrice?: number }; totalPrice?: number })
                | undefined;
              return {
                startTime: s.startTime,
                endTime: s.endTime,
                available: Boolean(row?.available),
                price: row?.pricing?.totalPrice ?? row?.totalPrice ?? row?.price,
                reason: row?.reason,
              };
            });
          } catch {
            nextGrid[court.id] = hourSlots.map((s) => ({
              startTime: s.startTime,
              endTime: s.endTime || s.startTime,
              available: false,
              reason: '查詢失敗',
            }));
          }
        })
      );
      setGrid(nextGrid);
    } catch (e) {
      setCourts([]);
      setGrid({});
      setGridError(e instanceof Error ? e.message : '載入時段失敗');
    } finally {
      setGridLoading(false);
    }
  }, [storeSlug, date, duration]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  const setStore = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('store', slug);
    next.set('date', date);
    next.set('duration', duration);
    setSearchParams(next);
  };

  const setDateParam = (d: string) => {
    setDate(d);
    const next = new URLSearchParams(searchParams);
    next.set('date', d);
    setSearchParams(next);
  };

  const setDurationParam = (d: string) => {
    setDuration(d);
    const next = new URLSearchParams(searchParams);
    next.set('duration', d);
    setSearchParams(next);
  };

  const tomorrow = () => {
    const d = new Date(`${date}T12:00:00+08:00`);
    d.setDate(d.getDate() + 1);
    setDateParam(hkYmd(d));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0">
      <SEO title="訂場 | PickCourt" description="揀場地、睇當日可訂時段" url="/book" />
      <PickleCourtNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-28 pb-10">
        <h1 className="text-2xl font-bold text-pickcourt-navy mb-4">訂場</h1>

        {storesLoading && (
          <p className="text-sm text-gray-500 py-8 text-center">搵緊聯盟場地…</p>
        )}
        {storesError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {storesError}
            <button type="button" className="ml-3 underline" onClick={() => window.location.reload()}>
              再試
            </button>
          </div>
        )}
        {!storesLoading && !storesError && stores.length === 0 && (
          <p className="text-center text-gray-500 py-12">暫時未有上架場地</p>
        )}

        {stores.length > 0 && (
          <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6">
            {/* 店列表 */}
            <div className="mb-4 lg:mb-0">
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-1 px-1">
                {stores.map((s) => {
                  const active = s.slug === storeSlug;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStore(s.slug)}
                      className={`shrink-0 rounded-full lg:rounded-xl px-4 py-2.5 text-sm font-semibold border transition-colors text-left ${
                        active
                          ? 'bg-pickcourt-navy text-white border-pickcourt-navy'
                          : 'bg-white text-pickcourt-navy border-gray-200 hover:border-pickcourt-gold'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {selectedStore && (
                <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-lg text-pickcourt-navy">{selectedStore.name}</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPinIcon className="h-4 w-4" />
                      {selectedStore.district ? `${selectedStore.district} · ` : ''}
                      {selectedStore.address}
                    </p>
                    <Link
                      to={`/store/${selectedStore.slug}`}
                      className="text-xs text-[#0062E3] hover:underline mt-1 inline-block"
                    >
                      場地詳情
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <label className="text-xs text-gray-500">
                      日期
                      <input
                        type="date"
                        value={date}
                        min={hkYmd()}
                        onChange={(e) => setDateParam(e.target.value)}
                        className="ml-2 border rounded-lg px-2 py-1.5 text-sm"
                      />
                    </label>
                    <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setDurationParam('60')}
                        className={`px-3 py-1.5 ${duration === '60' ? 'bg-pickcourt-navy text-white' : 'bg-white'}`}
                      >
                        1 小時
                      </button>
                      <button
                        type="button"
                        onClick={() => setDurationParam('120')}
                        className={`px-3 py-1.5 ${duration === '120' ? 'bg-pickcourt-navy text-white' : 'bg-white'}`}
                      >
                        2 小時
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!storeSlug && (
                <p className="p-8 text-center text-gray-500">請先揀一間場地</p>
              )}

              {gridLoading && (
                <div className="p-4 space-y-2" aria-busy="true" aria-label="載入可訂時段">
                  <p className="text-center text-sm text-gray-500 py-2">載入可訂時段…</p>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 animate-pulse"
                    />
                  ))}
                </div>
              )}

              {gridError && !gridLoading && (
                <div className="p-6 text-sm text-red-700">
                  {gridError}
                  <button type="button" className="ml-2 underline" onClick={() => void loadGrid()}>
                    再試
                  </button>
                </div>
              )}

              {!gridLoading && !gridError && storeSlug && courts.length === 0 && (
                <p className="p-8 text-center text-gray-500">此店暫時未有可預約場地</p>
              )}

              {!gridLoading && !gridError && courts.length > 0 && (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-gray-600 border-b">
                            場地
                          </th>
                          {HOURS.map((h) => (
                            <th
                              key={h}
                              className="px-1 py-2 text-center font-medium text-gray-500 border-b min-w-[3.25rem]"
                            >
                              {hhmm(h)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {courts.map((court) => (
                          <tr key={court.id} className="border-b border-gray-100">
                            <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-pickcourt-navy whitespace-nowrap">
                              {court.name}
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {COURT_TYPE_BADGE_LABEL[court.type] || court.type}
                              </span>
                            </td>
                            {(grid[court.id] || []).map((cell) => {
                              if (!cell) {
                                return (
                                  <td key={`${court.id}-x`} className="p-1">
                                    <div className="h-9 rounded bg-gray-100" />
                                  </td>
                                );
                              }
                              if (!cell.available) {
                                return (
                                  <td key={`${court.id}-${cell.startTime}`} className="p-1">
                                    <div
                                      className="h-9 rounded bg-gray-100 text-gray-400 flex items-center justify-center text-[10px]"
                                      title={cell.reason || '已滿'}
                                    >
                                      已滿
                                    </div>
                                  </td>
                                );
                              }
                              const bookTo = `/booking/${storeSlug}/${court.slug}/${date}?startTime=${encodeURIComponent(cell.startTime)}&duration=${duration}&courtId=${court.id}#time`;
                              return (
                                <td key={`${court.id}-${cell.startTime}`} className="p-1">
                                  <Link
                                    to={bookTo}
                                    className="h-9 rounded border border-pickcourt-gold/50 bg-pickcourt-gold/15 text-pickcourt-navy flex flex-col items-center justify-center hover:bg-pickcourt-gold/30 transition-colors"
                                    title="可預約"
                                  >
                                    <span className="text-[10px] font-semibold">有位</span>
                                    {cell.price != null && (
                                      <span className="text-[9px] text-gray-600">${cell.price}</span>
                                    )}
                                  </Link>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 border-t">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded border border-pickcourt-gold/50 bg-pickcourt-gold/15" />
                      可預約
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded bg-gray-100" />
                      已滿
                    </span>
                    {Object.values(grid).every((rows) => rows.every((c) => !c.available)) && (
                      <button type="button" onClick={tomorrow} className="text-[#0062E3] underline ml-auto">
                        呢日全部已滿 · 改睇明日
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-500">
          想跨店搜尋？
          <Link to={PICKCOURT_HOME} className="text-pickcourt-navy font-medium underline ml-1">
            返回首頁搵場
          </Link>
        </p>
      </div>

      <div className="hidden lg:block">
        <PickleCourtFooter />
      </div>
    </div>
  );
};

export default PickCourtBook;
