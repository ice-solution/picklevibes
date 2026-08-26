import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import SEO from '../components/SEO/SEO';
import { TicketIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';

interface PocketItem {
  _id: string;
  status: string;
  source: string;
  assignedAt: string;
  usedAt?: string | null;
  redeemCode: {
    _id: string;
    code: string;
    name: string;
    description?: string;
    type: 'fixed' | 'percentage';
    value: number;
    minAmount: number;
    validFrom: string;
    validUntil: string;
    applicableTypes: string[];
    applicablePricingSlots?: string[];
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  available: '可使用',
  used: '已使用',
  expired: '已過期',
  upcoming: '尚未生效',
  unavailable: '不可用',
  removed: '已移除',
};

const TYPE_LABEL: Record<string, string> = {
  booking: '預約',
  activity: '活動',
  product: '網店',
  eshop: '網店',
  recharge: '充值',
  all: '全部',
};

const MyRedeemPocket: React.FC = () => {
  const [items, setItems] = useState<PocketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);

  const fetchPocket = async () => {
    try {
      setLoading(true);
      const params = filter === 'all' ? '' : `?status=${filter}`;
      const res = await axios.get(`/redeem/my-pocket${params}`);
      setItems(res.data.items || []);
    } catch (e) {
      console.error(e);
      alert('載入兌換券口袋失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPocket();
  }, [filter]);

  const handleClaim = async () => {
    if (!claimCode.trim()) return;
    setClaiming(true);
    try {
      const res = await axios.post('/redeem/pocket/claim', { code: claimCode.trim() });
      const item = res.data?.item;
      const rc = item?.redeemCode;
      const types = (rc?.applicableTypes || [])
        .map((t: string) => TYPE_LABEL[t] || t)
        .join('、');
      const whereHint = types
        ? `可用於：${types}`
        : '可於預約／購物結帳時選用';
      alert(
        [
          res.data.message || '已放入兌換券口袋',
          rc?.name ? `券名：${rc.name}` : '',
          rc?.code ? `兌換碼：${rc.code}` : '',
          '位置：帳戶「我的兌換券」口袋（全站共用，唔綁定單一店鋪）',
          whereHint,
        ]
          .filter(Boolean)
          .join('\n')
      );
      setClaimCode('');
      if (filter !== 'all') {
        setFilter('all');
      } else {
        await fetchPocket();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || '入袋失敗');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <ProtectedRoute>
      <SEO title="我的兌換券 - PickleVibes" description="查看帳戶內的兌換券" />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/balance" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            返回
          </Link>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">我的兌換券</h1>
          <p className="text-gray-600 mb-6">
            後台派發或自行輸入的兌換券會放入此帳戶口袋（全站共用）。預約／購物結帳時可直接選用；每張券的「用途」會標明可用範圍。
          </p>

          <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-3">
            <label className="block text-sm font-medium text-gray-700">輸入兌換碼放入口袋</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={claimCode}
                onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                placeholder="輸入兌換碼"
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming || !claimCode.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
              >
                {claiming ? '處理中…' : '入袋'}
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4 overflow-x-auto">
            {[
              { id: 'all', label: '全部' },
              { id: 'available', label: '可使用' },
              { id: 'used', label: '已使用' },
              { id: 'expired', label: '已過期' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${
                  filter === f.id ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 border'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">載入中…</div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <TicketIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">口袋暫時沒有兌換券</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const rc = item.redeemCode;
                if (!rc) return null;
                return (
                  <div key={item._id} className="bg-white rounded-lg shadow p-5">
                    <div className="flex justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{rc.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{rc.code}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded h-fit ${
                          item.status === 'available'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'used'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {STATUS_LABEL[item.status] || item.status}
                      </span>
                    </div>
                    {rc.description && <p className="text-sm text-gray-600 mb-2">{rc.description}</p>}
                    <p className="text-sm text-primary-700 font-medium mb-2">
                      {rc.type === 'fixed' ? `減 HK$${rc.value}` : `${rc.value}% 折扣`}
                      {rc.minAmount > 0 ? `（最低消費 HK$${rc.minAmount}）` : ''}
                    </p>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>
                        用途：{(rc.applicableTypes || []).map((t) => TYPE_LABEL[t] || t).join('、')}
                      </p>
                      {(rc.applicablePricingSlots || []).length > 0 && (
                        <p>時段：{(rc.applicablePricingSlots || []).join('、')}</p>
                      )}
                      <p>
                        有效至：{new Date(rc.validUntil).toLocaleString('zh-HK')}
                      </p>
                      <p>
                        來源：{item.source === 'admin_assign' ? '後台派發' : '自行入袋'} ·{' '}
                        {new Date(item.assignedAt).toLocaleDateString('zh-HK')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default MyRedeemPocket;
