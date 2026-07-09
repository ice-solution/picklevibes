import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { ShoppingBagIcon } from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';

type Order = {
  _id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
};

const statusText: Record<string, string> = {
  pending: '待確認',
  confirmed: '已確認',
  processing: '處理中',
  shipped: '已出貨',
  delivered: '已送達',
  cancelled: '已取消',
};

const AccountOrders: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [detail, setDetail] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (id) {
      setLoading(true);
      axios
        .get(`/orders/${id}`)
        .then((res) => setDetail(res.data.order))
        .catch(() => navigate(PICKCOURT_ACCOUNT.orders))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    axios
      .get(`/orders/my-orders?${params}`)
      .then((res) => setOrders(res.data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [id, filter, navigate]);

  if (id && detail) {
    return (
      <PickCourtMemberLayout title="訂單詳情" subtitle={`訂單編號 ${detail.orderNumber}`}>
        <div className="bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6 space-y-4">
          <button
            type="button"
            onClick={() => navigate(PICKCOURT_ACCOUNT.orders)}
            className="text-sm text-pickcourt-navy hover:text-pickcourt-gold"
          >
            ← 返回訂單列表
          </button>
          <p className="text-sm text-gray-500">
            {new Date(detail.createdAt).toLocaleString('zh-TW')}
          </p>
          <p>
            狀態：
            <span className="font-medium ml-1">{statusText[detail.status] || detail.status}</span>
          </p>
          {detail.items?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-slate-100 py-2">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>HK${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <p className="text-lg font-bold text-pickcourt-navy pt-2">
            總計 HK${detail.total.toFixed(2)}
          </p>
        </div>
      </PickCourtMemberLayout>
    );
  }

  const filters = ['', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  return (
    <PickCourtMemberLayout title="訂單記錄" subtitle="商城購物訂單">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? 'bg-pickcourt-gold text-pickcourt-navy-dark'
                  : 'bg-white border border-slate-200 text-gray-600'
              }`}
            >
              {s ? statusText[s] : '全部'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center px-6">
              <ShoppingBagIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">暫無訂單</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((order) => (
                <li key={order._id}>
                  <Link
                    to={`${PICKCOURT_ACCOUNT.orders}/${order._id}`}
                    className="block p-5 sm:p-6 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold text-pickcourt-navy">{order.orderNumber}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(order.createdAt).toLocaleString('zh-TW')}
                        </p>
                        <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-gray-700">
                          {statusText[order.status] || order.status}
                        </span>
                      </div>
                      <p className="font-bold text-pickcourt-navy shrink-0">
                        HK${order.total.toFixed(2)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PickCourtMemberLayout>
  );
};

export default AccountOrders;
