import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface CourtUsageRangeStats {
  label: string;
  hours: number;
  averageDailyHours: number;
}

interface CourtUsageMonthStats {
  year: number;
  month: number;
  ranges: {
    night: CourtUsageRangeStats;
    day: CourtUsageRangeStats;
    evening: CourtUsageRangeStats;
  };
}

interface MonthlyUsersStats {
  year: number;
  month: number;
  count: number;
}

interface CouponUsageMonthStats {
  year: number;
  month: number;
  total: number;
  byType: {
    booking: number;
    recharge: number;
  };
}

interface DashboardLive {
  courtsOnline: number;
  courtsOffline: number;
  courtsInUseThisHour: number;
  courtsIdleOnline: number;
  totalCourts: number;
  hourWindow?: { start: string; end: string };
}

interface DashboardKpis {
  todayYmd: string;
  yesterdayYmd: string;
  today: { rentalHours: number; rechargePoints: number; spentPoints: number };
  yesterday: { rentalHours: number; rechargePoints: number; spentPoints: number };
}

interface SeriesRow {
  date: string;
  rentalHours: number;
  rechargePoints: number;
  spentPoints: number;
}

const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const DONUT_COLORS = ['#f97316', '#eab308', '#22c55e'];

function formatNum(n: number, maxFrac = 2) {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(maxFrac);
}

function DeltaTag({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return <span className="text-gray-400 text-xs">與昨日相同</span>;
  const diff = cur - prev;
  const pct = prev !== 0 ? ((diff / prev) * 100).toFixed(1) : '—';
  const up = diff > 0;
  const down = diff < 0;
  return (
    <span className={`text-xs font-medium ${down ? 'text-red-600' : up ? 'text-emerald-600' : 'text-gray-500'}`}>
      {up ? '↑' : down ? '↓' : '—'} {prev === 0 ? '—' : `${pct}%`} vs 昨日
    </span>
  );
}

const AnalyticsDashboard: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courtUsage, setCourtUsage] = useState<CourtUsageMonthStats[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<MonthlyUsersStats[]>([]);
  const [couponUsage, setCouponUsage] = useState<CouponUsageMonthStats[]>([]);

  const [live, setLive] = useState<DashboardLive | null>(null);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesMeta, setSeriesMeta] = useState<{ fromYmd: string; toYmd: string } | null>(null);
  const [seriesDays, setSeriesDays] = useState(7);
  const [dashLoading, setDashLoading] = useState(true);

  const fetchYearData = async (targetYear: number) => {
    setLoading(true);
    setError(null);
    try {
      const [courtRes, usersRes, couponRes] = await Promise.all([
        api.get('/stats/court-usage', { params: { year: targetYear } }),
        api.get('/stats/monthly-users', { params: { year: targetYear } }),
        api.get('/stats/coupon-usage', { params: { year: targetYear } })
      ]);

      setCourtUsage(courtRes.data?.data || []);
      setMonthlyUsers(usersRes.data?.data || []);
      setCouponUsage(couponRes.data?.data || []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('載入分析數據失敗:', err);
      setError(e.message || '載入分析數據失敗');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = useCallback(async (days: number) => {
    setDashLoading(true);
    try {
      const [liveRes, kpiRes, serRes] = await Promise.all([
        api.get('/stats/dashboard-live'),
        api.get('/stats/dashboard-kpis'),
        api.get('/stats/dashboard-series', { params: { days } })
      ]);
      setLive(liveRes.data?.data || null);
      setKpis(kpiRes.data?.data || null);
      const sd = serRes.data?.data;
      setSeries(sd?.series || []);
      setSeriesMeta(sd ? { fromYmd: sd.fromYmd, toYmd: sd.toYmd } : null);
    } catch (err) {
      console.error('儀表板數據載入失敗:', err);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchYearData(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchDashboard(seriesDays);
  }, [seriesDays, fetchDashboard]);

  const handleYearChange = (delta: number) => {
    const newYear = year + delta;
    setYear(newYear);
    void fetchYearData(newYear);
  };

  const getMonthUsers = (m: number) => monthlyUsers.find((u) => u.month === m)?.count || 0;

  const getMonthCouponTotal = (m: number) => couponUsage.find((c) => c.month === m)?.total || 0;

  const getMonthCouponBooking = (m: number) => couponUsage.find((c) => c.month === m)?.byType.booking || 0;

  const getMonthCouponRecharge = (m: number) => couponUsage.find((c) => c.month === m)?.byType.recharge || 0;

  const getMonthRangeHours = (m: number, key: keyof CourtUsageMonthStats['ranges']) => {
    const month = courtUsage.find((c) => c.month === m);
    return month ? month.ranges[key].hours : 0;
  };

  const getMonthRangeAvg = (m: number, key: keyof CourtUsageMonthStats['ranges']) => {
    const month = courtUsage.find((c) => c.month === m);
    return month ? month.ranges[key].averageDailyHours : 0;
  };

  const donutData =
    live && live.totalCourts > 0
      ? [
          { name: '離線', value: live.courtsOffline, key: 'off' },
          { name: '使用中（本小時）', value: live.courtsInUseThisHour, key: 'use' },
          { name: '空閒（在線）', value: live.courtsIdleOnline, key: 'idle' }
        ]
      : [];

  const donutTotal = donutData.reduce((s, x) => s + x.value, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold text-gray-900">數據分析</h2>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleYearChange(-1)}
            className="px-2 py-1 text-sm border rounded-md text-gray-700 hover:bg-gray-50"
          >
            ← {year - 1}
          </button>
          <span className="text-sm font-medium text-gray-900">{year} 年</span>
          <button
            type="button"
            onClick={() => handleYearChange(1)}
            className="px-2 py-1 text-sm border rounded-md text-gray-700 hover:bg-gray-50"
          >
            {year + 1} →
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* —— 即時場地 + 經營概況（PickleVibes 數據） —— */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">營運概覽</h3>
        {dashLoading && !live ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : live && kpis ? (
          <>
            <p className="text-xs text-gray-500">
              場地狀態與本小時預約以<strong>香港時間</strong>計算
              {live.hourWindow ? `（本小時窗：${new Date(live.hourWindow.start).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' })} 起）` : ''}
              ；經營數字以<strong>香港日曆日</strong>結算。
            </p>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-orange-900">在線場地 / 離線場地</p>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-orange-700">{live.courtsOnline}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-2xl font-semibold text-orange-600/80">{live.courtsOffline}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">在線＝可接待；離線＝停用或維護中</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-amber-950">現在使用的場地</p>
                  <p className="mt-2 text-4xl font-bold text-amber-700">{live.courtsInUseThisHour}</p>
                  <p className="mt-2 text-sm text-gray-700">
                    場地總數 <span className="font-semibold text-gray-900">{live.totalCourts}</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-600">本小時內有已確認／已完成預約的在線場地數</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
                  <p className="text-sm font-medium text-emerald-900">空閒（在線）</p>
                  <p className="mt-2 text-4xl font-bold text-emerald-700">{live.courtsIdleOnline}</p>
                  <p className="mt-2 text-xs text-gray-600">在線且本小時無預約的場地</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col items-center justify-center min-h-[220px]">
                <p className="text-sm font-medium text-gray-700 mb-2">場地分布</p>
                {donutTotal > 0 ? (
                  <div className="h-[200px] w-full max-w-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={2}
                        >
                          {donutData.map((entry, i) => (
                            <Cell key={entry.key} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => [v, '數量']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">暫無場地資料</p>
                )}
                <p className="text-center text-lg font-bold text-gray-800 mt-1">
                  {donutTotal} <span className="text-sm font-normal text-gray-500">全部</span>
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-base font-semibold text-gray-900 mb-3">經營概況</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-600">今日總出租小時</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{formatNum(kpis.today.rentalHours)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    昨日 {formatNum(kpis.yesterday.rentalHours)} 小時
                  </p>
                  <div className="mt-2">
                    <DeltaTag cur={kpis.today.rentalHours} prev={kpis.yesterday.rentalHours} />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-600">今日充值積分</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{formatNum(kpis.today.rechargePoints, 0)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    昨日 {formatNum(kpis.yesterday.rechargePoints, 0)} 分
                  </p>
                  <div className="mt-2">
                    <DeltaTag cur={kpis.today.rechargePoints} prev={kpis.yesterday.rechargePoints} />
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-sm text-gray-600">今日消費積分</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{formatNum(kpis.today.spentPoints)}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    昨日 {formatNum(kpis.yesterday.spentPoints)} 分
                  </p>
                  <div className="mt-2">
                    <DeltaTag cur={kpis.today.spentPoints} prev={kpis.yesterday.spentPoints} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <span className="text-sm font-medium text-gray-800">趨勢圖</span>
                <div className="flex flex-wrap gap-2">
                  {([7, 14, 30] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSeriesDays(d)}
                      className={`px-3 py-1 text-xs rounded-full border ${
                        seriesDays === d ? 'bg-primary-600 text-white border-primary-600' : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {d} 日
                    </button>
                  ))}
                </div>
              </div>
              {seriesMeta ? (
                <p className="text-xs text-gray-500 mb-2">
                  範圍：{seriesMeta.fromYmd} — {seriesMeta.toYmd}（香港日）
                </p>
              ) : null}
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="h" orientation="left" tick={{ fontSize: 11 }} width={40} label={{ value: '小時', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 11 }} width={44} label={{ value: '積分', angle: 90, position: 'insideRight', fontSize: 10 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatNum(v, name === 'rentalHours' ? 2 : 2), name === 'rentalHours' ? '出租小時' : name === 'rechargePoints' ? '充值積分' : '消費積分']}
                      labelFormatter={(l) => `日期 ${l}`}
                    />
                    <Legend formatter={(v) => (v === 'rentalHours' ? '總出租小時' : v === 'rechargePoints' ? '充值積分' : '消費積分')} />
                    <Line yAxisId="h" type="monotone" dataKey="rentalHours" stroke="#3b82f6" strokeWidth={2} dot={false} name="rentalHours" />
                    <Line yAxisId="p" type="monotone" dataKey="rechargePoints" stroke="#22c55e" strokeWidth={2} dot={false} name="rechargePoints" />
                    <Line yAxisId="p" type="monotone" dataKey="spentPoints" stroke="#f59e0b" strokeWidth={2} dot={false} name="spentPoints" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">無法載入儀表板數據</p>
        )}
      </section>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {!loading && (
        <>
          <div className="bg-gray-50 rounded-lg p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">每月場地使用時數（分時段）</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100">
                    <th className="px-2 py-2 text-left font-medium text-gray-700">月份</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">00:00-06:00 (小時 / 日均)</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">07:00-15:00 (小時 / 日均)</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">16:00-24:00 (小時 / 日均)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthLabels.map((label, idx) => {
                    const m = idx + 1;
                    return (
                      <tr key={m} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-gray-800">{label}</td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'night').toFixed(1)} /{' '}
                          <span className="text-gray-500">{getMonthRangeAvg(m, 'night').toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'day').toFixed(1)} /{' '}
                          <span className="text-gray-500">{getMonthRangeAvg(m, 'day').toFixed(2)}</span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'evening').toFixed(1)} /{' '}
                          <span className="text-gray-500">{getMonthRangeAvg(m, 'evening').toFixed(2)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              備註：此表顯示每月在三個時段內的總使用小時，以及「每日平均」使用小時（以當月天數計算）。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">每月註冊用戶數</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {monthLabels.map((label, idx) => {
                  const m = idx + 1;
                  return (
                    <div key={m} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{label}</span>
                      <span className="font-medium text-gray-900">{getMonthUsers(m)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">每月優惠券使用次數</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {monthLabels.map((label, idx) => {
                  const m = idx + 1;
                  return (
                    <div key={m} className="flex flex-col text-sm border-b border-gray-100 pb-1 last:border-b-0">
                      <div className="flex justify-between">
                        <span className="text-gray-700">{label}</span>
                        <span className="font-medium text-gray-900">總共：{getMonthCouponTotal(m)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                        <span>預約使用：{getMonthCouponBooking(m)}</span>
                        <span>充值使用：{getMonthCouponRecharge(m)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
