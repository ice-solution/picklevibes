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
  restrictedCode?: string;
  createdAt: string;
}

interface RedeemUsage {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
  };
  orderType: 'booking' | 'recharge' | 'activity';
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  usedAt: string;
}

const RedeemCodeManagement: React.FC = () => {
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  
  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // 統計數據狀態
  const [stats, setStats] = useState({
    totalCodes: 0,
    activeCodes: 0,
    totalUsage: 0,
    totalDiscount: 0
  });

  // 使用記錄 modal 狀態
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<RedeemCode | null>(null);
  const [usageRecords, setUsageRecords] = useState<RedeemUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usagePage, setUsagePage] = useState(1);
  const [usageTotalPages, setUsageTotalPages] = useState(1);
  const [usageTotal, setUsageTotal] = useState(0);
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
    applicableTypes: ['all'] as string[],
    restrictedCode: '' // 專用代碼限制
  });

  useEffect(() => {
    fetchRedeemCodes();
    fetchStats();
  }, []);

  const fetchRedeemCodes = async (page = currentPage, status = statusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (status) {
        params.append('status', status);
      }
      
      const response = await axios.get(`/redeem/admin/list?${params}`);
      setRedeemCodes(response.data.redeemCodes);
      setCurrentPage(response.data.pagination.current);
      setTotalPages(response.data.pagination.pages);
      setTotalRecords(response.data.pagination.total);
    } catch (error) {
      console.error('獲取兌換碼列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  // 獲取統計數據
  const fetchStats = async () => {
    try {
      const response = await axios.get('/redeem/admin/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('獲取統計數據失敗:', error);
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

  // 分頁處理函數
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchRedeemCodes(page, statusFilter);
  };

  // 狀態過濾器處理
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    fetchRedeemCodes(1, status);
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
      applicableTypes: code.applicableTypes,
      restrictedCode: (code as any).restrictedCode || ''
    });
    setEditingCode(code);
    setShowCreateForm(true);
  };

  const handleViewUsage = async (code: RedeemCode) => {
    setSelectedCode(code);
    setShowUsageModal(true);
    setUsagePage(1);
    await fetchUsageRecords(code._id, 1);
  };

  const fetchUsageRecords = async (codeId: string, page: number) => {
    try {
      setUsageLoading(true);
      const response = await axios.get(`/redeem/admin/${codeId}/usage`, {
        params: { page, limit: 20 }
      });
      setUsageRecords(response.data.usages);
      setUsagePage(response.data.pagination.current);
      setUsageTotalPages(response.data.pagination.pages);
      setUsageTotal(response.data.pagination.total);
    } catch (error) {
      console.error('獲取使用記錄失敗:', error);
      alert('獲取使用記錄失敗');
    } finally {
      setUsageLoading(false);
    }
  };

  const handleUsagePageChange = (page: number) => {
    if (selectedCode) {
      fetchUsageRecords(selectedCode._id, page);
    }
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
        applicableTypes: ['all'],
        restrictedCode: ''
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
        applicableTypes: ['all'],
        restrictedCode: ''
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
              <p className="text-2xl font-bold text-gray-900">{stats.totalCodes}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CalendarIcon className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">有效兌換碼</p>
              <p className="text-2xl font-bold text-gray-900">{stats.activeCodes}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <UserGroupIcon className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">總使用次數</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsage}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <CurrencyDollarIcon className="w-8 h-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">總折扣金額</p>
              <p className="text-2xl font-bold text-gray-900">HK${stats.totalDiscount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 狀態過濾器 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">篩選狀態:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleStatusFilter('')}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === '' 
                  ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => handleStatusFilter('active')}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === 'active' 
                  ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              有效
            </button>
            <button
              onClick={() => handleStatusFilter('expired')}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === 'expired' 
                  ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已過期
            </button>
            <button
              onClick={() => handleStatusFilter('inactive')}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === 'inactive' 
                  ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              已禁用
            </button>
          </div>
          <div className="ml-auto text-sm text-gray-600">
            共 {totalRecords} 個兌換碼
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
                      <button
                        onClick={() => handleViewUsage(code)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline cursor-pointer"
                        title="點擊查看使用記錄"
                      >
                        {code.name}
                      </button>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  適用範圍 *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.applicableTypes.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, applicableTypes: ['all'] });
                        } else {
                          setFormData({ ...formData, applicableTypes: [] });
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">全部適用</span>
                  </label>
                  {!formData.applicableTypes.includes('all') && (
                    <>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableTypes.includes('booking')}
                          onChange={(e) => {
                            const types = [...formData.applicableTypes];
                            if (e.target.checked) {
                              types.push('booking');
                            } else {
                              const index = types.indexOf('booking');
                              if (index > -1) types.splice(index, 1);
                            }
                            setFormData({ ...formData, applicableTypes: types });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">預約場地</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableTypes.includes('recharge')}
                          onChange={(e) => {
                            const types = [...formData.applicableTypes];
                            if (e.target.checked) {
                              types.push('recharge');
                            } else {
                              const index = types.indexOf('recharge');
                              if (index > -1) types.splice(index, 1);
                            }
                            setFormData({ ...formData, applicableTypes: types });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">充值</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableTypes.includes('activity')}
                          onChange={(e) => {
                            const types = [...formData.applicableTypes];
                            if (e.target.checked) {
                              types.push('activity');
                            } else {
                              const index = types.indexOf('activity');
                              if (index > -1) types.splice(index, 1);
                            }
                            setFormData({ ...formData, applicableTypes: types });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">活動報名</span>
                      </label>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  選擇「全部適用」或選擇特定類型。如果選擇特定類型，則只能在此類型中使用。
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  專用代碼限制（可選）
                </label>
                <select
                  value={formData.restrictedCode || ''}
                  onChange={(e) => setFormData({ ...formData, restrictedCode: e.target.value || '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">無限制</option>
                  <option value="activity">activity（僅限活動）</option>
                  <option value="booking">booking（僅限預約場地）</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  選擇「無限制」則可在所有適用範圍內使用。選擇特定代碼則只能在匹配的場景中使用。
                </p>
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

      {/* 分頁組件 */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              顯示第 {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, totalRecords)} 個，共 {totalRecords} 個兌換碼
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一頁
              </button>
              
              {/* 頁碼按鈕 */}
              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm border rounded-md ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 使用記錄 Modal */}
      {showUsageModal && selectedCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  兌換碼使用記錄
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedCode.name} ({selectedCode.code})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUsageModal(false);
                  setSelectedCode(null);
                  setUsageRecords([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {usageLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : usageRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                此兌換碼尚未被使用
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  共 {usageTotal} 筆使用記錄
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          用戶
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          訂單類型
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          原始金額
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          折扣金額
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          最終金額
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          使用時間
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usageRecords.map((usage) => (
                        <tr key={usage._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {usage.user?.name || '未知用戶'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {usage.user?.email || '-'}
                            </div>
                            {usage.user?.phone && (
                              <div className="text-xs text-gray-500">
                                {usage.user.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              usage.orderType === 'booking'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {usage.orderType === 'booking' ? '預約' : '充值'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                            HK$ {usage.originalAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                            -HK$ {usage.discountAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 font-medium">
                            HK$ {usage.finalAmount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {new Date(usage.usedAt).toLocaleString('zh-TW', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 使用記錄分頁 */}
                {usageTotalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      顯示第 {((usagePage - 1) * 20) + 1} - {Math.min(usagePage * 20, usageTotal)} 筆，共 {usageTotal} 筆
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleUsagePageChange(usagePage - 1)}
                        disabled={usagePage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一頁
                      </button>
                      <div className="flex space-x-1">
                        {Array.from({ length: Math.min(5, usageTotalPages) }, (_, i) => {
                          let pageNum: number;
                          if (usageTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (usagePage <= 3) {
                            pageNum = i + 1;
                          } else if (usagePage >= usageTotalPages - 2) {
                            pageNum = usageTotalPages - 4 + i;
                          } else {
                            pageNum = usagePage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handleUsagePageChange(pageNum)}
                              className={`px-3 py-1 text-sm border rounded-md ${
                                usagePage === pageNum
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleUsagePageChange(usagePage + 1)}
                        disabled={usagePage === usageTotalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一頁
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RedeemCodeManagement;
