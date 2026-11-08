import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { CreditCardIcon } from '@heroicons/react/24/outline';

type RechargeRow = {
  _id: string;
  points: number;
  amount: number;
  status: string;
  createdAt: string;
  user?: { name?: string; email?: string };
  store?: { name?: string; slug?: string; branding?: { displayName?: string } } | null;
  payment?: { method?: string; paidAt?: string; status?: string };
};

const RechargeRecordsManagement: React.FC = () => {
  const [rows, setRows] = useState<RechargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('completed');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/recharge/admin/records', {
        params: { page, limit: 30, status: status || undefined, q: q.trim() || undefined },
      });
      setRows(res.data?.recharges || []);
      setPages(res.data?.pagination?.pages || 1);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CreditCardIcon className="w-6 h-6 text-violet-600" />
          充值紀錄
        </h2>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="completed">已完成</option>
          <option value="pending">待付款</option>
          <option value="">全部狀態</option>
        </select>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              load();
            }
          }}
          placeholder="搜尋電郵／姓名…"
          className="border rounded-lg px-3 py-1.5 text-sm min-w-[200px]"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            load();
          }}
          className="text-sm text-violet-700 hover:underline"
        >
          搜尋
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm">載入中…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">暫無紀錄</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">時間</th>
                <th className="px-4 py-3">用戶</th>
                <th className="px-4 py-3">店鋪／平台</th>
                <th className="px-4 py-3 text-right">積分</th>
                <th className="px-4 py-3 text-right">金額</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {new Date(r.payment?.paidAt || r.createdAt).toLocaleString('zh-HK')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.user?.name || '—'}</div>
                    <div className="text-xs text-gray-500">{r.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {r.store
                      ? r.store.branding?.displayName || r.store.name || r.store.slug
                      : 'PickCourt 平台'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{r.points}</td>
                  <td className="px-4 py-3 text-right tabular-nums">HK${r.amount}</td>
                  <td className="px-4 py-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="px-3 py-1.5 text-gray-600">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
};

export default RechargeRecordsManagement;
