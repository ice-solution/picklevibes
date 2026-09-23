import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { PhotoIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import SEO from '../components/SEO/SEO';

type ActiveBooking = {
  _id: string;
  store?: { _id: string; name?: string; slug?: string } | string;
  court?: { name?: string } | string;
  startTime: string;
  endTime: string;
  date: string;
};

type FoodCategory = { _id: string; name: string };
type FoodItem = {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string;
};

type CartLine = { itemId: string; quantity: number };

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失敗';
}

function getImageUrl(imagePath?: string) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const base = apiUrl.replace(/\/api\/?$/, '');
  const clean = imagePath.replace(/^\//, '').replace(/^uploads\//, '');
  return `${base}/uploads/${clean}`;
}

function storeIdOf(b: ActiveBooking): string {
  if (!b.store) return '';
  if (typeof b.store === 'string') return b.store;
  return b.store._id;
}

function storeNameOf(b: ActiveBooking): string {
  if (!b.store) return '店鋪';
  if (typeof b.store === 'string') return '店鋪';
  return b.store.name || '店鋪';
}

function courtNameOf(b: ActiveBooking): string {
  if (!b.court) return '';
  if (typeof b.court === 'string') return b.court;
  return b.court.name || '';
}

const FoodOrderPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<ActiveBooking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuError, setMenuError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [myOrders, setMyOrders] = useState<any[]>([]);

  const selectedBooking = useMemo(
    () => bookings.find((b) => b._id === selectedBookingId) || null,
    [bookings, selectedBookingId]
  );

  const loadEligibility = useCallback(async () => {
    setLoading(true);
    setMenuError('');
    try {
      const [elig, ordersRes] = await Promise.all([
        axios.get('/food/eligibility'),
        axios.get('/food/orders/mine'),
      ]);
      const list: ActiveBooking[] = elig.data.bookings || [];
      setBookings(list);
      setMyOrders(ordersRes.data.orders || []);
      if (list.length) {
        setSelectedBookingId((prev) => prev || list[0]._id);
      }
    } catch (e) {
      setMenuError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  useEffect(() => {
    if (!selectedBooking) {
      setCategories([]);
      setItems([]);
      return;
    }
    const sid = storeIdOf(selectedBooking);
    if (!sid) return;

    (async () => {
      setMenuError('');
      try {
        const res = await axios.get('/food/menu', { params: { storeId: sid } });
        const cats: FoodCategory[] = res.data.categories || [];
        const its: FoodItem[] = (res.data.items || []).map((it: any) => ({
          ...it,
          category: String(it.category?._id || it.category),
        }));
        setCategories(cats);
        setItems(its);
        setActiveCategory(cats[0]?._id || '');
        setCart({});
      } catch (e) {
        setCategories([]);
        setItems([]);
        setMenuError(errMsg(e));
      }
    })();
  }, [selectedBooking]);

  const filteredItems = useMemo(() => {
    if (!activeCategory) return items;
    return items.filter((it) => it.category === activeCategory);
  }, [items, activeCategory]);

  const cartLines: CartLine[] = useMemo(
    () => Object.entries(cart).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity })),
    [cart]
  );

  const totalPoints = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      const item = items.find((i) => i._id === line.itemId);
      return sum + (item ? item.price * line.quantity : 0);
    }, 0);
  }, [cartLines, items]);

  const setQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const next = Math.max(0, Math.min(99, (prev[itemId] || 0) + delta));
      const copy = { ...prev };
      if (next <= 0) delete copy[itemId];
      else copy[itemId] = next;
      return copy;
    });
  };

  const submitOrder = async () => {
    if (!selectedBookingId) return;
    if (!cartLines.length) return alert('請先選擇餐點');
    if (!window.confirm(`確認訂餐？將扣除 ${totalPoints} 積分`)) return;

    setSubmitting(true);
    setSuccessMsg('');
    try {
      const res = await axios.post('/food/orders', {
        bookingId: selectedBookingId,
        items: cartLines,
        notes,
      });
      setCart({});
      setNotes('');
      setSuccessMsg(`訂餐成功！已扣除 ${res.data.order.totalPoints} 積分`);
      const ordersRes = await axios.get('/food/orders/mine');
      setMyOrders(ordersRes.data.orders || []);
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <SEO title="場內訂餐 - PickleVibes" description="預約時段內訂餐" />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">場內訂餐</h1>
            <p className="text-sm text-gray-600 mt-1">僅限目前進行中的預約時段內訂餐，費用以積分扣除。</p>
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">載入中...</div>
          ) : bookings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <p className="text-gray-800 font-medium">你目前沒有進行中的預約</p>
              <p className="text-sm text-gray-600">例如預約了 12:00–14:00，需於該時段內才可訂餐。</p>
              <Link to="/booking" className="inline-flex text-sm text-primary-600 hover:underline">前往預約場地</Link>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">選擇進行中的預約</label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {bookings.map((b) => (
                    <option key={b._id} value={b._id}>
                      {storeNameOf(b)} · {courtNameOf(b)} · {b.startTime}-{b.endTime}
                    </option>
                  ))}
                </select>
              </div>

              {menuError && (
                <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm">{menuError}</div>
              )}
              {successMsg && (
                <div className="bg-green-50 text-green-700 rounded-lg p-3 text-sm">{successMsg}</div>
              )}

              {categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((c) => (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => setActiveCategory(c._id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-sm ${
                        activeCategory === c._id
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {filteredItems.length === 0 && !menuError && (
                  <div className="bg-white rounded-xl border p-4 text-sm text-gray-500">此店鋪暫無上架餐點</div>
                )}
                {filteredItems.map((item) => (
                  <div key={item._id} className="bg-white rounded-xl border border-gray-200 p-3 flex gap-3">
                    <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img src={getImageUrl(item.image)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <PhotoIcon className="w-8 h-8 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.description}</div>
                      )}
                      <div className="text-sm text-primary-600 font-semibold mt-1">{item.price} 積分</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(item._id, -1)}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center"
                        disabled={!cart[item._id]}
                      >
                        <MinusIcon className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{cart[item._id] || 0}</span>
                      <button
                        type="button"
                        onClick={() => setQty(item._id, 1)}
                        className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {cartLines.length > 0 && (
                <div className="sticky bottom-4 bg-white rounded-xl border border-gray-200 shadow-lg p-4 space-y-3">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="備註（選填，例如少冰、過敏）"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-gray-600">{cartLines.reduce((s, l) => s + l.quantity, 0)} 件</div>
                      <div className="text-lg font-bold text-primary-600">{totalPoints} 積分</div>
                    </div>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={submitOrder}
                      className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {submitting ? '提交中...' : '確認訂餐'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {myOrders.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">最近訂餐</h2>
              <div className="bg-white rounded-xl border border-gray-200 divide-y">
                {myOrders.slice(0, 10).map((o) => (
                  <div key={o._id} className="p-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{o.store?.name || '店鋪'}</span>
                      <span className="text-primary-600 font-semibold">{o.totalPoints} 積分</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(o.createdAt).toLocaleString('zh-HK')} · {o.status}
                    </div>
                    <div className="text-gray-700 mt-1">
                      {o.items?.map((it: any) => `${it.name}x${it.quantity}`).join('、')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default FoodOrderPage;
