import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PlusIcon, 
  TicketIcon, 
  CalendarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface RedeemCode {
  _id: string;
  code: string;
  name: string;
  description: string;
  type: 'fixed' | 'percentage';
  value: number;
  minAmount: number;
  maxDiscount: number;
  usageLimit: number;
  userUsageLimit: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  totalUsed: number;
  totalDiscount: number;
  applicableTypes: string[];
  createdAt: string;
}

const RedeemCodeManagement: React.FC = () => {
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'fixed' as 'fixed' | 'percentage',
    value: 0,
    minAmount: 0,
    maxDiscount: 0,
    usageLimit: '',
    userUsageLimit: 1,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    applicableTypes: ['all'] as string[]
  });

  useEffect(() => {
    fetchRedeemCodes();
  }, []);

  const fetchRedeemCodes = async () => {
    try {
      const response = await axios.get('/redeem/admin/list');
      setRedeemCodes(response.data.redeemCodes);
    } catch (error) {
      console.error('獲取兌換碼列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await axios.put(`/redeem/admin/${id}/status`, { isActive });
      fetchRedeemCodes();
    } catch (error) {
      console.error('更新狀態失敗:', error);
    }
  };

  const handleEdit = (code: RedeemCode) => {
    setFormData({
      code: code.code,
      name: code.name,
      description: code.description || '',
      type: code.type,
      value: code.value,
      minAmount: code.minAmount,
      maxDiscount: code.maxDiscount || 0,
      usageLimit: code.usageLimit ? code.usageLimit.toString() : '',
      userUsageLimit: code.userUsageLimit,
      validFrom: new Date(code.validFrom).toISOString().split('T')[0],
      validUntil: new Date(code.validUntil).toISOString().split('T')[0],
      applicableTypes: code.applicableTypes
    });
    setEditingCode(code);
    setShowCreateForm(true);
  };

  const handleUpdateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;

    try {
      setCreateLoading(true);
      
      const submitData = {
        ...formData,
        usageLimit: formData.usageLimit && formData.usageLimit.trim() !== '' ? parseInt(formData.usageLimit) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString()
      };

      await axios.put(`/redeem/admin/${editingCode._id}`, submitData);
      
      // 重置表單
      setFormData({
        code: '',
        name: '',
        description: '',
        type: 'fixed',
        value: 0,
        minAmount: 0,
        maxDiscount: 0,
        usageLimit: '',
        userUsageLimit: 1,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        applicableTypes: ['all']
      });
      
      setShowCreateForm(false);
      setEditingCode(null);
      fetchRedeemCodes();
    } catch (error: any) {
      console.error('更新兌換碼失敗:', error);
      alert(error.response?.data?.message || '更新兌換碼失敗');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      
      const submitData = {
        ...formData,
        usageLimit: formData.usageLimit && formData.usageLimit.trim() !== '' ? parseInt(formData.usageLimit) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString()
      };

      await axios.post('/redeem/admin/create', submitData);
      
      // 重置表單
      setFormData({
        code: '',
        name: '',
        description: '',
        type: 'fixed',
        value: 0,
        minAmount: 0,
        maxDiscount: 0,
        usageLimit: '',
        userUsageLimit: 1,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        applicableTypes: ['all']
      });
      
      setShowCreateForm(false);
      fetchRedeemCodes();
    } catch (error: any) {
      console.error('創建兌換碼失敗:', error);
      alert(error.response?.data?.message || '創建兌換碼失敗');
    } finally {
      setCreateLoading(false);
    }
  };

  const getStatusBadge = (code: RedeemCode) => {
    const now = new Date();
    const validFrom = new Date(code.validFrom);
    const validUntil = new Date(code.validUntil);

    if (!code.isActive) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">已禁用</span>;
    }
    
    if (now < validFrom) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-full text-xs">未開始</span>;
    }
    
    if (now > validUntil) {
      return <span className="px-2 py-1 bg-red-100 text-red-600 rounded-full text-xs">已過期</span>;
    }
    
    if (code.usageLimit && code.totalUsed >= code.usageLimit) {
      return <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-full text-xs">已用完</span>;
    }
    
    return <span className="px-2 py-1 bg-green-100 text-green-600 rounded-full text-xs">有效</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 標題和操作按鈕 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">兌換碼管理</h2>
          <p className="text-gray-600">管理所有兌換碼和促銷活動</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5" />
          <span>創建兌換碼</span>
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TicketIcon className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">總兌換碼</p>
              <p className="text-2xl font-bold text-gray-900">{redeemCodes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CalendarIcon className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">有效兌換碼</p>
              <p className="text-2xl font-bold text-gray-900">
                {redeemCodes.filter(code => {
                  const now = new Date();
                  return code.isActive && 
                         now >= new Date(code.validFrom) && 
                         now <= new Date(code.validUntil);
                }).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserGroupIcon className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">總使用次數</p>
              <p className="text-2xl font-bold text-gray-900">
                {redeemCodes.reduce((sum, code) => sum + code.totalUsed, 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">總折扣金額</p>
              <p className="text-2xl font-bold text-gray-900">
                HK${redeemCodes.reduce((sum, code) => sum + code.totalDiscount, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 兌換碼列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">兌換碼列表</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  兌換碼
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  類型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  使用情況
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  有效期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  狀態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {redeemCodes.map((code) => (
                <tr key={code._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{code.name}</div>
                      <div className="text-sm text-gray-500">{code.code}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {code.type === 'fixed' ? `減 HK$${code.value}` : `${code.value}折`}
                    </div>
                    {code.minAmount > 0 && (
                      <div className="text-xs text-gray-500">最低消費 HK${code.minAmount}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {code.totalUsed} / {code.usageLimit || '∞'} 次
                    </div>
                    <div className="text-xs text-gray-500">
                      每用戶 {code.userUsageLimit} 次
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(code.validFrom).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      至 {new Date(code.validUntil).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(code)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(code)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="編輯兌換碼"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(code._id, !code.isActive)}
                        className={`${
                          code.isActive 
                            ? 'text-red-600 hover:text-red-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                        title={code.isActive ? '禁用兌換碼' : '啟用兌換碼'}
                      >
                        {code.isActive ? '禁用' : '啟用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 創建兌換碼表單 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCode ? '編輯兌換碼' : '創建兌換碼'}
            </h3>
            
            <form onSubmit={editingCode ? handleUpdateRedeemCode : handleCreateRedeemCode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    兌換碼 *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="例如: WELCOME20"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    名稱 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="例如: 新用戶歡迎折扣"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                  placeholder="兌換碼描述..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    折扣類型 *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'fixed' | 'percentage' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="fixed">固定金額</option>
                    <option value="percentage">百分比折扣</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    折扣值 *
                  </label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={formData.type === 'fixed' ? '例如: 50' : '例如: 20'}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.type === 'fixed' ? '固定金額 (HK$)' : '百分比折扣 (%)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最低消費金額
                  </label>
                  <input
                    type="number"
                    value={formData.minAmount}
                    onChange={(e) => setFormData({ ...formData, minAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大折扣金額
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="0 (無限制)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    總使用次數限制
                  </label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="留空表示無限制"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    每用戶使用次數 *
                  </label>
                  <input
                    type="number"
                    value={formData.userUsageLimit}
                    onChange={(e) => setFormData({ ...formData, userUsageLimit: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    開始日期 *
                  </label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    結束日期 *
                  </label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
                >
                  {createLoading 
                    ? (editingCode ? '更新中...' : '創建中...') 
                    : (editingCode ? '更新兌換碼' : '創建兌換碼')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedeemCodeManagement;
