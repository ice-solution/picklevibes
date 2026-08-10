import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

type StoreStat = {
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  platformFeePercent?: number;
  bookingCount: number;
  totalHours: number;
  totalMinutes: number;
  totalPoints: number;
  feeSummary?: {
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    count: number;
  } | null;
};

const StoreBookingStats: React.FC = () => {
  const [stores, setStores] = useState<StoreStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get('/platform-fees/store-booking-stats', { params });
      setStores(res.data.stores || []);
    } catch (e: any) {
      alert(e.response?.data?.message || '載入店鋪預約統計失敗');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">各店預約統計</h2>
        <p className="text-gray-600">按店查看預約筆數、時數與期間抽成淨額（未取消預約）。</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">由（預約日）</label>
          <input
            type="date"
            className="border rounded-md px-3 py-2 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">至</label>
          <input
            type="date"
            className="border rounded-md px-3 py-2 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700"
        >
          查詢
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">店鋪</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">預約筆數</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">時數</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">扣積分</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">抽成%</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">期間抽成</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">入店淨額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stores.map((s) => (
                <tr key={String(s.storeId)} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.storeName || s.storeSlug || '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{s.bookingCount}</td>
                  <td className="px-4 py-3 text-right">{s.totalHours}</td>
                  <td className="px-4 py-3 text-right">{Number(s.totalPoints || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {Number(s.platformFeePercent) > 0 ? `${s.platformFeePercent}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700">
                    {(s.feeSummary?.feeAmount ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    {(s.feeSummary?.netAmount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    此期間沒有預約資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StoreBookingStats;
