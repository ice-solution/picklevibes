import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ShoppingCartIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import UserAutocomplete from '../Common/UserAutocomplete';
import RedeemCodeInput from '../Common/RedeemCodeInput';
import {
  VariantMode,
  ProductVariant,
  ColorOption,
  getEffectiveVariantMode,
  usesVariantStock,
  getVariantStock,
  getTotalStock,
  getAvailableColors,
  getAvailableSizes,
  getAvailableColorOptions,
  cartLineKey,
} from '../../constants/productVariants';
import { CLOTHING_SIZE_OPTIONS } from '../../constants/clothingSizes';

interface Store {
  _id: string;
  name: string;
  slug?: string;
}

interface PosProduct {
  _id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  isActive: boolean;
  images: string[];
  category?: { _id: string; name: string };
  variantMode?: VariantMode;
  variants?: ProductVariant[];
  colorOptions?: ColorOption[];
}

interface CartItem {
  key: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
  maxStock: number;
}

interface PosTransactionRow {
  _id: string;
  transactionNumber: string;
  total: number;
  paymentMethod: string;
  status: 'completed' | 'cancelled';
  createdAt: string;
  items?: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  store?: { name: string };
  user?: { name: string; email: string; phone?: string };
}

interface SelectedUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

const PAYMENT_OPTIONS = [
  { value: 'kpay', label: 'KPay' },
  { value: 'cash', label: '現金' },
  { value: 'points', label: '積分扣數' },
];

function getPrice(product: PosProduct) {
  if (product.discountPrice != null && product.discountPrice < product.price) {
    return product.discountPrice;
  }
  return product.price;
}

function getImageUrl(imagePath?: string) {
  if (!imagePath) return '/logo.jpg';
  if (imagePath.startsWith('http')) return imagePath;
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  return `${apiUrl}/uploads/${imagePath}`;
}

function paymentLabel(method: string) {
  return PAYMENT_OPTIONS.find((o) => o.value === method)?.label || method;
}

const PosManagement: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [transactions, setTransactions] = useState<PosTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [storeId, setStoreId] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [redeemData, setRedeemData] = useState<{
    id: string;
    name: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  const [pickerProduct, setPickerProduct] = useState<PosProduct | null>(null);
  const [pickerColor, setPickerColor] = useState('');
  const [pickerSize, setPickerSize] = useState('');
  const [pickerQty, setPickerQty] = useState(1);
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchStores = useCallback(async () => {
    const res = await axios.get('/stores/admin/all');
    setStores(res.data.stores || []);
  }, []);

  const fetchProducts = useCallback(async (query = '') => {
    const params = new URLSearchParams({ limit: '200' });
    if (query.trim()) params.set('search', query.trim());
    const res = await axios.get(`/pos/products?${params.toString()}`);
    setProducts(res.data.products || []);
  }, []);

  const fetchTransactions = useCallback(async (selectedStoreId?: string, status: string = 'all') => {
    const params = new URLSearchParams({ limit: '20', status });
    if (selectedStoreId) params.set('storeId', selectedStoreId);
    const res = await axios.get(`/pos/transactions?${params.toString()}`);
    setTransactions(res.data.transactions || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchStores(), fetchProducts()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchStores, fetchProducts]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchProducts]);

  useEffect(() => {
    if (storeId) {
      fetchTransactions(storeId, transactionStatusFilter);
    } else {
      fetchTransactions(undefined, transactionStatusFilter);
    }
  }, [storeId, transactionStatusFilter, fetchTransactions]);

  const handleCancelTransaction = async (tx: PosTransactionRow) => {
    if (tx.status === 'cancelled') return;
    const reason = window.prompt('取消原因（可選）：') ?? '';
    if (!window.confirm(`確定取消 ${tx.transactionNumber}？\n將恢復庫存${tx.paymentMethod === 'points' ? '並退還積分' : ''}。`)) {
      return;
    }

    setCancellingId(tx._id);
    try {
      const res = await axios.put(`/pos/transactions/${tx._id}/cancel`, { reason });
      alert(res.data.message || '已取消');
      await Promise.all([
        fetchProducts(search),
        fetchTransactions(storeId || undefined, transactionStatusFilter),
      ]);
    } catch (error: any) {
      alert(error.response?.data?.message || '取消失敗');
    } finally {
      setCancellingId(null);
    }
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const payableTotal = useMemo(() => {
    if (redeemData) {
      return Math.max(0, redeemData.finalAmount);
    }
    return cartTotal;
  }, [cartTotal, redeemData]);

  // 購物車金額變動時清除已套用兌換券（需重新驗證）
  useEffect(() => {
    if (redeemData && Math.abs(redeemData.finalAmount + redeemData.discountAmount - cartTotal) > 0.01) {
      setRedeemData(null);
    }
  }, [cartTotal, redeemData]);

  const filteredProducts = products;

  const resetPicker = () => {
    setPickerProduct(null);
    setPickerColor('');
    setPickerSize('');
    setPickerQty(1);
  };

  const openProductPicker = (product: PosProduct) => {
    const mode = getEffectiveVariantMode(product);
    if (mode === 'none') {
      addSimpleProduct(product, 1);
      return;
    }
    setPickerProduct(product);
    setPickerColor('');
    setPickerSize('');
    setPickerQty(1);
  };

  const pickerStock = useMemo(() => {
    if (!pickerProduct) return 0;
    if (usesVariantStock(pickerProduct)) {
      return getVariantStock(pickerProduct, pickerColor || null, pickerSize || null);
    }
    return getTotalStock(pickerProduct);
  }, [pickerProduct, pickerColor, pickerSize]);

  const addSimpleProduct = (product: PosProduct, quantity: number, color?: string | null, size?: string | null) => {
    const price = getPrice(product);
    const maxStock = usesVariantStock(product)
      ? getVariantStock(product, color || null, size || null)
      : getTotalStock(product);

    if (maxStock < quantity) {
      alert(`庫存不足（剩餘 ${maxStock}）`);
      return;
    }

    const key = cartLineKey(product._id, color, size);
    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        const nextQty = existing.quantity + quantity;
        if (nextQty > maxStock) {
          alert(`庫存不足（剩餘 ${maxStock}）`);
          return prev;
        }
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: nextQty } : item
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product._id,
          name: product.name,
          price,
          quantity,
          color: color || null,
          size: size || null,
          maxStock,
        },
      ];
    });
  };

  const confirmPickerAdd = () => {
    if (!pickerProduct) return;
    const mode = getEffectiveVariantMode(pickerProduct);
    if ((mode === 'color' || mode === 'color_size') && !pickerColor) {
      alert('請選擇顏色');
      return;
    }
    if ((mode === 'size' || mode === 'color_size') && !pickerSize) {
      alert('請選擇尺碼');
      return;
    }
    addSimpleProduct(pickerProduct, pickerQty, pickerColor || null, pickerSize || null);
    resetPicker();
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) return item;
          const next = item.quantity + delta;
          if (next <= 0) return null;
          if (next > item.maxStock) {
            alert(`庫存不足（剩餘 ${item.maxStock}）`);
            return item;
          }
          return { ...item, quantity: next };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeCartItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const handleCheckout = async () => {
    if (!storeId) {
      alert('請選擇店鋪');
      return;
    }
    if (cart.length === 0) {
      alert('購物車是空的');
      return;
    }
    if (paymentMethod === 'points' && !selectedUser) {
      alert('積分扣數必須選擇客戶帳戶');
      return;
    }
    if (redeemData && !selectedUser) {
      alert('使用兌換券必須選擇客戶帳戶');
      return;
    }

    if (!window.confirm(`確認結帳 HK$${payableTotal.toFixed(2)}？`)) return;

    setCheckoutLoading(true);
    try {
      const res = await axios.post('/pos/checkout', {
        storeId,
        userId: selectedUser?._id || null,
        paymentMethod,
        notes,
        redeemCodeId: redeemData?.id || null,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
        })),
      });
      alert(`結帳成功：${res.data.transaction?.transactionNumber || ''}`);
      setCart([]);
      setNotes('');
      setRedeemData(null);
      if (paymentMethod !== 'points') {
        setSelectedUser(null);
      }
      await Promise.all([
        fetchProducts(search),
        fetchTransactions(storeId || undefined, transactionStatusFilter),
      ]);
    } catch (error: any) {
      alert(error.response?.data?.message || '結帳失敗');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">載入中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">POS 收銀</h2>
          <p className="text-sm text-gray-600 mt-1">店內銷售（含已停用網店商品）</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 min-w-[200px]"
          >
            <option value="">選擇店鋪 *</option>
            {stores.map((store) => (
              <option key={store._id} value={store._id}>{store.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋商品..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[520px] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const stock = getTotalStock(product);
              return (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => openProductPicker(product)}
                  className="text-left bg-white rounded-lg shadow border border-gray-100 hover:border-primary-300 transition overflow-hidden"
                >
                  <img
                    src={getImageUrl(product.images?.[0])}
                    alt={product.name}
                    className="w-full h-28 object-cover"
                  />
                  <div className="p-3">
                    <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                    <p className="text-primary-700 font-bold mt-1">HK${getPrice(product)}</p>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-gray-500">庫存 {stock}</span>
                      {!product.isActive && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">已停用</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ShoppingCartIcon className="w-5 h-5 text-primary-600" />
            <h3 className="font-semibold">購物車</h3>
          </div>

          {cart.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">尚未加入商品</p>
          ) : (
            <ul className="space-y-3 max-h-56 overflow-y-auto">
              {cart.map((item) => (
                <li key={item.key} className="border-b pb-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {(item.color || item.size) && (
                        <p className="text-xs text-gray-500">
                          {[item.color, item.size].filter(Boolean).join(' / ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-600">HK${item.price} × {item.quantity}</p>
                    </div>
                    <button type="button" onClick={() => removeCartItem(item.key)} className="text-red-500">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button type="button" onClick={() => updateCartQty(item.key, -1)} className="p-1 border rounded">
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <button type="button" onClick={() => updateCartQty(item.key, 1)} className="p-1 border rounded">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>小計</span>
              <span>HK${cartTotal.toFixed(2)}</span>
            </div>
            {redeemData && (
              <div className="flex justify-between text-sm text-green-700">
                <span>折扣{redeemData.name ? `（${redeemData.name}）` : ''}</span>
                <span>-HK${redeemData.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>應付</span>
              <span>HK${payableTotal.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">客戶（可選；積分／兌換券必填）</label>
            <UserAutocomplete
              value={selectedUser?.name || ''}
              onChange={(user) => {
                setSelectedUser(user);
                setRedeemData(null);
              }}
              placeholder="手機 / Email / 名字搜尋..."
            />
            {selectedUser && (
              <p className="text-xs text-gray-500 mt-1">
                {selectedUser.email}{selectedUser.phone ? ` · ${selectedUser.phone}` : ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">兌換券</label>
            {cart.length === 0 ? (
              <p className="text-xs text-gray-500">請先加入商品</p>
            ) : (
              <RedeemCodeInput
                key={`${selectedUser?._id || 'no-customer'}-${cartTotal}`}
                amount={cartTotal}
                orderType="product"
                forUserId={selectedUser?._id ?? null}
                onRedeemApplied={(data) =>
                  setRedeemData({
                    id: data.id,
                    name: data.name,
                    discountAmount: data.discountAmount,
                    finalAmount: data.finalAmount,
                  })
                }
                onRedeemRemoved={() => setRedeemData(null)}
                restrictedCode="product"
              />
            )}
            {!selectedUser && (
              <p className="text-xs text-amber-600 mt-1">請先選擇客戶，方可使用其口袋兌換券或代輸入兌換碼</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">付款方式</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="可選"
            />
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkoutLoading || cart.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <CheckCircleIcon className="w-5 h-5" />
            {checkoutLoading ? '處理中...' : '結帳'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">POS 交易記錄</span>
          <select
            value={transactionStatusFilter}
            onChange={(e) => setTransactionStatusFilter(e.target.value as 'all' | 'completed' | 'cancelled')}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">全部狀態</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">單號</th>
                <th className="px-4 py-2 text-left">店鋪</th>
                <th className="px-4 py-2 text-left">客戶</th>
                <th className="px-4 py-2 text-left">付款</th>
                <th className="px-4 py-2 text-left">狀態</th>
                <th className="px-4 py-2 text-right">金額</th>
                <th className="px-4 py-2 text-left">時間</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx._id} className={tx.status === 'cancelled' ? 'bg-gray-50 opacity-75' : undefined}>
                  <td className="px-4 py-2 font-mono text-xs">{tx.transactionNumber}</td>
                  <td className="px-4 py-2">{tx.store?.name || '—'}</td>
                  <td className="px-4 py-2">{tx.user?.name || '散客'}</td>
                  <td className="px-4 py-2">{paymentLabel(tx.paymentMethod)}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      tx.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {tx.status === 'cancelled' ? '已取消' : '已完成'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">HK${tx.total.toFixed(2)}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(tx.createdAt).toLocaleString('zh-HK')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {tx.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleCancelTransaction(tx)}
                        disabled={cancellingId === tx._id}
                        className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        {cancellingId === tx._id ? '處理中' : '取消'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">暫無交易</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pickerProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-lg">{pickerProduct.name}</h3>
            {(() => {
              const mode = getEffectiveVariantMode(pickerProduct);
              const colors = usesVariantStock(pickerProduct)
                ? getAvailableColors(pickerProduct, pickerSize || null)
                : getAvailableColorOptions(pickerProduct, pickerSize || null).map((o) => o.name);
              const sizes = usesVariantStock(pickerProduct)
                ? getAvailableSizes(pickerProduct, pickerColor || null)
                : (mode === 'size' || mode === 'color_size' ? [...CLOTHING_SIZE_OPTIONS] : []);

              return (
                <>
                  {(mode === 'color' || mode === 'color_size') && (
                    <div>
                      <label className="block text-sm font-medium mb-1">顏色</label>
                      <select
                        value={pickerColor}
                        onChange={(e) => setPickerColor(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">請選擇</option>
                        {colors.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {(mode === 'size' || mode === 'color_size') && (
                    <div>
                      <label className="block text-sm font-medium mb-1">尺碼</label>
                      <select
                        value={pickerSize}
                        onChange={(e) => setPickerSize(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2"
                      >
                        <option value="">請選擇</option>
                        {sizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">可用庫存：{pickerStock}</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">數量</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, pickerStock)}
                      value={pickerQty}
                      onChange={(e) => setPickerQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </>
              );
            })()}
            <div className="flex gap-2">
              <button type="button" onClick={resetPicker} className="flex-1 py-2 border rounded-lg">
                取消
              </button>
              <button
                type="button"
                onClick={confirmPickerAdd}
                disabled={pickerStock <= 0}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
              >
                加入購物車
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosManagement;
