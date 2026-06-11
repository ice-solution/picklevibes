import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentArrowDownIcon,
  CalculatorIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import AccountingLedgerPanel from './AccountingLedgerPanel';
import AccountingPLPanel from './AccountingPLPanel';

type LineType = 'all' | 'recognized' | 'excluded' | 'venue' | 'shop';

interface StoreOption {
  _id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
}

interface StoreBreakdown {
  storeId: string | null;
  store: string;
  count: number;
  excludedCount?: number;
  adminWaivedListPrice?: number;
  nominal: number;
  recognized: number;
}

interface IncomeLine {
  id: string;
  source: 'venue' | 'shop';
  lineType: 'recognized' | 'excluded';
  incomeDate: string;
  category: string;
  description: string;
  storeId: string | null;
  store: string | null;
  court: string | null;
  orderNumber: string | null;
  userName: string;
  userEmail: string;
  paymentMethod: string;
  statusLabel: string;
  nominal: number;
  recognized: number;
  giftExcluded: number;
  paidPointsRatio: number | null;
  excludeReason: string | null;
}

interface FinanceSummary {
  storeId: string | null;
  selectedStore: { id: string; name: string; slug?: string } | null;
  byStoreBreakdown: StoreBreakdown[] | null;
  shopScopeNote?: string;
  totals: { revenueRecognized: number; revenueNominal: number; giftPointsExcluded: number };
  venue: {
    recognizedTotal: number;
    bookingCount: number;
    excludedCount: number;
    adminWaivedListPrice: number;
    byStore?: StoreBreakdown[];
  };
  shop: { recognizedTotal: number; orderCount: number };
  rechargeInPeriod: {
    paidCashInHKD: number;
    manualGiftPoints: number;
    bonusGiftPointsFromOffers: number;
  };
}

function ymdToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('zh-HK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

const TYPE_TABS: { id: LineType; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'recognized', label: '認列收入' },
  { id: 'venue', label: '場地' },
  { id: 'shop', label: '網店' },
  { id: 'excluded', label: '不計收入' }
];

type AccountingMainTab = 'pl' | 'revenue' | 'ledger';

const MAIN_TABS: { id: AccountingMainTab; label: string }[] = [
  { id: 'pl', label: '綜合損益 P&L' },
  { id: 'revenue', label: '系統認列收入' },
  { id: 'ledger', label: '收支登記' },
];

const AccountingManagement: React.FC = () => {
  const [mainTab, setMainTab] = useState<AccountingMainTab>('pl');
  const today = ymdToday();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [fromYmd, setFromYmd] = useState(yearStart);
  const [toYmd, setToYmd] = useState(today);
  const [storeId, setStoreId] = useState('');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [typeTab, setTypeTab] = useState<LineType>('recognized');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [lines, setLines] = useState<IncomeLine[]>([]);

  useEffect(() => {
    api.get('/stores/admin/all').then((r) => setStores(r.data.stores || [])).catch(() => {});
  }, []);

  const storeParams = useMemo(
    () => ({
      from: fromYmd,
      to: toYmd,
      ...(storeId ? { store: storeId } : {})
    }),
    [fromYmd, toYmd, storeId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = typeTab === 'all' ? undefined : typeTab;
      const [summaryRes, linesRes] = await Promise.all([
        api.get('/finance/summary', { params: storeParams }),
        api.get('/finance/income-lines', {
          params: { ...storeParams, ...(typeParam ? { type: typeParam } : {}) }
        })
      ]);
      setSummary(summaryRes.data?.data || null);
      setLines(linesRes.data?.data?.lines || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '載入失敗');
      setSummary(null);
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [storeParams, typeTab]);

  // 僅在「系統認列收入」分頁才打 finance API（避免 P&L 分頁誤觸失敗請求）
  useEffect(() => {
    if (mainTab !== 'revenue') return;
    load();
  }, [load, mainTab]);

  const storeBreakdown = summary?.byStoreBreakdown || summary?.venue?.byStore || [];

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((l) => {
      const blob = [
        l.description,
        l.store,
        l.court,
        l.orderNumber,
        l.userName,
        l.userEmail,
        l.paymentMethod,
        l.category
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [lines, search]);

  const tableFooter = useMemo(() => {
    const rec = filteredLines.filter((l) => l.lineType === 'recognized');
    return {
      count: filteredLines.length,
      nominal: rec.reduce((s, l) => s + l.nominal, 0),
      recognized: rec.reduce((s, l) => s + l.recognized, 0),
      giftExcluded: rec.reduce((s, l) => s + l.giftExcluded, 0)
    };
  }, [filteredLines]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/finance/summary-xlsx', {
        params: storeParams,
        responseType: 'blob'
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const storeName =
        stores.find((s) => s._id === storeId)?.name ||
        summary?.selectedStore?.name ||
        '全部店鋪';
      a.download = `會計收入_${storeName}_${fromYmd}_${toYmd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  const selectedStoreName =
    summary?.selectedStore?.name ||
    stores.find((s) => s._id === storeId)?.name ||
    (storeId ? '—' : '全部店鋪（含網店）');

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CalculatorIcon className="w-7 h-7 text-primary-600" />
          會計
        </h2>
        <p className="text-gray-600 mt-1">
          <strong>綜合損益</strong>合併系統收入與手動收支；另可查看明細分頁。
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {MAIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${
                mainTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {mainTab === 'pl' ? (
        <AccountingPLPanel />
      ) : mainTab === 'ledger' ? (
        <AccountingLedgerPanel />
      ) : (
        <>
      <p className="text-sm text-gray-600">
        場地收入按<strong>店鋪</strong>與<strong>出租日</strong>分開計算；網店為全公司共用，僅在「全部店鋪」時顯示。
      </p>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">店鋪</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="min-w-[220px] px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部店鋪（含網店匯總）</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
                {s.isActive === false ? '（未上線）' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
          <input
            type="date"
            value={fromYmd}
            onChange={(e) => setFromYmd(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
          <input
            type="date"
            value={toYmd}
            onChange={(e) => setToYmd(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">搜尋</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="場地、用戶、訂單號…"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          查詢
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          {exporting ? '匯出中…' : '匯出 XLSX'}
        </button>
      </div>

      <p className="text-sm text-gray-600 flex items-center gap-2">
        <BuildingStorefrontIcon className="w-4 h-4" />
        目前檢視：<span className="font-semibold text-gray-900">{selectedStoreName}</span>
      </p>

      {summary?.shopScopeNote && storeId && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {summary.shopScopeNote}
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500">認列收入（{selectedStoreName}）</p>
            <p className="text-xl font-bold text-primary-700">
              HK$ {fmt(summary.totals.revenueRecognized)}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500">場地（{summary.venue.bookingCount} 筆）</p>
            <p className="text-xl font-bold">HK$ {fmt(summary.venue.recognizedTotal)}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500">
              網店（{summary.shop.orderCount} 筆）{storeId ? '—' : ''}
            </p>
            <p className="text-xl font-bold">
              {storeId ? '—' : `HK$ ${fmt(summary.shop.recognizedTotal)}`}
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs text-amber-800">免扣款不計（{summary.venue.excludedCount} 筆）</p>
            <p className="text-lg font-semibold text-amber-900">
              參考 HK$ {fmt(summary.venue.adminWaivedListPrice)}
            </p>
          </div>
        </div>
      )}

      {!storeId && storeBreakdown.some((r) => r.store === '未指定店鋪' || !r.storeId) && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-900">
          <strong>出現「未指定店鋪」：</strong>多為多店功能上線前的舊預約，資料庫裡
          <code className="mx-1 bg-amber-100 px-1 rounded">booking.store</code>
          尚未填寫。請在伺服器對 production DB 執行一次{' '}
          <code className="bg-amber-100 px-1 rounded">npm run migrate-stores</code>
          （不會清空資料）。報表已會嘗試從場地推斷店鋪；執行遷移後數字會更準確。
        </div>
      )}

      {!storeId && storeBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold flex items-center justify-between">
            <span>各店鋪收入匯總（場地）</span>
            <span className="text-xs font-normal text-gray-500">點擊列可篩選該店明細</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-2">店鋪</th>
                  <th className="px-4 py-2 text-right">認列筆數</th>
                  <th className="px-4 py-2 text-right">免扣款</th>
                  <th className="px-4 py-2 text-right">名目</th>
                  <th className="px-4 py-2 text-right">認列收入</th>
                </tr>
              </thead>
              <tbody>
                {storeBreakdown.map((row) => (
                  <tr
                    key={row.storeId || row.store}
                    className="border-t hover:bg-primary-50 cursor-pointer"
                    onClick={() => row.storeId && setStoreId(row.storeId)}
                  >
                    <td className="px-4 py-2 font-medium">{row.store}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                    <td className="px-4 py-2 text-right text-amber-700">
                      {row.excludedCount ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right">{fmt(row.nominal)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-primary-800">
                      {fmt(row.recognized)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-semibold">
                <tr>
                  <td className="px-4 py-2">場地小計</td>
                  <td className="px-4 py-2 text-right">
                    {storeBreakdown.reduce((s, r) => s + r.count, 0)}
                  </td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right">
                    {fmt(storeBreakdown.reduce((s, r) => s + r.nominal, 0))}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {fmt(storeBreakdown.reduce((s, r) => s + r.recognized, 0))}
                  </td>
                </tr>
                {summary && (
                  <tr className="border-t">
                    <td className="px-4 py-2">＋ 全公司網店</td>
                    <td className="px-4 py-2 text-right">{summary.shop.orderCount}</td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right">—</td>
                    <td className="px-4 py-2 text-right">{fmt(summary.shop.recognizedTotal)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-1">
        {TYPE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTypeTab(t.id)}
            disabled={storeId !== '' && t.id === 'shop'}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors disabled:opacity-40 ${
              typeTab === t.id
                ? 'border-primary-600 text-primary-700 bg-primary-50'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900 flex gap-2">
        <InformationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <span>
          場地收入依店鋪分開；積分認列已扣除派送比例。「全部店鋪」可對照上表各店匯總；選單店後明細僅顯示該店場地預約。
        </span>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto max-h-[min(70vh,720px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 whitespace-nowrap">收入日期</th>
                <th className="px-3 py-2">店鋪</th>
                <th className="px-3 py-2">類別</th>
                <th className="px-3 py-2">摘要</th>
                <th className="px-3 py-2">場地／訂單</th>
                <th className="px-3 py-2">用戶</th>
                <th className="px-3 py-2">付款</th>
                <th className="px-3 py-2 text-right">名目</th>
                <th className="px-3 py-2 text-right">認列</th>
                <th className="px-3 py-2 text-right">扣派送</th>
                <th className="px-3 py-2">備註</th>
              </tr>
            </thead>
            <tbody>
              {loading && filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    載入中…
                  </td>
                </tr>
              ) : filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                    此條件下沒有資料
                  </td>
                </tr>
              ) : (
                filteredLines.map((row) => (
                  <tr
                    key={`${row.source}-${row.id}`}
                    className={`border-t hover:bg-gray-50 ${
                      row.lineType === 'excluded' ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{row.incomeDate}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.store || '—'}</td>
                    <td className="px-3 py-2">{row.category}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate" title={row.description}>
                      {row.description}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.court && <div>{row.court}</div>}
                      {row.orderNumber && <div>{row.orderNumber}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.userName || '—'}</div>
                      {row.userEmail && (
                        <div className="text-xs text-gray-400 truncate max-w-[120px]">
                          {row.userEmail}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.paymentMethod}</td>
                    <td className="px-3 py-2 text-right">{fmt(row.nominal)}</td>
                    <td className="px-3 py-2 text-right font-medium text-primary-800">
                      {row.lineType === 'recognized' ? fmt(row.recognized) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {row.giftExcluded > 0 ? fmt(row.giftExcluded) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px]">
                      {row.excludeReason ||
                        (row.paidPointsRatio != null && row.paymentMethod === '積分'
                          ? `有價 ${(row.paidPointsRatio * 100).toFixed(0)}%`
                          : '')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredLines.length > 0 && (
              <tfoot className="bg-gray-100 font-semibold text-sm sticky bottom-0">
                <tr>
                  <td colSpan={7} className="px-3 py-3">
                    小計（{tableFooter.count} 筆）
                  </td>
                  <td className="px-3 py-3 text-right">{fmt(tableFooter.nominal)}</td>
                  <td className="px-3 py-3 text-right text-primary-800">
                    {fmt(tableFooter.recognized)}
                  </td>
                  <td className="px-3 py-3 text-right">{fmt(tableFooter.giftExcluded)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
        </>
      )}
    </motion.div>
  );
};

export default AccountingManagement;
