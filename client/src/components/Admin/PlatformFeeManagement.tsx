import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

type FeeRow = {
  _id: string;
  type: 'store_recharge' | 'booking_points';
  grossAmount: number;
  feePercent: number;
  feeAmount: number;
  netAmount: number;
  occurredAt: string;
  settled: boolean;
  settledAt?: string | null;
  note?: string;
  store?: { name?: string; slug?: string };
};

const TYPE_LABEL: Record<string, string> = {
  store_recharge: '店充值',
  booking_points: '積分預約',
};

const PlatformFeeManagement: React.FC = () => {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settledFilter, setSettledFilter] = useState<'all' | 'true' | 'false'>('false');
  const [typeFilter, setTypeFilter] = useState<'all' | 'store_recharge' | 'booking_points'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState({
    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
    unsettledFee: 0,
  });
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { limit: '100' };
      if (settledFilter !== 'all') params.settled = settledFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axios.get('/platform-fees', { params });
      setFees(res.data.fees || []);
      setSummary(
        res.data.summary || {
          grossAmount: 0,
          feeAmount: 0,
          netAmount: 0,
          unsettledFee: 0,
        }
      );
    } catch (e: any) {
      alert(e.response?.data?.message || '載入抽成紀錄失敗');
    } finally {
      setLoading(false);
    }
  }, [settledFilter, typeFilter, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSettled = async (fee: FeeRow) => {
    try {
      setToggling(fee._id);
      await axios.patch(`/platform-fees/${fee._id}/settled`, {
        settled: !fee.settled,
      });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.message || '更新失敗');
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">店鋪抽成／找數</h2>
        <p className="text-gray-600">
          店充值與積分預約場地之平台收取費；入店淨額 = 基數 − 抽成。可逐筆標記已找數。
        </p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">基數合計</p>
          <p className="text-xl font-bold">{summary.grossAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">抽成合計</p>
          <p className="text-xl font-bold text-amber-700">{summary.feeAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">入店淨額</p>
          <p className="text-xl font-bold text-green-700">{summary.netAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">未找抽成</p>
          <p className="text-xl font-bold text-red-600">{summary.unsettledFee.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-white rounded-lg shadow p-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">找數狀態</label>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={settledFilter}
            onChange={(e) => setSettledFilter(e.target.value as typeof settledFilter)}
          >
            <option value="all">全部</option>
            <option value="false">未找</option>
            <option value="true">已找</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">類型</label>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">全部</option>
            <option value="store_recharge">店充值</option>
            <option value="booking_points">積分預約</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">由</label>
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
          重新整理
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">找數</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">日期</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">店鋪</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">類型</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">基數</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">%</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">抽成</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">入店淨額</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map((fee) => (
                <tr key={fee._id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={fee.settled}
                      disabled={toggling === fee._id}
                      onChange={() => void toggleSettled(fee)}
                      title={fee.settled ? '已找數（再按取消）' : '標記已找數'}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                    {new Date(fee.occurredAt).toLocaleString('zh-HK')}
                  </td>
                  <td className="px-3 py-2">{fee.store?.name || '—'}</td>
                  <td className="px-3 py-2">{TYPE_LABEL[fee.type] || fee.type}</td>
                  <td className="px-3 py-2 text-right">{fee.grossAmount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{fee.feePercent}%</td>
                  <td className="px-3 py-2 text-right text-amber-700 font-medium">
                    {fee.feeAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-green-700 font-medium">
                    {fee.netAmount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-gray-500 max-w-[12rem] truncate">{fee.note || '—'}</td>
                </tr>
              ))}
              {fees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    沒有符合條件的抽成紀錄
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

export default PlatformFeeManagement;
