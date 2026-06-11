import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  ChartBarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import api, { ACCOUNTING_REPORT_TIMEOUT_MS } from '../../services/api';

interface StoreOption {
  _id: string;
  name: string;
  isActive?: boolean;
}

interface CategoryRow {
  category: string;
  amount: number;
  count: number;
}

interface StoreBreakdownRow {
  storeId: string | null;
  storeName: string;
  systemVenueRevenue?: number;
  systemShopRevenue?: number;
  manualIncome?: number;
  manualExpense?: number;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  bookingCount?: number;
  orderCount?: number;
}

interface PLData {
  period: { fromYmd: string; toYmd: string };
  storeId: string | null;
  selectedStore: { id: string; name: string } | null;
  shopScopeNote?: string;
  revenue: {
    systemVenue: number;
    systemShop: number;
    systemTotal: number;
    manualByCategory: CategoryRow[];
    manualTotal: number;
    total: number;
  };
  expenses: {
    manualByCategory: CategoryRow[];
    total: number;
  };
  netProfit: number;
  storeBreakdown: StoreBreakdownRow[] | null;
  notes: string[];
  systemDetail?: {
    venue?: { bookingCount?: number; excludedCount?: number };
    shop?: { orderCount?: number };
    rechargeInPeriod?: { paidCashInHKD?: number };
    giftPointsExcluded?: number;
  };
}

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('zh-HK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function ymdToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function monthStartYmd(): string {
  const today = ymdToday();
  return `${today.slice(0, 7)}-01`;
}

function PLRow({
  label,
  amount,
  bold,
  indent,
  negative,
  highlight,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  const display = negative && amount > 0 ? `(${fmt(amount)})` : fmt(amount);
  return (
    <div
      className={`flex justify-between items-center py-2 border-b border-gray-100 ${
        bold ? 'font-semibold text-gray-900' : 'text-gray-700'
      } ${indent ? 'pl-4' : ''} ${highlight ? 'bg-primary-50 -mx-4 px-4 rounded-lg border-0 mt-2' : ''}`}
    >
      <span>{label}</span>
      <span className={`tabular-nums ${negative ? 'text-red-600' : bold ? 'text-gray-900' : ''}`}>
        {negative && amount > 0 ? '-' : ''}HK$ {display}
      </span>
    </div>
  );
}

const AccountingPLPanel: React.FC = () => {
  const today = ymdToday();

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [fromYmd, setFromYmd] = useState(monthStartYmd);
  const [toYmd, setToYmd] = useState(today);
  const [storeId, setStoreId] = useState('');
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/stores/admin/all').then((r) => setStores(r.data.stores || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/pl', {
        params: {
          from: fromYmd,
          to: toYmd,
          ...(storeId ? { store: storeId } : {}),
        },
        timeout: ACCOUNTING_REPORT_TIMEOUT_MS,
      });
      setData(res.data.data || null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '載入損益表失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromYmd, toYmd, storeId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedStoreName =
    data?.selectedStore?.name ||
    stores.find((s) => s._id === storeId)?.name ||
    (storeId ? '—' : '全部店鋪');

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-900 flex gap-2">
        <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>綜合損益（P&amp;L）</strong>合併系統認列收入與手動收支登記。
          {data?.notes?.map((n) => (
            <p key={n} className="mt-1 text-blue-800">{n}</p>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">店鋪</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="min-w-[220px] px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部店鋪（含網店）</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
          <input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} className="px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
          <input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} className="px-3 py-2 border rounded-lg" />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </button>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500 mb-1">總收入</p>
              <p className="text-3xl font-bold text-green-700">HK$ {fmt(data.revenue.total)}</p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500 mb-1">總支出</p>
              <p className="text-3xl font-bold text-red-600">HK$ {fmt(data.expenses.total)}</p>
            </div>
            <div className={`rounded-xl border p-5 ${data.netProfit >= 0 ? 'bg-gray-900 text-white' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm mb-1 ${data.netProfit >= 0 ? 'text-gray-300' : 'text-red-600'}`}>淨利潤</p>
              <p className={`text-3xl font-bold ${data.netProfit >= 0 ? 'text-white' : 'text-red-700'}`}>
                HK$ {fmt(data.netProfit)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 收入明細 */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-green-600" />
                收入
              </h3>
              <PLRow label="場地認列收入（系統）" amount={data.revenue.systemVenue} indent />
              {data.revenue.systemShop > 0 && (
                <PLRow label="網店認列收入（系統）" amount={data.revenue.systemShop} indent />
              )}
              <PLRow label="系統收入小計" amount={data.revenue.systemTotal} bold />
              {data.revenue.manualByCategory.map((row) => (
                <PLRow
                  key={`inc-${row.category}`}
                  label={`${row.category}（手動 · ${row.count} 筆）`}
                  amount={row.amount}
                  indent
                />
              ))}
              {data.revenue.manualTotal > 0 && (
                <PLRow label="手動收入小計" amount={data.revenue.manualTotal} bold />
              )}
              <PLRow label="總收入" amount={data.revenue.total} bold highlight />
            </div>

            {/* 支出明細 */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-red-600" />
                支出
              </h3>
              {data.expenses.manualByCategory.length === 0 ? (
                <p className="text-gray-500 text-sm py-4">此期間尚無手動支出登記</p>
              ) : (
                data.expenses.manualByCategory.map((row) => (
                  <PLRow
                    key={`exp-${row.category}`}
                    label={`${row.category}（${row.count} 筆）`}
                    amount={row.amount}
                    indent
                    negative
                  />
                ))
              )}
              <PLRow label="總支出" amount={data.expenses.total} bold negative highlight />
            </div>
          </div>

          {/* 淨利 */}
          <div className="bg-white rounded-xl border-2 border-gray-900 p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">
                  {selectedStoreName} · {data.period.fromYmd} 至 {data.period.toYmd}
                </p>
                <p className="text-xl font-bold text-gray-900 mt-1">淨利潤（總收入 − 總支出）</p>
              </div>
              <p className={`text-3xl font-bold tabular-nums ${data.netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                HK$ {fmt(data.netProfit)}
              </p>
            </div>
          </div>

          {/* 按店鋪 */}
          {data.storeBreakdown && data.storeBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">按店鋪損益</h3>
                {data.shopScopeNote && (
                  <p className="text-xs text-gray-500 mt-1">{data.shopScopeNote}</p>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3">店鋪</th>
                      <th className="px-4 py-3 text-right">系統場地收入</th>
                      <th className="px-4 py-3 text-right">手動收入</th>
                      <th className="px-4 py-3 text-right">手動支出</th>
                      <th className="px-4 py-3 text-right">總收入</th>
                      <th className="px-4 py-3 text-right">淨利</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.storeBreakdown.map((row) => (
                      <tr key={row.storeId || 'shop'} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{row.storeName}</td>
                        <td className="px-4 py-3 text-right text-green-700">
                          {fmt((row.systemVenueRevenue || 0) + (row.systemShopRevenue || 0))}
                        </td>
                        <td className="px-4 py-3 text-right">{fmt(row.manualIncome || 0)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{fmt(row.manualExpense || 0)}</td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(row.totalRevenue)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {fmt(row.netProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 參考數據 */}
          {data.systemDetail && (
            <div className="bg-gray-50 rounded-xl border p-4 text-xs text-gray-600 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>場地預約：{data.systemDetail.venue?.bookingCount ?? 0} 筆</div>
              <div>網店訂單：{data.systemDetail.shop?.orderCount ?? 0} 筆</div>
              <div>期間付費充值：HK$ {fmt(data.systemDetail.rechargeInPeriod?.paidCashInHKD || 0)}</div>
              <div>排除派送積分：{fmt(data.systemDetail.giftPointsExcluded || 0)}</div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default AccountingPLPanel;
