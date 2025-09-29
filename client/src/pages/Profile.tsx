import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  CogIcon,
  BellIcon
} from '@heroicons/react/24/outline';

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    preferences: {
      notifications: {
        email: user?.preferences?.notifications?.email ?? true,
        sms: user?.preferences?.notifications?.sms ?? false
      },
      skillLevel: user?.preferences?.skillLevel || 'beginner'
    }
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('preferences.')) {
      const keys = name.split('.');
      setFormData(prev => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [keys[1]]: {
            ...(prev.preferences[keys[1] as keyof typeof prev.preferences] as any),
            [keys[2]]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
          }
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // 清除錯誤
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = '姓名為必填項目';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '電話號碼為必填項目';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = '請輸入有效的電話號碼';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
    } catch (error: any) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      preferences: {
        notifications: {
          email: user?.preferences?.notifications?.email ?? true,
          sms: user?.preferences?.notifications?.sms ?? false
        },
        skillLevel: user?.preferences?.skillLevel || 'beginner'
      }
    });
    setErrors({});
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">個人資料</h1>
          <p className="text-gray-600">管理您的個人信息和偏好設置</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主要內容 */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">基本信息</h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-outline"
                    >
                      編輯資料
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                {/* 一般錯誤信息 */}
                {errors.general && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{errors.general}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* 姓名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      姓名
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`input-field ${!isEditing ? 'bg-gray-50' : ''} ${
                        errors.name ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  {/* 電子郵件 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      電子郵件
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="input-field bg-gray-50"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      電子郵件地址無法修改
                    </p>
                  </div>

                  {/* 電話號碼 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      電話號碼
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`input-field ${!isEditing ? 'bg-gray-50' : ''} ${
                        errors.phone ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  {/* 會員等級 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      會員等級
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium capitalize">
                        {user?.membershipLevel || 'Basic'}
                      </span>
                      <span className="text-sm text-gray-500">
                        {user?.membershipLevel === 'basic' && '基本會員'}
                        {user?.membershipLevel === 'premium' && '高級會員'}
                        {user?.membershipLevel === 'vip' && 'VIP會員'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 編輯按鈕 */}
                {isEditing && (
                  <div className="mt-8 flex gap-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn-secondary"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`btn-primary ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isLoading ? '保存中...' : '保存更改'}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>

            {/* 偏好設置 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CogIcon className="w-5 h-5" />
                  偏好設置
                </h2>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* 技能等級 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      匹克球技能等級
                    </label>
                    <select
                      name="preferences.skillLevel"
                      value={formData.preferences.skillLevel}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="beginner">初學者</option>
                      <option value="intermediate">中級</option>
                      <option value="advanced">高級</option>
                      <option value="expert">專家</option>
                    </select>
                  </div>

                  {/* 通知設置 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      通知偏好
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="preferences.notifications.email"
                          checked={formData.preferences.notifications.email}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-3 text-sm text-gray-700">
                          電子郵件通知
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="preferences.notifications.sms"
                          checked={formData.preferences.notifications.sms}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-3 text-sm text-gray-700">
                          簡訊通知
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 */}
          <div className="space-y-6">
            {/* 帳戶信息 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">帳戶信息</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">註冊時間</p>
                    <p className="font-medium">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-TW') : '未知'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BellIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">最後登入</p>
                    <p className="font-medium">
                      {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString('zh-TW') : '未知'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 快速操作 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              <div className="space-y-3">
                <button className="w-full btn-outline text-left">
                  修改密碼
                </button>
                <button className="w-full btn-outline text-left">
                  下載數據
                </button>
                <button className="w-full text-red-600 hover:text-red-700 text-left">
                  刪除帳戶
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
