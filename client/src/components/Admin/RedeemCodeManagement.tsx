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
  TrashIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { PRICING_SLOT_NAMES } from '../../constants/courtPricing';
import { useLockedStoreId } from '../../contexts/StoreAdminContext';

interface RedeemCode {
  _id: string;
  batchId?: string | null;
  code: string;
  name: string;
  description: string;
  type: 'fixed' | 'percentage';
  value: number;
  minAmount: number;
  maxDiscount: number;
  usageLimit: number;
  userUsageLimit: number;
  isIndependentCode?: boolean;
  commissionRate?: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  totalUsed: number;
  totalDiscount: number;
  applicableTypes: string[];
  applicablePricingSlots?: string[];
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
  orderType: 'booking' | 'recharge' | 'activity' | 'product' | 'eshop';
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  commissionRate?: number | null;
  commissionAmount?: number;
  usedAt: string;
}

interface RedeemCodeGroup {
  _id: string; // batchId
  name: string;
  description?: string;
  type: 'fixed' | 'percentage';
  value: number;
  minAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  userUsageLimit: number;
  isIndependentCode?: boolean;
  commissionRate?: number | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  applicableTypes: string[];
  applicablePricingSlots?: string[];
  createdAt: string;
  totalCodes: number;
  totalUsed: number;
  totalDiscount: number;
}

const SYNC_MAX_QUANTITY = 100;
const BULK_MAX_QUANTITY = 10000;

function ApplicablePricingSlotsPicker({
  applicableTypes,
  value,
  onChange,
}: {
  applicableTypes: string[];
  value: string[];
  onChange: (slots: string[]) => void;
}) {
  if (!applicableTypes.includes('all') && !applicableTypes.includes('booking')) {
    return null;
  }

  return (
    <div className="mt-3 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
      <label className="block text-sm font-semibold text-indigo-900 mb-2">
        適用預約時段
      </label>
      <p className="text-xs text-indigo-700 mb-3">
        不勾選任何時段 = 預約場地不限時段；有勾選則只能在所選時段使用
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRICING_SLOT_NAMES.map((slotName) => (
          <label key={slotName} className="flex items-center">
            <input
              type="checkbox"
              checked={value.includes(slotName)}
              onChange={(e) => {
                const slots = [...value];
                if (e.target.checked) {
                  slots.push(slotName);
                } else {
                  const idx = slots.indexOf(slotName);
                  if (idx > -1) slots.splice(idx, 1);
                }
                onChange(slots);
              }}
              className="mr-2"
            />
            <span className="text-sm text-gray-800">
              {slotName}{slotName === '貓頭鷹時間' ? ' 🦉' : ''}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const RedeemCodeManagement: React.FC = () => {
  const lockedStoreId = useLockedStoreId();
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [redeemGroups, setRedeemGroups] = useState<RedeemCodeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCode, setEditingCode] = useState<RedeemCode | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [groupView, setGroupView] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<RedeemCodeGroup | null>(null);
  const [showGroupEditModal, setShowGroupEditModal] = useState(false);
  const [groupEditLoading, setGroupEditLoading] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    type: 'fixed' as 'fixed' | 'percentage',
    value: 0,
    minAmount: 0,
    maxDiscount: 0,
    commissionRate: 5,
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    applicableTypes: ['all'] as string[],
    applicablePricingSlots: [] as string[],
  });
  
  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQ, setSearchQ] = useState<string>('');
  
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
  const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);

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
    isIndependentCode: false,
    commissionRate: 5,
    quantity: 1,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    applicableTypes: ['all'] as string[],
    applicablePricingSlots: [] as string[],
    restrictedCode: '' // 專用代碼限制
  });

  useEffect(() => {
    fetchRedeemCodes();
    fetchStats();
  }, [lockedStoreId]);

  const appendStoreParam = (params: URLSearchParams) => {
    if (lockedStoreId) {
      params.append('store', lockedStoreId);
    }
  };

  const fetchRedeemCodes = async (
    page = currentPage,
    status = statusFilter,
    options?: { batchId?: string | null; forceGroupView?: boolean }
  ) => {
    try {
      setLoading(true);
      const isGroup = options?.forceGroupView ?? groupView;
      const batchId = options?.batchId ?? selectedBatchId;

      if (isGroup) {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10'
        });
        if (status) params.append('status', status);
        if (searchQ.trim()) params.append('q', searchQ.trim());
        appendStoreParam(params);
        const response = await axios.get(`/redeem/admin/groups?${params}`);
        setRedeemGroups(response.data.groups || []);
        setRedeemCodes([]); // 群組模式預設不顯示明細，需點選批次才載入
        setCurrentPage(response.data.pagination.current);
        setTotalPages(response.data.pagination.pages);
        setTotalRecords(response.data.pagination.total);
        return;
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });
      
      if (status) {
        params.append('status', status);
      }
      if (searchQ.trim()) params.append('q', searchQ.trim());
      // 非群組模式：只顯示不屬於批次的兌換碼
      params.append('standaloneOnly', 'true');
      appendStoreParam(params);

      const response = await axios.get(`/redeem/admin/list?${params}`);
      setRedeemCodes(response.data.redeemCodes);
      setRedeemGroups([]);
      setSelectedBatchId(null);
      setCurrentPage(response.data.pagination.current);
      setTotalPages(response.data.pagination.pages);
      setTotalRecords(response.data.pagination.total);
    } catch (error) {
      console.error('獲取兌換碼列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchDetails = async (batchId: string, page = 1, status = statusFilter) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        batchId,
      });
      if (status) params.append('status', status);
      if (searchQ.trim()) params.append('q', searchQ.trim());
      appendStoreParam(params);
      const response = await axios.get(`/redeem/admin/list?${params}`);
      setRedeemCodes(response.data.redeemCodes || []);
      setSelectedBatchId(batchId);
      setCurrentPage(response.data.pagination.current);
      setTotalPages(response.data.pagination.pages);
      setTotalRecords(response.data.pagination.total);
    } catch (error) {
      console.error('獲取批次兌換碼明細失敗:', error);
      alert('獲取批次明細失敗');
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
      if (groupView && selectedBatchId) {
        fetchBatchDetails(selectedBatchId, 1, statusFilter);
      } else {
        fetchRedeemCodes(1, statusFilter);
      }
    } catch (error) {
      console.error('更新狀態失敗:', error);
    }
  };

  // 分頁處理函數
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (groupView && selectedBatchId) {
      fetchBatchDetails(selectedBatchId, page, statusFilter);
    } else {
      fetchRedeemCodes(page, statusFilter);
    }
  };

  // 狀態過濾器處理
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    if (groupView) {
      // 群組模式：先刷新群組列表；若已選批次，也一併刷新明細
      fetchRedeemCodes(1, status, { forceGroupView: true });
      if (selectedBatchId) {
        fetchBatchDetails(selectedBatchId, 1, status);
      }
    } else {
      fetchRedeemCodes(1, status);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    if (groupView) {
      fetchRedeemCodes(1, statusFilter, { forceGroupView: true });
      if (selectedBatchId) fetchBatchDetails(selectedBatchId, 1, statusFilter);
    } else {
      fetchRedeemCodes(1, statusFilter);
    }
  };

  const handleClearSearch = () => {
    setSearchQ('');
    setCurrentPage(1);
    if (groupView) {
      fetchRedeemCodes(1, statusFilter, { forceGroupView: true });
      if (selectedBatchId) fetchBatchDetails(selectedBatchId, 1, statusFilter);
    } else {
      fetchRedeemCodes(1, statusFilter);
    }
  };

  const handleToggleGroupView = async () => {
    const next = !groupView;
    setGroupView(next);
    setSelectedBatchId(null);
    setCurrentPage(1);
    if (next) {
      setRedeemCodes([]);
      await fetchRedeemCodes(1, statusFilter, { forceGroupView: true });
    } else {
      setRedeemCodes([]);
      await fetchRedeemCodes(1, statusFilter, { forceGroupView: false });
    }
  };

  const handleOpenGroup = async (batchId: string) => {
    // 明細只在群組模式顯示
    if (!groupView) return;
    setCurrentPage(1);
    await fetchBatchDetails(batchId, 1, statusFilter);
  };

  const handleBackToGroups = async () => {
    setSelectedBatchId(null);
    setRedeemCodes([]);
    setCurrentPage(1);
    await fetchRedeemCodes(1, statusFilter, { forceGroupView: true });
  };

  const openGroupEditModal = (g: RedeemCodeGroup) => {
    setEditingGroup(g);
    setGroupFormData({
      name: g.name || '',
      description: g.description || '',
      type: g.type,
      value: g.value,
      minAmount: g.minAmount || 0,
      maxDiscount: (g.maxDiscount as any) || 0,
      commissionRate: (g.commissionRate as any) ?? 5,
      isActive: !!g.isActive,
      validFrom: new Date(g.validFrom).toISOString().split('T')[0],
      validUntil: new Date(g.validUntil).toISOString().split('T')[0],
      applicableTypes: Array.isArray(g.applicableTypes) ? g.applicableTypes : ['all'],
      applicablePricingSlots: Array.isArray(g.applicablePricingSlots) ? g.applicablePricingSlots : [],
    });
    setShowGroupEditModal(true);
  };

  const handleUpdateGroupBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      setGroupEditLoading(true);
      const submit = {
        ...groupFormData,
        validFrom: new Date(groupFormData.validFrom).toISOString(),
        validUntil: new Date(groupFormData.validUntil).toISOString(),
        maxDiscount: groupFormData.maxDiscount === 0 ? 0 : groupFormData.maxDiscount,
      };
      await axios.put(`/redeem/admin/batch/${editingGroup._id}`, submit);
      setShowGroupEditModal(false);
      setEditingGroup(null);
      // refresh groups + selected batch details
      await fetchRedeemCodes(1, statusFilter, { forceGroupView: true });
      if (selectedBatchId) {
        await fetchBatchDetails(selectedBatchId, 1, statusFilter);
      }
    } catch (error: any) {
      console.error('批次更新失敗:', error);
      alert(error.response?.data?.message || '批次更新失敗');
    } finally {
      setGroupEditLoading(false);
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
      isIndependentCode: (code as any).isIndependentCode ?? false,
      commissionRate: (code as any).commissionRate ?? 5,
      quantity: 1,
      validFrom: new Date(code.validFrom).toISOString().split('T')[0],
      validUntil: new Date(code.validUntil).toISOString().split('T')[0],
      applicableTypes: code.applicableTypes,
      applicablePricingSlots: code.applicablePricingSlots || [],
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

      if (formData.isIndependentCode && formData.quantity && formData.quantity > 1) {
        alert('編輯模式不會批次新增兌換碼；請改用「創建兌換碼」來一次生成多個。');
      }
      
      const submitData = {
        ...formData,
        usageLimit: formData.usageLimit && formData.usageLimit.trim() !== '' ? parseInt(formData.usageLimit) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString()
      };

      // 獨立兌換碼由後端自動生成；前端不送 code，避免驗證失敗
      if (formData.isIndependentCode) {
        delete (submitData as any).code;
      }
      // 編輯模式不需要 quantity
      delete (submitData as any).quantity;

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
        isIndependentCode: false,
        commissionRate: 5,
        quantity: 1,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        applicableTypes: ['all'],
        applicablePricingSlots: [],
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

  const handleExportBatch = async (batchId: string, batchName?: string) => {
    try {
      setExportingBatchId(batchId);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/redeem/admin/batch/${batchId}/export`, {
        responseType: 'blob',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeName = (batchName || 'batch').replace(/[^\w\u4e00-\u9fff-]+/g, '_');
      link.download = `redeem-codes-${safeName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('匯出批次兌換碼失敗:', error);
      alert(error.response?.data?.message || '匯出失敗');
    } finally {
      setExportingBatchId(null);
    }
  };

  const handleCreateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      
      const submitData = {
        ...formData,
        ...(lockedStoreId ? { store: lockedStoreId } : {}),
        usageLimit: formData.usageLimit && formData.usageLimit.trim() !== '' ? parseInt(formData.usageLimit) : undefined,
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString()
      };

      // 獨立兌換碼由後端自動生成；前端不送 code
      if (formData.isIndependentCode) {
        delete (submitData as any).code;
      }

      const useBackgroundJob =
        formData.isIndependentCode && formData.quantity > SYNC_MAX_QUANTITY;

      if (useBackgroundJob) {
        const res = await axios.post('/redeem/admin/batch-jobs', submitData);
        alert(
          `已提交背景任務，將建立 ${formData.quantity} 個兌換碼。\n` +
          `任務 ID：${res.data.jobId}\n` +
          `完成後請在「群組顯示」查看並匯出。`
        );
      } else {
        const res = await axios.post('/redeem/admin/create', submitData);

        const createdCodes: string[] = Array.isArray(res.data?.redeemCodes)
          ? res.data.redeemCodes.map((c: any) => c?.code).filter(Boolean)
          : [];

        if (formData.isIndependentCode && createdCodes.length > 0 && createdCodes.length <= 20) {
          alert(`已生成 ${createdCodes.length} 個兌換碼：\n\n${createdCodes.join(', ')}`);
        } else if (formData.isIndependentCode && createdCodes.length > 20) {
          alert(`已生成 ${createdCodes.length} 個兌換碼，請至「群組顯示」查看明細或匯出。`);
        }
      }
      
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
        isIndependentCode: false,
        commissionRate: 5,
        quantity: 1,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        applicableTypes: ['all'],
        applicablePricingSlots: [],
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
        <div className="flex items-center space-x-3">
          <button
            onClick={handleToggleGroupView}
            className={`px-4 py-2 rounded-lg border transition-colors duration-200 ${
              groupView
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            title="切換為批次群組顯示（適合獨立兌換碼）"
          >
            群組顯示
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
          >
            <PlusIcon className="w-5 h-5" />
            <span>創建兌換碼</span>
          </button>
        </div>
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
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">搜尋:</span>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
                if (e.key === 'Escape') handleClearSearch();
              }}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="輸入兌換碼 / 名稱 / 描述"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md text-sm"
            >
              搜尋
            </button>
            <button
              onClick={handleClearSearch}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm"
              disabled={!searchQ}
            >
              清除
            </button>
          </div>
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
            {groupView ? `共 ${totalRecords} 個批次` : `共 ${totalRecords} 個兌換碼`}
          </div>
        </div>
      </div>

      {/* 群組列表 */}
      {groupView && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">獨立兌換碼批次</h3>
            <div className="text-sm text-gray-600">在此模式可查看明細／批次修改</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    批次
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
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {redeemGroups.map((g) => (
                  <tr key={g._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{g.name}</div>
                      <div className="text-xs text-gray-500">
                        批次ID {String(g._id).slice(-6)} ・ {new Date(g.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {g.type === 'fixed' ? `減 HK$${g.value}` : `${g.value}折`}
                      </div>
                      {g.minAmount > 0 && (
                        <div className="text-xs text-gray-500">最低消費 HK${g.minAmount}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        已用 {g.totalUsed} / {g.totalCodes}
                      </div>
                      <div className="text-xs text-gray-500">
                        總折扣 HK$ {Number(g.totalDiscount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(g.validFrom).toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        至 {new Date(g.validUntil).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleOpenGroup(g._id)}
                          className="text-primary-600 hover:text-primary-800 hover:underline"
                          title="查看該批次所有兌換碼"
                        >
                          查看明細
                        </button>
                        <button
                          onClick={() => openGroupEditModal(g)}
                          className="text-indigo-600 hover:text-indigo-900 hover:underline"
                          title="批次修改此群組的內容（一次更新整批兌換碼）"
                        >
                          批次修改
                        </button>
                        <button
                          onClick={() => handleExportBatch(g._id, g.name)}
                          disabled={exportingBatchId === g._id}
                          className="inline-flex items-center text-emerald-600 hover:text-emerald-800 hover:underline disabled:opacity-50"
                          title="匯出此批次全部兌換碼為 XLSX"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4 mr-0.5" />
                          {exportingBatchId === g._id ? '匯出中…' : '匯出 XLSX'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {redeemGroups.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={5}>
                      暫無批次資料（新建立的獨立兌換碼會自動分批顯示）
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 兌換碼列表（非群組模式才顯示；群組明細只在群組模式顯示） */}
      {!groupView && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              兌換碼列表
            </h3>
            <p className="text-sm text-gray-500">不含批次／獨立兌換碼群組內的碼；批次請用「群組顯示」查看</p>
          </div>
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
                    {code.applicablePricingSlots && code.applicablePricingSlots.length > 0 && (
                      <div className="text-xs text-indigo-600 mt-1">
                        時段：{code.applicablePricingSlots.join('、')}
                      </div>
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
      )}

      {/* 批次明細（僅群組模式可見） */}
      {groupView && selectedBatchId && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">批次兌換碼明細</h3>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  const group = redeemGroups.find((g) => g._id === selectedBatchId);
                  handleExportBatch(selectedBatchId, group?.name);
                }}
                disabled={exportingBatchId === selectedBatchId}
                className="inline-flex items-center px-3 py-1.5 text-sm text-emerald-700 border border-emerald-300 rounded-md hover:bg-emerald-50 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                {exportingBatchId === selectedBatchId ? '匯出中…' : '匯出 XLSX'}
              </button>
              <button
                onClick={handleBackToGroups}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
              >
                返回群組列表
              </button>
            </div>
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
                {redeemCodes.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500" colSpan={6}>
                      此批次暫無資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 群組批次修改 Modal */}
      {showGroupEditModal && editingGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              批次修改（將套用到此批次全部兌換碼）
            </h3>

            <form onSubmit={handleUpdateGroupBatch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名稱 *</label>
                  <input
                    type="text"
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">狀態 *</label>
                  <select
                    value={groupFormData.isActive ? 'active' : 'inactive'}
                    onChange={(e) => setGroupFormData({ ...groupFormData, isActive: e.target.value === 'active' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="active">啟用</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                <textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">折扣類型 *</label>
                  <select
                    value={groupFormData.type}
                    onChange={(e) => setGroupFormData({ ...groupFormData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="fixed">固定金額</option>
                    <option value="percentage">百分比折扣</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">折扣值 *</label>
                  <input
                    type="number"
                    value={groupFormData.value}
                    onChange={(e) => setGroupFormData({ ...groupFormData, value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最低消費金額</label>
                  <input
                    type="number"
                    value={groupFormData.minAmount}
                    onChange={(e) => setGroupFormData({ ...groupFormData, minAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最大折扣金額</label>
                  <input
                    type="number"
                    value={groupFormData.maxDiscount}
                    onChange={(e) => setGroupFormData({ ...groupFormData, maxDiscount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">佣金比例 *</label>
                <select
                  value={groupFormData.commissionRate}
                  onChange={(e) => setGroupFormData({ ...groupFormData, commissionRate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
                  <input
                    type="date"
                    value={groupFormData.validFrom}
                    onChange={(e) => setGroupFormData({ ...groupFormData, validFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 *</label>
                  <input
                    type="date"
                    value={groupFormData.validUntil}
                    onChange={(e) => setGroupFormData({ ...groupFormData, validUntil: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">適用範圍 *</label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={groupFormData.applicableTypes.includes('all')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setGroupFormData({ ...groupFormData, applicableTypes: ['all'] });
                        } else {
                          setGroupFormData({ ...groupFormData, applicableTypes: [] });
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">全部適用</span>
                  </label>
                  {!groupFormData.applicableTypes.includes('all') && (
                    <>
                      {(['booking', 'recharge', 'activity'] as const).map((t) => (
                        <label key={t} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={groupFormData.applicableTypes.includes(t)}
                            onChange={(e) => {
                              const types = [...groupFormData.applicableTypes];
                              if (e.target.checked) types.push(t);
                              else {
                                const idx = types.indexOf(t);
                                if (idx > -1) types.splice(idx, 1);
                              }
                              setGroupFormData({ ...groupFormData, applicableTypes: types });
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">
                            {t === 'booking' ? '預約場地' : t === 'recharge' ? '充值' : '活動報名'}
                          </span>
                        </label>
                      ))}
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={groupFormData.applicableTypes.includes('product') || groupFormData.applicableTypes.includes('eshop')}
                          onChange={(e) => {
                            let types = groupFormData.applicableTypes.filter((x) => x !== 'product' && x !== 'eshop');
                            if (e.target.checked) types.push('product', 'eshop');
                            setGroupFormData({ ...groupFormData, applicableTypes: types });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">只限商城使用</span>
                      </label>
                    </>
                  )}
                </div>
                <ApplicablePricingSlotsPicker
                  applicableTypes={groupFormData.applicableTypes}
                  value={groupFormData.applicablePricingSlots}
                  onChange={(slots) => setGroupFormData({ ...groupFormData, applicablePricingSlots: slots })}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupEditModal(false);
                    setEditingGroup(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={groupEditLoading}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
                >
                  {groupEditLoading ? '更新中...' : '批次更新'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    disabled={formData.isIndependentCode}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="例如: WELCOME20"
                    required={!formData.isIndependentCode}
                  />
                  <label className="flex items-center mt-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.isIndependentCode}
                      onChange={(e) => setFormData({ ...formData, isIndependentCode: e.target.checked, code: e.target.checked ? '' : formData.code })}
                      className="mr-2"
                    />
                    需要獨立兌換碼（每個碼只能使用一次，系統自動生成）
                  </label>
                  {formData.isIndependentCode && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        生成數量 *
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={BULK_MAX_QUANTITY}
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        1–{SYNC_MAX_QUANTITY} 個即時建立；超過 {SYNC_MAX_QUANTITY} 個將於後台背景建立（最多 {BULK_MAX_QUANTITY} 個），完成後於「群組顯示」查看或匯出。
                      </p>
                    </div>
                  )}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  佣金比例 *
                </label>
                <select
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={false}
                >
                  <option value={0}>0%</option>
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                </select>
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
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.applicableTypes.includes('product') || formData.applicableTypes.includes('eshop')}
                          onChange={(e) => {
                            let types = formData.applicableTypes.filter(t => t !== 'product' && t !== 'eshop');
                            if (e.target.checked) {
                              types = types.filter(t => t !== 'all'); // 勾選只限商城時改為特定類型
                              types.push('product', 'eshop');
                            }
                            setFormData({ ...formData, applicableTypes: types });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">只限商城使用</span>
                      </label>
                    </>
                  )}
                </div>
                <ApplicablePricingSlotsPicker
                  applicableTypes={formData.applicableTypes}
                  value={formData.applicablePricingSlots}
                  onChange={(slots) => setFormData({ ...formData, applicablePricingSlots: slots })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  適用範圍二選一：<strong>全部適用</strong>（無限制）或<strong>勾選特定類型</strong>（僅在勾選的類型中使用）。只限商城 = 僅限線上商店／商品訂單。
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
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          佣金比例
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          佣金金額
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
                                : usage.orderType === 'recharge'
                                ? 'bg-green-100 text-green-800'
                                : usage.orderType === 'activity'
                                ? 'bg-purple-100 text-purple-800'
                                : (usage.orderType === 'product' || usage.orderType === 'eshop')
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {usage.orderType === 'booking' ? '預約' : usage.orderType === 'recharge' ? '充值' : usage.orderType === 'activity' ? '活動' : (usage.orderType === 'product' || usage.orderType === 'eshop') ? '商城' : usage.orderType || '—'}
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
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                            {usage.commissionRate != null ? `${usage.commissionRate}%` : '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-yellow-700 font-medium">
                            {usage.commissionAmount != null ? usage.commissionAmount.toLocaleString() : '—'}
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
