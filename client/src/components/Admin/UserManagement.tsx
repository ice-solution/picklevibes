import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UsersIcon, 
  PencilIcon, 
  TrashIcon,
  ShieldCheckIcon,
  StarIcon,
  XMarkIcon,
  CheckIcon,
  CurrencyDollarIcon,
  PlusIcon,
  ClockIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | 'coach';
  membershipLevel: 'basic' | 'vip';
  membershipExpiry?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
  balance: number;
  totalRecharged: number;
  totalSpent: number;
  recentTransactions?: Array<{
    type: 'recharge' | 'spend' | 'refund';
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  coachUsers: number;
  vipUsers: number;
  membershipStats: Array<{ _id: string; count: number }>;
  roleStats: Array<{ _id: string; count: number }>;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState<'role' | 'membership' | 'status' | null>(null);
  const [newValue, setNewValue] = useState('');
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargePoints, setRechargePoints] = useState('');
  const [rechargeReason, setRechargeReason] = useState('');
  const [showBalanceHistory, setShowBalanceHistory] = useState(false);
  const [balanceHistory, setBalanceHistory] = useState<any[]>([]);
  const [showRechargeRecords, setShowRechargeRecords] = useState(false);
  const [rechargeRecords, setRechargeRecords] = useState<any[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedRecharge, setSelectedRecharge] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<'basic' | 'vip'>('basic');
  const [vipDuration, setVipDuration] = useState(30); // VIP 期限（天數）
  
  // 創建用戶狀態
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'user' as 'user' | 'admin' | 'coach',
    membershipLevel: 'basic' as 'basic' | 'vip',
    vipDays: 30
  });
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  
  // 分頁狀態
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  
  // 搜索狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'email' | 'phone'>('name');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // 防抖搜索查詢
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms 延遲

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, pageSize, debouncedSearchQuery, searchType]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // 構建查詢參數
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString()
      });
      
      // 如果有搜索查詢，添加搜索參數
      if (debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim());
        params.append('searchType', searchType);
      }
      
      const response = await axios.get(`/users?${params.toString()}`);
      setUsers(response.data.users);
      setTotalPages(response.data.pagination.pages);
      setTotalUsers(response.data.pagination.total);
    } catch (error) {
      console.error('獲取用戶列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/users/stats');
      setStats(response.data);
    } catch (error) {
      console.error('獲取用戶統計失敗:', error);
    }
  };

  const handleEditUser = (user: User, field: 'role' | 'membership' | 'status') => {
    setSelectedUser(user);
    setEditingField(field);
    
    let value = '';
    if (field === 'role') {
      value = user.role;
    } else if (field === 'membership') {
      value = user.membershipLevel;
    } else if (field === 'status') {
      value = user.isActive.toString();
    }
    
    setNewValue(value);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser || !editingField) return;

    try {
      let endpoint = '';
      let data = {};

      switch (editingField) {
        case 'role':
          endpoint = `/users/${selectedUser._id}/role`;
          data = { role: newValue };
          break;
        case 'membership':
          endpoint = `/users/${selectedUser._id}/membership`;
          data = { membershipLevel: newValue };
          break;
        case 'status':
          endpoint = `/users/${selectedUser._id}/status`;
          data = { isActive: newValue === 'true' };
          break;
      }

      await axios.put(endpoint, data);
      await fetchUsers();
      setShowEditModal(false);
      setSelectedUser(null);
      setEditingField(null);
    } catch (error: any) {
      alert(error.response?.data?.message || '更新失敗');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('確定要刪除這個用戶嗎？此操作無法撤銷。')) return;

    try {
      await axios.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || '刪除失敗');
    }
  };

  const handleRechargeUser = (user: User) => {
    setSelectedUser(user);
    setRechargePoints('');
    setRechargeReason('');
    setShowRechargeModal(true);
  };

  const handleSubmitRecharge = async () => {
    if (!selectedUser || !rechargePoints || !rechargeReason) return;
    
    try {
      await axios.post(`/users/${selectedUser._id}/manual-recharge`, {
        points: parseInt(rechargePoints),
        reason: rechargeReason
      });
      
      setShowRechargeModal(false);
      fetchUsers(); // 刷新用戶列表
      alert('充值成功！');
    } catch (error) {
      console.error('充值失敗:', error);
      alert('充值失敗，請稍後再試');
    }
  };

  const handleViewBalanceHistory = async (user: User) => {
    try {
      const response = await axios.get(`/users/${user._id}/balance-history`);
      setBalanceHistory(response.data.transactions);
      setSelectedUser(user);
      setShowBalanceHistory(true);
    } catch (error) {
      console.error('獲取積分歷史失敗:', error);
    }
  };

  const handleViewRechargeRecords = async (user: User) => {
    try {
      const response = await axios.get(`/users/${user._id}/recharge-records`);
      setRechargeRecords(response.data.rechargeRecords);
      setSelectedUser(user);
      setShowRechargeRecords(true);
    } catch (error) {
      console.error('獲取充值記錄失敗:', error);
    }
  };

  const handleChangeRechargeStatus = (recharge: any) => {
    setSelectedRecharge(recharge);
    setNewStatus(recharge.status);
    setStatusReason('');
    setShowStatusModal(true);
  };

  const handleSubmitStatusChange = async () => {
    if (!selectedRecharge || !selectedUser || !newStatus) return;
    
    try {
      await axios.put(`/users/${selectedUser._id}/recharge-records/${selectedRecharge._id}/status`, {
        status: newStatus,
        reason: statusReason
      });
      
      setShowStatusModal(false);
      // 重新獲取充值記錄
      handleViewRechargeRecords(selectedUser);
      alert('狀態更新成功！');
    } catch (error) {
      console.error('更新狀態失敗:', error);
      alert('更新狀態失敗，請稍後再試');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'coach': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getMembershipColor = (level: string) => {
    switch (level) {
      case 'vip': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleChangeMembership = (user: User) => {
    setSelectedUser(user);
    setSelectedMembership(user.membershipLevel);
    setShowMembershipModal(true);
  };

  const handleSubmitMembershipChange = async () => {
    if (!selectedUser) return;
    
    try {
      const requestData: any = {
        membershipLevel: selectedMembership
      };
      
      // 如果設置為 VIP，添加期限
      if (selectedMembership === 'vip') {
        requestData.days = vipDuration;
      }
      
      await axios.put(`/users/${selectedUser._id}/membership`, requestData);
      
      setShowMembershipModal(false);
      fetchUsers(); // 重新獲取用戶列表
      alert(`會員等級已更新為 ${selectedMembership === 'vip' ? `VIP會員 (${vipDuration}天)` : '普通會員'}！`);
    } catch (error) {
      console.error('更新會員等級失敗:', error);
      alert('更新會員等級失敗，請稍後再試');
    }
  };

  // 創建用戶相關函數
  const handleCreateUser = () => {
    setNewUser({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'user',
      membershipLevel: 'basic',
      vipDays: 30
    });
    setSendWelcomeEmail(true);
    setShowCreateUserModal(true);
  };

  const handleSubmitCreateUser = async () => {
    // 基本驗證
    if (!newUser.name || !newUser.email || !newUser.password || !newUser.phone) {
      alert('請填寫所有必填欄位');
      return;
    }

    if (newUser.password.length < 8) {
      alert('密碼至少需要8個字符');
      return;
    }

    if (!/^[0-9]+$/.test(newUser.phone)) {
      alert('電話號碼只能包含數字');
      return;
    }

    try {
      const requestData = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        phone: newUser.phone,
        role: newUser.role,
        membershipLevel: newUser.membershipLevel,
        vipDays: newUser.vipDays,
        sendWelcomeEmail: sendWelcomeEmail
      };

      await axios.post('/users/create', requestData);
      
      setShowCreateUserModal(false);
      fetchUsers(); // 重新獲取用戶列表
      alert('用戶創建成功！');
    } catch (error: any) {
      console.error('創建用戶失敗:', error);
      alert(error.response?.data?.message || '創建用戶失敗，請稍後再試');
    }
  };

  const formatMembershipExpiry = (expiry: string | undefined) => {
    if (!expiry) return '無限期';
    const date = new Date(expiry);
    const now = new Date();
    const isExpired = date < now;
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (isExpired) {
      return '已過期';
    } else if (daysLeft <= 7) {
      return `${daysLeft}天後過期`;
    } else {
      return date.toLocaleDateString('zh-TW');
    }
  };

  // 分頁相關函數
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 重置到第一頁
  };

  // 搜索處理函數
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // 搜索時重置到第一頁
  };

  const handleSearchTypeChange = (type: 'name' | 'email' | 'phone') => {
    setSearchType(type);
    setCurrentPage(1); // 切換搜索類型時重置到第一頁
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentPage(1);
  };

  // 生成分頁按鈕
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    
    // 計算開始和結束頁碼
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // 如果結束頁碼接近總頁碼，調整開始頁碼
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // 上一頁按鈕
    buttons.push(
      <button
        key="prev"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-2 text-sm font-medium rounded-lg ${
          currentPage === 1
            ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
        }`}
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </button>
    );
    
    // 第一頁和省略號
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis1" className="px-3 py-2 text-sm text-gray-500">
            ...
          </span>
        );
      }
    }
    
    // 中間頁碼
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-2 text-sm font-medium rounded-lg ${
            i === currentPage
              ? 'text-white bg-primary-600 border border-primary-600'
              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      );
    }
    
    // 省略號和最後一頁
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis2" className="px-3 py-2 text-sm text-gray-500">
            ...
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {totalPages}
        </button>
      );
    }
    
    // 下一頁按鈕
    buttons.push(
      <button
        key="next"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-3 py-2 text-sm font-medium rounded-lg ${
          currentPage === totalPages
            ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
        }`}
      >
        <ChevronRightIcon className="w-4 h-4" />
      </button>
    );
    
    return buttons;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center">
              <UsersIcon className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">總用戶數</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center">
              <CheckIcon className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">活躍用戶</p>
                <p className="text-2xl font-bold text-gray-900">{stats.activeUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center">
              <ShieldCheckIcon className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">管理員</p>
                <p className="text-2xl font-bold text-gray-900">{stats.adminUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex items-center">
              <StarIcon className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">VIP會員</p>
                <p className="text-2xl font-bold text-gray-900">{stats.vipUsers}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 用戶列表 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">用戶管理</h2>
              <p className="text-gray-600">管理用戶角色、會員等級和狀態</p>
            </div>
            <button
              onClick={handleCreateUser}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              創建用戶
            </button>
          </div>
          
          {/* 搜索框 */}
          <div className="flex items-center space-x-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder={`按${searchType === 'name' ? '姓名' : searchType === 'email' ? '郵箱' : '電話'}搜索用戶...`}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-700">搜索類型:</label>
              <select
                value={searchType}
                onChange={(e) => handleSearchTypeChange(e.target.value as 'name' | 'email' | 'phone')}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="name">姓名</option>
                <option value="email">郵箱</option>
                <option value="phone">電話</option>
              </select>
            </div>
          </div>
          
          {/* 搜索結果提示 */}
          {searchQuery && (
            <div className="mt-3 text-sm text-gray-600">
              搜索 "{searchQuery}" ({searchType === 'name' ? '姓名' : searchType === 'email' ? '郵箱' : '電話'}) - 找到 {totalUsers} 個結果
            </div>
          )}
        </div>

        {/* 分頁控制欄 */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                顯示第 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalUsers)} 項，共 {totalUsers} 項
              </span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value={5}>每頁 5 項</option>
                <option value={10}>每頁 10 項</option>
                <option value={20}>每頁 20 項</option>
                <option value={50}>每頁 50 項</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用戶信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  會員等級
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  積分餘額
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
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-sm text-gray-500">{user.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {user.role === 'admin' ? '管理員' : user.role === 'coach' ? '教練' : '用戶'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMembershipColor(user.membershipLevel)}`}>
                        {user.membershipLevel === 'vip' ? 'VIP會員' : '普通會員'}
                      </span>
                      {user.membershipLevel === 'vip' && user.membershipExpiry && (
                        <span className="text-xs text-gray-500 mt-1">
                          {formatMembershipExpiry(user.membershipExpiry)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <CurrencyDollarIcon className="w-4 h-4 text-green-600 mr-1" />
                      <span className="text-sm font-medium text-gray-900">{user.balance || 0}</span>
                      <div className="ml-2 text-xs text-gray-500">
                        <div>充值: {user.totalRecharged || 0}</div>
                        <div>消費: {user.totalSpent || 0}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? '啟用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditUser(user, 'role')}
                        className="text-blue-600 hover:text-blue-900"
                        title="修改角色"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleChangeMembership(user)}
                        className="text-yellow-600 hover:text-yellow-900"
                        title="修改會員等級"
                      >
                        <StarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user, 'status')}
                        className="text-green-600 hover:text-green-900"
                        title="修改狀態"
                      >
                        <ShieldCheckIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRechargeUser(user)}
                        className="text-purple-600 hover:text-purple-900"
                        title="手動充值"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewBalanceHistory(user)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="查看積分歷史"
                      >
                        <ClockIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewRechargeRecords(user)}
                        className="text-cyan-600 hover:text-cyan-900"
                        title="查看充值記錄"
                      >
                        <CurrencyDollarIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        className="text-red-600 hover:text-red-900"
                        title="刪除用戶"
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

        {/* 分頁導航 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                第 {currentPage} 頁，共 {totalPages} 頁
              </div>
              <div className="flex items-center space-x-2">
                {renderPaginationButtons()}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* 編輯模態框 */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                編輯 {selectedUser.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editingField === 'role' && '角色'}
                  {editingField === 'membership' && '會員等級'}
                  {editingField === 'status' && '狀態'}
                </label>
                
                {editingField === 'role' && (
                  <select
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="user">用戶</option>
                    <option value="coach">教練</option>
                    <option value="admin">管理員</option>
                  </select>
                )}

                {editingField === 'membership' && (
                  <select
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="basic">基本</option>
                    <option value="premium">高級</option>
                    <option value="vip">VIP</option>
                  </select>
                )}

                {editingField === 'status' && (
                  <select
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="true">啟用</option>
                    <option value="false">禁用</option>
                  </select>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 充值模態框 */}
      {showRechargeModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">手動充值</h3>
              <button
                onClick={() => setShowRechargeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  為 <span className="font-medium">{selectedUser.name}</span> 充值積分
                </p>
                <p className="text-xs text-gray-500">當前餘額: {selectedUser.balance || 0} 分</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  充值積分
                </label>
                <input
                  type="number"
                  value={rechargePoints}
                  onChange={(e) => setRechargePoints(e.target.value)}
                  placeholder="輸入充值積分數量"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  充值原因
                </label>
                <textarea
                  value={rechargeReason}
                  onChange={(e) => setRechargeReason(e.target.value)}
                  placeholder="請輸入充值原因（如：補償用戶、活動獎勵等）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRechargeModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitRecharge}
                  disabled={!rechargePoints || !rechargeReason}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確認充值
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 積分歷史模態框 */}
      {showBalanceHistory && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedUser.name} 的積分歷史
              </h3>
              <button
                onClick={() => setShowBalanceHistory(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">當前餘額</p>
                  <p className="text-xl font-bold text-green-600">{selectedUser.balance || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">總充值</p>
                  <p className="text-xl font-bold text-blue-600">{selectedUser.totalRecharged || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">總消費</p>
                  <p className="text-xl font-bold text-red-600">{selectedUser.totalSpent || 0}</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {balanceHistory.map((transaction, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          transaction.type === 'recharge' ? 'bg-green-100 text-green-800' :
                          transaction.type === 'spend' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {transaction.type === 'recharge' ? '充值' :
                           transaction.type === 'spend' ? '消費' : '退款'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`font-medium ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{transaction.description}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleString('zh-TW')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {balanceHistory.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暫無積分交易記錄
              </div>
            )}
          </div>
        </div>
      )}

      {/* 充值記錄模態框 */}
      {showRechargeRecords && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-6xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedUser.name} 的充值記錄
              </h3>
              <button
                onClick={() => setShowRechargeRecords(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">積分</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">積分狀態</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">支付方式</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rechargeRecords.map((record) => (
                    <tr key={record._id}>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {record._id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium text-green-600">+{record.points}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-medium">HK${record.amount}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === 'completed' ? 'bg-green-100 text-green-800' :
                          record.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          record.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.status === 'completed' ? '已完成' :
                           record.status === 'pending' ? '待處理' :
                           record.status === 'failed' ? '失敗' : '已取消'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.pointsAdded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {record.pointsAdded ? '已添加' : '未添加'}
                          </span>
                          {record.pointsDeducted && (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              已扣除
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {record.payment.method === 'manual' ? '手動充值' :
                         record.payment.method === 'stripe' ? 'Stripe' :
                         record.payment.method === 'alipay' ? '支付寶' : '微信支付'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{record.description}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(record.createdAt).toLocaleString('zh-TW')}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleChangeRechargeStatus(record)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                          title="修改狀態"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rechargeRecords.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                暫無充值記錄
              </div>
            )}
          </div>
        </div>
      )}

      {/* 狀態修改模態框 */}
      {showStatusModal && selectedRecharge && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">修改充值狀態</h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  充值記錄: {selectedRecharge.points} 分 (HK${selectedRecharge.amount})
                </p>
                <p className="text-xs text-gray-500">當前狀態: {
                  selectedRecharge.status === 'completed' ? '已完成' :
                  selectedRecharge.status === 'pending' ? '待處理' :
                  selectedRecharge.status === 'failed' ? '失敗' : '已取消'
                }</p>
                <div className="mt-2 flex space-x-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedRecharge.pointsAdded ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    積分: {selectedRecharge.pointsAdded ? '已添加' : '未添加'}
                  </span>
                  {selectedRecharge.pointsDeducted && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      已扣除
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  新狀態
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="pending">待處理</option>
                  <option value="completed">已完成</option>
                  <option value="failed">失敗</option>
                  <option value="cancelled">已取消</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  修改原因
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="請輸入修改原因（可選）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>注意：</strong>
                  {newStatus === 'completed' && ' 確認後將為用戶增加積分'}
                  {newStatus === 'cancelled' && ' 取消後將扣除用戶積分'}
                  {newStatus === 'failed' && ' 標記為失敗，不會影響用戶積分'}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitStatusChange}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  確認修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 會員等級管理模態框 */}
      {showMembershipModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">修改會員等級</h3>
              <button
                onClick={() => setShowMembershipModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  用戶: {selectedUser.name} ({selectedUser.email})
                </p>
                <p className="text-xs text-gray-500">當前等級: {
                  selectedUser.membershipLevel === 'vip' ? 'VIP會員' : '普通會員'
                }</p>
                {selectedUser.membershipLevel === 'vip' && selectedUser.membershipExpiry && (
                  <p className="text-xs text-gray-500">
                    到期時間: {formatMembershipExpiry(selectedUser.membershipExpiry)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選擇會員等級
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="membershipLevel"
                      value="basic"
                      checked={selectedMembership === 'basic'}
                      onChange={(e) => setSelectedMembership(e.target.value as 'basic' | 'vip')}
                      className="mr-2"
                    />
                    <span className="text-sm">普通會員</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="membershipLevel"
                      value="vip"
                      checked={selectedMembership === 'vip'}
                      onChange={(e) => setSelectedMembership(e.target.value as 'basic' | 'vip')}
                      className="mr-2"
                    />
                    <span className="text-sm">VIP會員</span>
                  </label>
                </div>
              </div>

              {selectedMembership === 'vip' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VIP 會員期限（天數）
                    </label>
                    <select
                      value={vipDuration}
                      onChange={(e) => setVipDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={7}>7 天</option>
                      <option value={15}>15 天</option>
                      <option value={30}>30 天</option>
                      <option value={60}>60 天</option>
                      <option value={90}>90 天</option>
                      <option value={180}>180 天</option>
                    </select>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>注意：</strong>設置為VIP會員後，會籍將從今天開始計算，有效期為 {vipDuration} 天。
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowMembershipModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitMembershipChange}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  確認修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 創建用戶模態框 */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">創建新用戶</h3>
                <button
                  onClick={() => setShowCreateUserModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* 姓名 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入姓名"
                  />
                </div>

                {/* 郵箱 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    郵箱 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入郵箱"
                  />
                </div>

                {/* 密碼 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    密碼 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="至少8個字符，包含字母和數字"
                  />
                </div>

                {/* 電話 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    電話 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入電話號碼"
                  />
                </div>

                {/* 角色 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    角色
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'user' | 'admin' | 'coach' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="user">普通用戶</option>
                    <option value="coach">教練</option>
                    <option value="admin">管理員</option>
                  </select>
                </div>

                {/* 會員等級 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    會員等級
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="newUserMembershipLevel"
                        value="basic"
                        checked={newUser.membershipLevel === 'basic'}
                        onChange={(e) => setNewUser({ ...newUser, membershipLevel: e.target.value as 'basic' | 'vip' })}
                        className="mr-2"
                      />
                      <span className="text-sm">普通會員</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="newUserMembershipLevel"
                        value="vip"
                        checked={newUser.membershipLevel === 'vip'}
                        onChange={(e) => setNewUser({ ...newUser, membershipLevel: e.target.value as 'basic' | 'vip' })}
                        className="mr-2"
                      />
                      <span className="text-sm">VIP會員</span>
                    </label>
                  </div>
                </div>

                {/* VIP 期限 */}
                {newUser.membershipLevel === 'vip' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      VIP 會員期限（天數）
                    </label>
                    <select
                      value={newUser.vipDays}
                      onChange={(e) => setNewUser({ ...newUser, vipDays: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value={7}>7 天</option>
                      <option value={15}>15 天</option>
                      <option value={30}>30 天</option>
                      <option value={60}>60 天</option>
                      <option value={90}>90 天</option>
                      <option value={180}>180 天</option>
                    </select>
                  </div>
                )}

                {/* 發送歡迎郵件選項 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    郵件通知
                  </label>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sendWelcomeEmail"
                      checked={sendWelcomeEmail}
                      onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                      className="mr-2 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="sendWelcomeEmail" className="text-sm text-gray-700">
                      發送歡迎郵件給新用戶
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    包含登入信息和帳戶詳情的歡迎郵件
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitCreateUser}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  創建用戶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
