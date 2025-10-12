import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CurrencyDollarIcon, 
  PencilIcon, 
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import apiConfig from '../../config/api';

interface RechargeOffer {
  _id: string;
  name: string;
  points: number;
  amount: number;
  description: string;
  expiryDate: string;
  isActive: boolean;
  sortOrder: number;
  createdBy: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface RechargeOfferFormData {
  name: string;
  points: number;
  amount: number;
  description: string;
  expiryDate: string;
  sortOrder: number;
}

const RechargeOfferManagement: React.FC = () => {
  const [offers, setOffers] = useState<RechargeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<RechargeOffer | null>(null);
  const [formData, setFormData] = useState<RechargeOfferFormData>({
    name: '',
    points: 0,
    amount: 0,
    description: '',
    expiryDate: '',
    sortOrder: 0
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiConfig.API_BASE_URL}/recharge-offers/admin`);
      setOffers(response.data.offers);
    } catch (error) {
      console.error('獲取充值優惠失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof RechargeOfferFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 清除錯誤
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.name.trim()) {
      newErrors.name = '優惠名稱為必填項目';
    }

    if (!formData.points || formData.points <= 0) {
      newErrors.points = '充值積分必須大於0';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = '充值金額必須大於0';
    }

    if (!formData.description.trim()) {
      newErrors.description = '描述為必填項目';
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = '過期日期為必填項目';
    } else {
      const expiryDate = new Date(formData.expiryDate);
      if (expiryDate <= new Date()) {
        newErrors.expiryDate = '過期日期必須是未來時間';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await axios.post(`${apiConfig.API_BASE_URL}/recharge-offers`, formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        points: 0,
        amount: 0,
        description: '',
        expiryDate: '',
        sortOrder: 0
      });
      fetchOffers();
    } catch (error: any) {
      console.error('創建充值優惠失敗:', error);
      if (error.response?.data?.errors) {
        const serverErrors: {[key: string]: string} = {};
        error.response.data.errors.forEach((err: any) => {
          serverErrors[err.path] = err.msg;
        });
        setErrors(serverErrors);
      }
    }
  };

  const handleEditOffer = (offer: RechargeOffer) => {
    setEditingOffer(offer);
    setFormData({
      name: offer.name,
      points: offer.points,
      amount: offer.amount,
      description: offer.description,
      expiryDate: offer.expiryDate.split('T')[0],
      sortOrder: offer.sortOrder
    });
    setShowEditModal(true);
  };

  const handleUpdateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !editingOffer) {
      return;
    }

    try {
      await axios.put(`${apiConfig.API_BASE_URL}/recharge-offers/${editingOffer._id}`, formData);
      setShowEditModal(false);
      setEditingOffer(null);
      fetchOffers();
    } catch (error: any) {
      console.error('更新充值優惠失敗:', error);
      if (error.response?.data?.errors) {
        const serverErrors: {[key: string]: string} = {};
        error.response.data.errors.forEach((err: any) => {
          serverErrors[err.path] = err.msg;
        });
        setErrors(serverErrors);
      }
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (window.confirm('確定要刪除此充值優惠嗎？')) {
      try {
        await axios.delete(`${apiConfig.API_BASE_URL}/recharge-offers/${offerId}`);
        fetchOffers();
      } catch (error) {
        console.error('刪除充值優惠失敗:', error);
      }
    }
  };

  const handleToggleActive = async (offerId: string) => {
    try {
      await axios.post(`${apiConfig.API_BASE_URL}/recharge-offers/${offerId}/toggle`);
      fetchOffers();
    } catch (error) {
      console.error('切換優惠狀態失敗:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) <= new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">充值優惠管理</h2>
          <p className="text-gray-600 mt-1">管理所有充值優惠方案</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          新增優惠
        </button>
      </div>

      {/* Offers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {offers.length === 0 ? (
          <div className="text-center py-12">
            <CurrencyDollarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暫無充值優惠</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    優惠信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    積分/金額
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    狀態
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    過期時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    創建者
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {offers.map((offer) => (
                  <tr key={offer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{offer.name}</div>
                        <div className="text-sm text-gray-500 max-w-xs truncate">{offer.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{offer.points} 分</div>
                      <div className="text-sm text-gray-500">HK${offer.amount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          offer.isActive && !isExpired(offer.expiryDate)
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {offer.isActive && !isExpired(offer.expiryDate) ? '啟用' : '停用'}
                        </span>
                        {isExpired(offer.expiryDate) && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-600 rounded-full text-xs font-medium">
                            已過期
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(offer.expiryDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {offer.createdBy.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditOffer(offer)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(offer._id)}
                          className={`${offer.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}`}
                        >
                          {offer.isActive ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">新增充值優惠</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  優惠名稱
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="例如：新春特惠"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    充值積分
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.points ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="500"
                  />
                  {errors.points && <p className="text-red-500 text-sm mt-1">{errors.points}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    充值金額 (HK$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="500.00"
                  />
                  {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={3}
                  placeholder="例如：1分 = 1元, 充值後立即可用"
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  過期時間
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.expiryDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.expiryDate && <p className="text-red-500 text-sm mt-1">{errors.expiryDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序順序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
                <p className="text-gray-500 text-sm mt-1">數字越小越靠前</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  創建
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">編輯充值優惠</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateOffer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  優惠名稱
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="例如：新春特惠"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    充值積分
                  </label>
                  <input
                    type="number"
                    value={formData.points}
                    onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.points ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="500"
                  />
                  {errors.points && <p className="text-red-500 text-sm mt-1">{errors.points}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    充值金額 (HK$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      errors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="500.00"
                  />
                  {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={3}
                  placeholder="例如：1分 = 1元, 充值後立即可用"
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  過期時間
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.expiryDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.expiryDate && <p className="text-red-500 text-sm mt-1">{errors.expiryDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  排序順序
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => handleInputChange('sortOrder', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
                <p className="text-gray-500 text-sm mt-1">數字越小越靠前</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  更新
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RechargeOfferManagement;
