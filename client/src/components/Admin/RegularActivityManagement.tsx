import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  XMarkIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import apiConfig from '../../config/api.js';

interface RegularActivity {
  _id: string;
  title: string;
  description: string;
  introduction: string;
  poster?: string;
  requirements?: string;
  fee?: number;
  isActive: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedUntil?: string | null;
  isEffectivelyPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

const RegularActivityManagement: React.FC = () => {
  const apiBaseUrl = apiConfig.API_BASE_URL;
  const [activities, setActivities] = useState<RegularActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<RegularActivity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 表單狀態
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    introduction: '',
    requirements: '',
    fee: 0,
    isActive: true
  });

  // 圖片上傳狀態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [pinModalActivity, setPinModalActivity] = useState<RegularActivity | null>(null);
  const [pinUntilValue, setPinUntilValue] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [currentPage]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });

      const response = await fetch(`${apiBaseUrl}/regular-activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setActivities(data.activities || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('獲取恆常活動列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = () => {
    setFormData({
      title: '',
      description: '',
      introduction: '',
      requirements: '',
      fee: 0,
      isActive: true
    });
    setSelectedFile(null);
    setImagePreview('');
    setShowCreateModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片文件 (PNG, JPG, JPEG)');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片大小不能超過 5MB');
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.introduction) {
      alert('請填寫所有必填字段');
      return;
    }

    try {
      const submitFormData = new FormData();
      submitFormData.append('title', formData.title);
      submitFormData.append('description', formData.description);
      submitFormData.append('introduction', formData.introduction);
      submitFormData.append('requirements', formData.requirements || '');
      submitFormData.append('fee', String(formData.fee ?? 0));
      submitFormData.append('isActive', formData.isActive.toString());
      
      if (selectedFile) {
        submitFormData.append('poster', selectedFile);
      }

      const url = selectedActivity 
        ? `${apiBaseUrl}/regular-activities/${selectedActivity._id}`
        : `${apiBaseUrl}/regular-activities`;
      
      const method = selectedActivity ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: submitFormData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '操作失敗');
      }

      alert(selectedActivity ? '恆常活動更新成功' : '恆常活動創建成功');
      setShowCreateModal(false);
      setShowEditModal(false);
      setSelectedActivity(null);
      setSelectedFile(null);
      setImagePreview('');
      fetchActivities();
    } catch (error: any) {
      console.error('提交失敗:', error);
      alert(error.message || '操作失敗，請重試');
    }
  };

  const handleEdit = (activity: RegularActivity) => {
    setSelectedActivity(activity);
    setFormData({
      title: activity.title,
      description: activity.description,
      introduction: activity.introduction,
      requirements: activity.requirements || '',
      fee: activity.fee ?? 0,
      isActive: activity.isActive
    });
    setImagePreview(activity.poster ? `${apiBaseUrl}${activity.poster}` : '');
    setSelectedFile(null);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此恆常活動嗎？')) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/regular-activities/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('刪除失敗');
      }

      alert('恆常活動刪除成功');
      fetchActivities();
    } catch (error) {
      console.error('刪除失敗:', error);
      alert('刪除失敗，請重試');
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `${apiBaseUrl}${imagePath}`;
  };

  const formatPinUntil = (pinnedUntil?: string | null) => {
    if (!pinnedUntil) return '直至手動取消';
    return new Date(pinnedUntil).toLocaleString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const toDatetimeLocalValue = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openPinModal = (activity: RegularActivity) => {
    setPinModalActivity(activity);
    setPinUntilValue(toDatetimeLocalValue(activity.pinnedUntil));
  };

  const submitPin = async (pinned: boolean) => {
    if (!pinModalActivity) return;
    try {
      setPinSaving(true);
      const body: { pinned: boolean; pinnedUntil?: string | null } = { pinned };
      if (pinned) {
        body.pinnedUntil = pinUntilValue
          ? new Date(pinUntilValue).toISOString()
          : null;
      }
      const response = await fetch(`${apiBaseUrl}/regular-activities/${pinModalActivity._id}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || '置頂設定失敗');
      }
      setPinModalActivity(null);
      setPinUntilValue('');
      fetchActivities();
    } catch (error: any) {
      alert(error.message || '置頂設定失敗');
    } finally {
      setPinSaving(false);
    }
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">恆常活動管理</h2>
        <button
          onClick={handleCreateActivity}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          新增恆常活動
        </button>
      </div>

      {/* Activities List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                海報
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                標題
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                描述
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                收費
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                狀態
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                置頂
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {activities.map((activity) => (
              <tr key={activity._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {activity.poster ? (
                    <img
                      src={getImageUrl(activity.poster)}
                      alt={activity.title}
                      className="h-16 w-16 object-cover rounded"
                    />
                  ) : (
                    <div className="h-16 w-16 bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-2xl">🏓</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-500 line-clamp-2 max-w-xs">
                    {activity.description}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {activity.fee != null && activity.fee > 0 ? `HK$ ${activity.fee}` : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    activity.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.isActive ? '啟用' : '停用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {activity.isEffectivelyPinned ? (
                    <div>
                      <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                        <BookmarkIcon className="h-4 w-4" />
                        置頂中
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{formatPinUntil(activity.pinnedUntil)}</p>
                    </div>
                  ) : activity.isPinned ? (
                    <span className="text-xs text-gray-400">已過期</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => openPinModal(activity)}
                      className={activity.isEffectivelyPinned ? 'text-amber-600 hover:text-amber-800' : 'text-gray-500 hover:text-amber-600'}
                      title="置頂設定"
                    >
                      <BookmarkIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(activity)}
                      className="text-primary-600 hover:text-primary-900"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(activity._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一頁
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 border rounded-lg ${
                  currentPage === page
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

      {/* Pin Modal */}
      {pinModalActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">置頂設定</h3>
                <p className="text-sm text-gray-500 mt-1">{pinModalActivity.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinModalActivity(null);
                  setPinUntilValue('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
              置頂的班會顯示在活動中心「恆常活動」列表最前。可不填截止時間，直至你手動取消置頂。
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              置頂至（選填）
            </label>
            <input
              type="datetime-local"
              value={pinUntilValue}
              onChange={(e) => setPinUntilValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">留空 = 長期置頂，直至按「取消置頂」</p>

            <div className="flex flex-wrap gap-2 justify-end">
              {pinModalActivity.isEffectivelyPinned && (
                <button
                  type="button"
                  disabled={pinSaving}
                  onClick={() => submitPin(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  取消置頂
                </button>
              )}
              <button
                type="button"
                disabled={pinSaving}
                onClick={() => submitPin(true)}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {pinSaving ? '儲存中…' : pinModalActivity.isEffectivelyPinned ? '更新置頂' : '確認置頂'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {selectedActivity ? '編輯恆常活動' : '新增恆常活動'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedActivity(null);
                    setSelectedFile(null);
                    setImagePreview('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    標題 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    required
                    maxLength={1000}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    介紹 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.introduction}
                    onChange={(e) => setFormData({ ...formData, introduction: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={5}
                    required
                    maxLength={2000}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    活動要求
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    收費（HK$，0 表示免費或另議）
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={formData.fee ?? 0}
                    onChange={(e) => setFormData({ ...formData, fee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    海報圖片
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      <img
                        src={imagePreview}
                        alt="預覽"
                        className="h-32 w-32 object-cover rounded"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">啟用</span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedActivity(null);
                      setSelectedFile(null);
                      setImagePreview('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {selectedActivity ? '更新' : '創建'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RegularActivityManagement;

