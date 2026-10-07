import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type PlanType = 'reclub_unlimited' | 'off_peak';

type HistoryItem = {
  at: string;
  source: 'payment' | 'admin';
  amount?: number;
  method?: string;
  planType: PlanType;
  planName?: string;
  note?: string;
  adjustedByName?: string;
  paymentId?: string;
  refunded?: boolean;
};

type PlanBucket = {
  paymentCount: number;
  adminCount: number;
  purchaseCount: number;
  expiresAt: string | null;
  isActive: boolean;
  planName?: string;
  history: HistoryItem[];
};

type HolderRow = {
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  plans: {
    reclub_unlimited: PlanBucket;
    off_peak: PlanBucket;
  };
  totalPurchases: number;
  anyActive: boolean;
};

function errMsg(e: unknown) {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || '載入失敗'
  );
}

function formatDateTime(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function methodLabel(m?: string) {
  if (m === 'stripe') return 'Stripe';
  if (m === 'wonder') return 'Wonder';
  if (m === 'points') return '積分';
  return m || '—';
}

function StatusCell({ bucket }: { bucket: PlanBucket }) {
  if (!bucket.expiresAt) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <div className="space-y-0.5">
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
          bucket.isActive
            ? 'bg-teal-50 text-teal-800'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {bucket.isActive ? '有效' : '已過期'}
      </span>
      <p className="text-xs text-gray-500">{formatDateTime(bucket.expiresAt)}</p>
    </div>
  );
}

function CountCell({ bucket }: { bucket: PlanBucket }) {
  if (bucket.purchaseCount === 0) {
    return <span className="text-gray-400">0</span>;
  }
  return (
    <div>
      <span className="font-semibold text-gray-900">{bucket.purchaseCount}</span>
      <p className="text-[11px] text-gray-500">
        付款 {bucket.paymentCount}
        {bucket.adminCount > 0 ? ` · 管理員 ${bucket.adminCount}` : ''}
      </p>
    </div>
  );
}

const MonthlyPassHolders: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [holders, setHolders] = useState<HolderRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired'>(
    'all'
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/monthly-pass-plans/holders');
      setHolders(res.data.holders || []);
    } catch (e) {
      alert(errMsg(e));
      setHolders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return holders.filter((h) => {
      if (statusFilter === 'active' && !h.anyActive) return false;
      if (statusFilter === 'expired' && h.anyActive) return false;
      if (!needle) return true;
      const blob = `${h.user.name} ${h.user.email} ${h.user.phone || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [holders, q, statusFilter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">月卡持卡人</h2>
          <p className="text-sm text-gray-500 mt-1">
            列出曾透過付款連結購買或管理員發放月卡嘅用戶；次數按計劃分欄，可展開睇每次紀錄。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowPathIcon className="h-4 w-4" />
          重新整理
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋姓名／電郵／電話"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'all' | 'active' | 'expired')
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">全部狀態</option>
          <option value="active">有有效月卡</option>
          <option value="expired">全部已過期</option>
        </select>
        <span className="text-sm text-gray-500">
          {filtered.length}／{holders.length} 人
        </span>
      </div>

      {loading ? (
        <p className="py-10 text-center text-gray-500">載入中…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-gray-500">暫無持卡人紀錄</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    用戶
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    任打次數
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    任打狀態／到期
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    非繁忙次數
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600">
                    非繁忙狀態／到期
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((h) => {
                  const open = expanded.has(h.user._id);
                  const history = [
                    ...h.plans.reclub_unlimited.history,
                    ...h.plans.off_peak.history,
                  ].sort(
                    (a, b) =>
                      new Date(b.at).getTime() - new Date(a.at).getTime()
                  );
                  return (
                    <React.Fragment key={h.user._id}>
                      <tr className="hover:bg-gray-50/80">
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() => toggle(h.user._id)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100"
                            title={open ? '收合紀錄' : '展開購買紀錄'}
                          >
                            {open ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {h.user.name || '—'}
                          </p>
                          <p className="text-xs text-gray-500">{h.user.email}</p>
                          {h.user.phone ? (
                            <p className="text-xs text-gray-400">{h.user.phone}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <CountCell bucket={h.plans.reclub_unlimited} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusCell bucket={h.plans.reclub_unlimited} />
                        </td>
                        <td className="px-4 py-3">
                          <CountCell bucket={h.plans.off_peak} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusCell bucket={h.plans.off_peak} />
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={6} className="px-6 py-3">
                            {history.length === 0 ? (
                              <p className="text-xs text-gray-500">無明細紀錄</p>
                            ) : (
                              <ul className="space-y-2">
                                {history.map((item, idx) => (
                                  <li
                                    key={`${item.source}-${item.at}-${idx}`}
                                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-gray-700"
                                  >
                                    <span className="font-medium text-gray-900">
                                      {formatDateTime(item.at)}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.5 ${
                                        item.source === 'payment'
                                          ? 'bg-indigo-50 text-indigo-800'
                                          : 'bg-amber-50 text-amber-800'
                                      }`}
                                    >
                                      {item.source === 'payment'
                                        ? '付款購買'
                                        : '管理員'}
                                    </span>
                                    <span>
                                      {item.planType === 'reclub_unlimited'
                                        ? '任打 Reclub'
                                        : '非繁忙時間'}
                                    </span>
                                    {item.source === 'payment' && (
                                      <>
                                        <span>
                                          {methodLabel(item.method)}
                                          {item.amount != null
                                            ? ` · $${item.amount}`
                                            : ''}
                                        </span>
                                        {item.refunded ? (
                                          <span className="text-red-600">
                                            已退款
                                          </span>
                                        ) : null}
                                      </>
                                    )}
                                    {item.source === 'admin' && item.adjustedByName ? (
                                      <span>由 {item.adjustedByName}</span>
                                    ) : null}
                                    {item.note ? (
                                      <span className="text-gray-500">
                                        {item.note}
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="mt-2 text-[11px] text-gray-400">
                              管理員發放／延長若多次，系統只保留最新一次調整時間（無完整審計日誌）。
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPassHolders;
