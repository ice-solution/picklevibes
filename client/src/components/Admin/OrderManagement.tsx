import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBagIcon,
  EyeIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface Order {
  _id: string;
  orderNumber: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      images: string[];
    };
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
  };
  status: string;
  trackingNumber?: string;
  createdAt: string;
}

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      const response = await axios.get(`/orders/admin/list?${params}`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('獲取訂單列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await axios.put(`/orders/${orderId}/status`, {
        status,
        trackingNumber: status === 'shipped' ? trackingNumber : undefined
      });
      fetchOrders();
      setSelectedOrder(null);
      setTrackingNumber('');
    } catch (error: any) {
      alert(error.response?.data?.message || '更新失敗');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('確定要取消此訂單嗎？將恢復庫存並退還兌換碼使用次數。')) return;
    try {
      await axios.put(`/orders/${orderId}/cancel`);
      fetchOrders();
      setSelectedOrder(null);
    } catch (error: any) {
      alert(error.response?.data?.message || '取消訂單失敗');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: {[key: string]: string} = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      processing: 'bg-purple-100 text-purple-800',
      shipped: 'bg-green-100 text-green-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts: {[key: string]: string} = {
      pending: '待處理',
      confirmed: '已確認',
      processing: '處理中',
      shipped: '已出貨',
      delivered: '已送達',
      cancelled: '已取消'
    };
    return texts[status] || status;
  };

  const statusOptions = [
    { value: '', label: '全部' },
    ...['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => ({
      value: s,
      label: getStatusText(s)
    }))
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 標題 */}
      <h2 className="text-xl md:text-2xl font-bold text-gray-900">訂單管理</h2>

      {/* 狀態篩選：手機用下拉選單，桌面用橫向按鈕 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="block w-full sm:hidden px-4 py-3 rounded-lg border border-gray-300 text-base focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          {statusOptions.map(opt => (
            <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="hidden sm:flex flex-wrap gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.value || 'all'}
              onClick={() => setStatusFilter(opt.value)}
              className={`min-h-[44px] px-4 py-2 rounded-lg whitespace-nowrap ${
                statusFilter === opt.value ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* 桌面版：表格 */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">訂單編號</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">用戶</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">總額</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{order.user.name}</div>
                      <div className="text-sm text-gray-500">{order.user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">HK${order.total.toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手機版：卡片列表 */}
          <div className="md:hidden space-y-3">
            {orders.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">暫無訂單</div>
            ) : (
              orders.map((order) => (
                <button
                  key={order._id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left bg-white rounded-lg shadow-md p-4 active:bg-gray-50"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{order.orderNumber}</div>
                      <div className="text-sm text-gray-600 mt-0.5 truncate">{order.user.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{order.user.email}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-sm font-semibold text-gray-900">HK${order.total.toFixed(2)}</span>
                      <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                      <span className="mt-1 text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('zh-TW')}</span>
                    </div>
                    <EyeIcon className="w-5 h-5 text-primary-600 shrink-0 mt-1" />
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4">訂單詳情 - {selectedOrder.orderNumber}</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">訂單項目</h4>
                {selectedOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2 border-b">
                    <span>{item.name} x {item.quantity}</span>
                    <span>HK${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="font-semibold mb-2">收貨地址</h4>
                <p>{selectedOrder.shippingAddress.name}</p>
                <p>{selectedOrder.shippingAddress.phone}</p>
                <p>{selectedOrder.shippingAddress.address}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">更新狀態</h4>
                {selectedOrder.status === 'processing' && (
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="追蹤號碼"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-3 py-3 text-base border rounded-lg mb-2"
                    />
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder._id, 'shipped')}
                      className="w-full min-h-[44px] px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800"
                    >
                      標記為已出貨
                    </button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                  {selectedOrder.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder._id, 'confirmed')}
                      className="min-h-[44px] flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800"
                    >
                      確認訂單
                    </button>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder._id, 'processing')}
                      className="min-h-[44px] flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800"
                    >
                      開始處理
                    </button>
                  )}
                  {selectedOrder.status === 'shipped' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder._id, 'delivered')}
                      className="min-h-[44px] flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800"
                    >
                      標記為已送達
                    </button>
                  )}
                  {['pending', 'confirmed', 'processing'].includes(selectedOrder.status) && (
                    <button
                      onClick={() => handleCancelOrder(selectedOrder._id)}
                      className="min-h-[44px] px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800"
                    >
                      取消訂單
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full min-h-[44px] px-4 py-3 border rounded-lg hover:bg-gray-50 active:bg-gray-100"
              >
                關閉
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;






