import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/Auth/ProtectedRoute';
import SEO from '../components/SEO/SEO';
import axios from 'axios';
import { 
  ShoppingBagIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  TruckIcon,
  XCircleIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';

interface OrderItem {
  product: {
    _id: string;
    name: string;
    images: string[];
  };
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  _id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    district?: string;
    postalCode?: string;
  };
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  redeemCodeName?: string;
  trackingNumber?: string;
  shippedAt?: string;
  createdAt: string;
}

const OrderHistory: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (user) {
      if (id) {
        fetchOrder(id);
      } else {
        fetchOrders();
      }
    }
  }, [user, statusFilter, id]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await axios.get(`/orders/my-orders?${params}`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('獲取訂單列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrder = async (orderId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/orders/${orderId}`);
      setOrder(response.data);
    } catch (error) {
      console.error('獲取訂單詳情失敗:', error);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '/logo.jpg';
    if (imagePath.startsWith('http')) return imagePath;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}/uploads/${imagePath}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'shipped':
        return 'bg-green-100 text-green-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待處理';
      case 'confirmed':
        return '已確認';
      case 'processing':
        return '處理中';
      case 'shipped':
        return '已出貨';
      case 'delivered':
        return '已送達';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'processing':
        return <ClockIcon className="w-5 h-5" />;
      case 'shipped':
        return <TruckIcon className="w-5 h-5" />;
      case 'delivered':
        return <CheckCircleIcon className="w-5 h-5" />;
      case 'cancelled':
        return <XCircleIcon className="w-5 h-5" />;
      default:
        return <ClockIcon className="w-5 h-5" />;
    }
  };

  // 如果顯示單個訂單詳情
  if (id && order) {
    return (
      <ProtectedRoute>
        <SEO 
          title={`訂單詳情 - ${order.orderNumber} - PickleVibes`}
          description="查看訂單詳情"
        />
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => navigate('/orders')}
              className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              返回訂單列表
            </button>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">訂單詳情</h1>
                    <p className="text-gray-600 mt-1">訂單編號：{order.orderNumber}</p>
                  </div>
                  <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="font-medium">{getStatusText(order.status)}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold mb-3">訂單項目</h2>
                    <div className="space-y-3">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                          <img
                            src={getImageUrl(item.product?.images?.[0] || '')}
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-lg">{item.name}</p>
                            <p className="text-sm text-gray-600">
                              數量：{item.quantity} × HK${item.price.toFixed(2)}
                            </p>
                          </div>
                          <p className="font-semibold text-lg">HK${item.subtotal.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold mb-3">收貨地址</h2>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="font-medium">{order.shippingAddress.name}</p>
                      <p className="text-gray-600">{order.shippingAddress.phone}</p>
                      <p className="text-gray-600">{order.shippingAddress.address}</p>
                      {order.shippingAddress.district && (
                        <p className="text-gray-600">{order.shippingAddress.district}</p>
                      )}
                      {order.shippingAddress.postalCode && (
                        <p className="text-gray-600">{order.shippingAddress.postalCode}</p>
                      )}
                    </div>
                  </div>

                  {order.trackingNumber && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="font-medium text-blue-900 mb-1">追蹤號碼</p>
                      <p className="text-blue-700">{order.trackingNumber}</p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600">小計</span>
                      <span className="text-gray-900">HK${order.subtotal.toFixed(2)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between items-center mb-2 text-green-600">
                        <span>折扣{order.redeemCodeName ? ` (${order.redeemCodeName})` : ''}</span>
                        <span>-HK${order.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-4 border-t">
                      <span className="text-lg font-semibold">總計</span>
                      <span className="text-2xl font-bold text-primary-600">HK${order.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-sm text-gray-500">
                    <p>訂單日期：{new Date(order.createdAt).toLocaleString('zh-TW')}</p>
                    {order.shippedAt && (
                      <p>出貨日期：{new Date(order.shippedAt).toLocaleString('zh-TW')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SEO 
        title="訂單歷史 - PickleVibes"
        description="查看您的訂單記錄"
      />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">訂單歷史</h1>

          {/* 狀態篩選 */}
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                statusFilter === ''
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              全部
            </button>
            {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {getStatusText(status)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="mt-4 text-gray-600">載入中...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <ShoppingBagIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">暫無訂單</p>
              <Link
                to="/shop"
                className="inline-block px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                開始購物
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">訂單編號：{order.orderNumber}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        <span className="font-medium">{getStatusText(order.status)}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-4">
                          <img
                            src={getImageUrl(item.product?.images?.[0] || '')}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-gray-600">
                              數量：{item.quantity} × HK${item.price.toFixed(2)}
                            </p>
                          </div>
                          <p className="font-semibold">HK${item.subtotal.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>

                    {order.trackingNumber && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm">
                          <span className="font-medium">追蹤號碼：</span>
                          {order.trackingNumber}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <p className="text-sm text-gray-600">收貨地址：{order.shippingAddress.address}</p>
                        {order.redeemCodeName && (
                          <p className="text-sm text-green-600 mt-1">
                            已使用兌換碼：{order.redeemCodeName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {order.discount > 0 && (
                          <p className="text-sm text-gray-600">
                            小計：HK${order.subtotal.toFixed(2)}
                          </p>
                        )}
                        {order.discount > 0 && (
                          <p className="text-sm text-green-600">
                            折扣：-HK${order.discount.toFixed(2)}
                          </p>
                        )}
                        <p className="text-lg font-bold">
                          總計：HK${order.total.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Link
                        to={`/orders/${order._id}`}
                        className="flex items-center space-x-2 px-4 py-2 text-primary-600 hover:text-primary-800"
                      >
                        <EyeIcon className="w-5 h-5" />
                        <span>查看詳情</span>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default OrderHistory;

