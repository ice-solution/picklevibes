import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface RechargeRecord {
  _id: string;
  points: number;
  amount: number;
  status: string;
  description?: string;
  createdAt: string;
  payment?: {
    method?: string;
    paidAt?: string;
    status?: string;
  };
  user?: { name?: string; email?: string; phone?: string };
  store?: { name?: string };
  court?: { name?: string };
  rechargeOffer?: { name?: string };
  redeemCode?: { code?: string };
  adjustedBy?: { name?: string };
}

interface PeriodSummary {
  count: number;
  totalPoints: number;
  totalAmountHKD: number;
  paidCashHKD: number;
  manualGiftPoints: number;
  bonusGiftPointsFromOffers: number;
  byMethod: Array<{ method: string; count: number; points: number; amount: number }>;
}

interface Pagination {
  current: number;
  pages: number;
  total: number;
  limit: number;
}

function defaultFromYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function defaultToYmd() {
  return new Date().toISOString().slice(0, 10);
}

function methodLabel(method?: string) {
  if (method === 'stripe') return 'Stripe';
  if (method === 'wonder') return 'Wonder';
  if (method === 'manual') return '手動';
  if (method === 'alipay') return '支付寶';
  if (method === 'wechat') return '微信';
  return method || '—';
}

function statusLabel(status: string) {
  if (status === 'completed') return '已完成';
  if (status === 'pending') return '待付款';
  if (status === 'failed') return '失敗';
  if (status === 'cancelled') return '已取消';
  return status;
}

function fmtPaidAt(record: RechargeRecord) {
  const raw = record.payment?.paidAt || record.createdAt;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong' });
}

const RechargePeriodPanel: React.FC = () => {
  const [fromYmd, setFromYmd] = useState(defaultFromYmd);
  const [toYmd, setToYmd] = useState(defaultToYmd);
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('completed');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [storeScopeNote, setStoreScopeNote] = useState<string | null>(null);

  const fetchReport = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        from: fromYmd,
        to: toYmd,
        page: targetPage,
        limit: 50,
        status,
      };
      if (method) params.method = method;

      const res = await axios.get('/recharge/admin/period-report', { params });
      setSummary(res.data.summary || null);
      setRecords(res.data.records || []);
      setPagination(res.data.pagination || null);
      setPage(targetPage);

      if (res.data.storeScope?.storeIds?.length) {
        setStoreScopeNote('目前僅顯示歸屬所選店鋪範圍的充值（主要為手動充值）；線上平台充值可能不含店鋪欄位。');
      } else {
        setStoreScopeNote(null);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || '載入失敗');
      setSummary(null);
      setRecords([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [fromYmd, toYmd, method, status]);

  useEffect(() => {
    void fetchReport(1);
  }, [fetchReport]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { from: fromYmd, to: toYmd, status };
      if (method) params.method = method;
      const res = await axios.get('/recharge/admin/period-report/export', {
        params,
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `期間充值_${fromYmd}_${toYmd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      alert(e.response?.data?.message || e.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">期間充值記錄</h3>
        <p className="text-sm text-gray-600 mt-1">
          以<strong>付款完成日</strong>（payment.paidAt，香港時間）為準；預設只顯示已完成充值，與會計 period 統計一致。
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">開始日期</label>
          <input
            type="date"
            value={fromYmd}
            onChange={(e) => setFromYmd(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">結束日期</label>
          <input
            type="date"
            value={toYmd}
            onChange={(e) => setToYmd(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">付款方式</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            <option value="stripe">Stripe</option>
            <option value="wonder">Wonder</option>
            <option value="manual">手動</option>
            <option value="alipay">支付寶</option>
            <option value="wechat">微信</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">狀態</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="completed">已完成</option>
            <option value="all">全部狀態</option>
            <option value="pending">待付款</option>
            <option value="failed">失敗</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void fetchReport(1)}
          disabled={loading}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? '查詢中…' : '查詢'}
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || loading}
          className="inline-flex items-center px-4 py-2 border border-emerald-300 text-emerald-800 text-sm rounded-md hover:bg-emerald-50 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
          {exporting ? '匯出中…' : '匯出 XLSX'}
        </button>
      </div>

      {storeScopeNote && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {storeScopeNote}
        </p>
      )}

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">筆數</p>
            <p className="text-xl font-bold text-gray-900">{summary.count}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">總積分</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalPoints.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">總金額 HK$</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalAmountHKD.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">付費充值 HK$</p>
            <p className="text-xl font-bold text-emerald-700">{summary.paidCashHKD.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">手動派送積分</p>
            <p className="text-xl font-bold text-amber-700">{summary.manualGiftPoints.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <p className="text-xs text-gray-500">贈送積分</p>
            <p className="text-xl font-bold text-indigo-700">
              {summary.bonusGiftPointsFromOffers.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {summary && summary.byMethod.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {summary.byMethod.map((row) => (
            <span
              key={row.method}
              className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-700"
            >
              {methodLabel(row.method)}：{row.count} 筆 · {row.points} 分
              {row.amount > 0 ? ` · HK$${row.amount}` : ''}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用戶</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">積分</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方式</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    載入中…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    此期間沒有充值記錄
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtPaidAt(r)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.user?.name || '—'}</div>
                      <div className="text-xs text-gray-500">{r.user?.email || r.user?.phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{r.points}</td>
                    <td className="px-4 py-3 text-right">HK${Number(r.amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{methodLabel(r.payment?.method)}</td>
                    <td className="px-4 py-3">{statusLabel(r.status)}</td>
                    <td className="px-4 py-3 text-gray-600">{r.store?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={r.description}>
                      {r.rechargeOffer?.name || r.redeemCode?.code || r.description || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
            <span className="text-gray-600">
              共 {pagination.total} 筆 · 第 {pagination.current} / {pagination.pages} 頁
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void fetchReport(page - 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-50"
              >
                上一頁
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages || loading}
                onClick={() => void fetchReport(page + 1)}
                className="px-3 py-1 border rounded-md disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RechargePeriodPanel;
