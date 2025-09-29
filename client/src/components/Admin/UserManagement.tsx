import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UsersIcon, 
  PencilIcon, 
  TrashIcon,
  ShieldCheckIcon,
  StarIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | 'coach';
  membershipLevel: 'basic' | 'premium' | 'vip';
  isActive: boolean;
  createdAt: string;
  lastLogin: string;
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

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users');
      setUsers(response.data.users);
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
      case 'premium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
          <h2 className="text-xl font-bold text-gray-900">用戶管理</h2>
          <p className="text-gray-600">管理用戶角色、會員等級和狀態</p>
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMembershipColor(user.membershipLevel)}`}>
                      {user.membershipLevel === 'vip' ? 'VIP' : user.membershipLevel === 'premium' ? '高級' : '基本'}
                    </span>
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
                        onClick={() => handleEditUser(user, 'membership')}
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
    </div>
  );
};

export default UserManagement;
