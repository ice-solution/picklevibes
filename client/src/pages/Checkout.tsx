import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import SEO from '../components/SEO/SEO';
import RedeemCodeInput from '../components/Common/RedeemCodeInput';
import axios from 'axios';
import { 
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

interface RedeemData {
  id: string;
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  discountAmount: number;
  finalAmount: number;
}

const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<RedeemData | null>(null);
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: '',
    district: ''
  });
  const [notes, setNotes] = useState('');
  const [payByPoints, setPayByPoints] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      loadCart();
    }
  }, [user]);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await axios.get('/recharge/balance');
        setUserBalance(res.data?.balance ?? null);
      } catch {
        setUserBalance(null);
      }
    };
    if (user) fetchBalance();
  }, [user]);

  const loadCart = async () => {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCartItems(cart);

    // 獲取產品詳情以驗證庫存
    try {
      const productDetails = await Promise.all(
        cart.map(async (item: CartItem) => {
          const response = await axios.get(`/products/${item.productId}`);
          return response.data;
        })
      );
      setProducts(productDetails);
    } catch (error) {
      console.error('獲取產品詳情失敗:', error);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = redeemData ? redeemData.discountAmount : 0;
  const total = subtotal - discount;

  const handleRedeemApplied = (data: RedeemData) => {
    setRedeemData(data);
  };

  const handleRedeemRemoved = () => {
    setRedeemData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert('購物車是空的');
      return;
    }

    if (!shippingAddress.name || !shippingAddress.phone || !shippingAddress.address) {
      alert('請填寫完整的收貨地址');
      return;
    }

    // 驗證庫存
    for (const cartItem of cartItems) {
      const product = products.find(p => p._id === cartItem.productId);
      if (!product) {
        alert(`產品 ${cartItem.name} 不存在`);
        return;
      }
      if (product.stock < cartItem.quantity) {
        alert(`產品 ${cartItem.name} 庫存不足`);
        return;
      }
    }

    try {
      setLoading(true);
      const response = await axios.post('/orders', {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        shippingAddress,
        redeemCodeId: redeemData?.id || null,
        notes,
        payByPoints: payByPoints || undefined
      });

      // 清空購物車
      localStorage.setItem('cart', JSON.stringify([]));
      
      // 跳轉到訂單詳情或訂單歷史
      navigate(`/orders/${response.data.order._id}`);
    } catch (error: any) {
      console.error('創建訂單失敗:', error);
      alert(error.response?.data?.message || '創建訂單失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">購物車是空的</p>
            <button
              onClick={() => navigate('/shop')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              開始購物
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO 
        title="結帳 - PickleVibes"
        description="完成您的訂單"
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">結帳</h1>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* 收貨地址 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">收貨地址</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        收件人姓名 *
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.name}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話號碼 *
                      </label>
                      <input
                        type="tel"
                        value={shippingAddress.phone}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        地址 *
                      </label>
                      <textarea
                        value={shippingAddress.address}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                        required
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        地區
                      </label>
                      <input
                        type="text"
                        value={shippingAddress.district}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, district: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 備註 */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-bold mb-4">備註</h2>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="如有特殊要求，請在此填寫..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="lg:col-span-1">
                {/* 訂單摘要 */}
                <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                  <h2 className="text-xl font-bold mb-4">訂單摘要</h2>
                  <div className="space-y-3 mb-6">
                    {cartItems.map((item) => (
                      <div key={item.productId} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>{Math.round(item.price * item.quantity)} 積分</span>
                      </div>
                    ))}
                    <div className="border-t pt-3">
                      <div className="flex justify-between mb-2">
                        <span>小計</span>
                        <span>{Math.round(subtotal)} 積分</span>
                      </div>
                      {redeemData && (
                        <div className="flex justify-between text-green-600 mb-2">
                          <span>折扣 ({redeemData.name})</span>
                          <span>-{Math.round(discount)} 積分</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>總計</span>
                        <span>{Math.round(total)} 積分</span>
                      </div>
                    </div>
                  </div>

                  {/* 兌換碼 */}
                  <div className="mb-6">
                    <RedeemCodeInput
                      amount={subtotal}
                      orderType="product"
                      onRedeemApplied={handleRedeemApplied}
                      onRedeemRemoved={handleRedeemRemoved}
                      restrictedCode="product"
                    />
                  </div>

                  {/* 使用積分支付：實付 = 總計（折扣後） */}
                  {userBalance !== null && userBalance >= Math.round(total) && total > 0 && (
                    <div className="mb-6 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="payByPoints"
                        checked={payByPoints}
                        onChange={(e) => setPayByPoints(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="payByPoints" className="text-sm text-gray-700 cursor-pointer">
                        使用積分支付（實付 <strong>{Math.round(total)} 分</strong>，餘額 {userBalance} 分）
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? '處理中...' : '確認訂單'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default Checkout;

