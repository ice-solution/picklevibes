import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon,
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ClockIcon,
  XMarkIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import CoachAutocomplete from '../Common/CoachAutocomplete';

interface Activity {
  _id: string;
  title: string;
  description: string;
  poster?: string;
  maxParticipants: number;
  currentParticipants: number;
  price: number;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  organizer: {
    _id: string;
    name: string;
    email: string;
  };
  coaches?: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  requirements?: string;
  isActive: boolean;
  createdAt: string;
}

const ActivityManagement: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // 表單狀態
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    poster: '',
    maxParticipants: 10,
    price: 0,
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    location: '',
    requirements: '',
    coaches: [] as any[]
  });

  // 圖片上傳狀態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    fetchActivities();
  }, [currentPage, statusFilter]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setActivities(data.activities || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('獲取活動列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = () => {
    setFormData({
      title: '',
      description: '',
      poster: '',
      maxParticipants: 10,
      price: 0,
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      location: '',
      requirements: '',
      coaches: []
    });
    setSelectedFile(null);
    setImagePreview('');
    setShowCreateModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 檢查文件類型
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片文件 (PNG, JPG, JPEG)');
        return;
      }
      
      // 檢查文件大小 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片文件大小不能超過 5MB');
        return;
      }
      
      setSelectedFile(file);
      
      // 創建預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * 將 UTC 時間轉換為本地時間字符串（用於 datetime-local 輸入框）
   */
  const formatDateTimeLocal = (dateString: string): string => {
    const date = new Date(dateString);
    // 獲取本地時間的年月日時分
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleEditActivity = (activity: Activity) => {
    setFormData({
      title: activity.title,
      description: activity.description,
      poster: activity.poster || '',
      maxParticipants: activity.maxParticipants,
      price: activity.price,
      startDate: formatDateTimeLocal(activity.startDate),
      endDate: formatDateTimeLocal(activity.endDate),
      registrationDeadline: formatDateTimeLocal(activity.registrationDeadline),
      location: activity.location,
      requirements: activity.requirements || '',
      coaches: activity.coaches || []
    });
    setSelectedFile(null);
    setImagePreview(activity.poster ? getImageUrl(activity.poster) : '');
    setSelectedActivity(activity);
    setShowEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const url = selectedActivity ? `${baseUrl}/activities/${selectedActivity._id}` : `${baseUrl}/activities`;
      const method = selectedActivity ? 'PUT' : 'POST';
      
      // 創建 FormData 對象
      const formDataToSend = new FormData();
      
      // 添加表單數據
      Object.keys(formData).forEach(key => {
        const value = formData[key as keyof typeof formData];
        if (value !== '' && value !== null) {
          // 特殊處理 coaches 陣列
          if (key === 'coaches' && Array.isArray(value)) {
            value.forEach((coach, index) => {
              if (coach && typeof coach === 'object' && coach._id) {
                formDataToSend.append(`coaches[${index}]`, coach._id);
              }
            });
          } else {
            formDataToSend.append(key, String(value));
          }
        }
      });
      
      // 如果有選中的文件，添加到 FormData
      if (selectedFile) {
        formDataToSend.append('poster', selectedFile);
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '操作失敗');
      }

      alert(selectedActivity ? '活動更新成功！' : '活動創建成功！');
      setShowCreateModal(false);
      setShowEditModal(false);
      setSelectedActivity(null);
      setSelectedFile(null);
      setImagePreview('');
      fetchActivities();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteActivity = async (activityId: string, activityTitle: string) => {
    if (!window.confirm(`確定要刪除活動「${activityTitle}」嗎？此操作無法撤銷。`)) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '刪除失敗');
      }

      alert('活動刪除成功！');
      fetchActivities();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '即將開始';
      case 'ongoing':
        return '進行中';
      case 'completed':
        return '已完結';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}${imagePath}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入活動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">活動管理</h2>
          <p className="text-gray-600">管理所有活動和報名情況</p>
        </div>
        <button
          onClick={handleCreateActivity}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          創建活動
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === '' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          全部活動
        </button>
        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'upcoming' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          即將開始
        </button>
        <button
          onClick={() => setStatusFilter('ongoing')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'ongoing' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          進行中
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'completed' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          已完結
        </button>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <CalendarIcon className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暫無活動</h3>
          <p className="text-gray-600">點擊「創建活動」按鈕開始創建第一個活動</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {activities.map((activity, index) => (
            <motion.div
              key={activity._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden"
            >
              {/* Poster */}
              {activity.poster && (
                <div className="h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={getImageUrl(activity.poster)}
                    alt={activity.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="p-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                    {getStatusText(activity.status)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {activity.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {activity.description}
                </p>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>{formatDate(activity.startDate)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span>{activity.location}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <UsersIcon className="h-4 w-4 mr-2" />
                    <span>{activity.currentParticipants}/{activity.maxParticipants} 人</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                    <span>{activity.price} 積分/人</span>
                  </div>
                  {activity.coaches && activity.coaches.length > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                      <AcademicCapIcon className="h-4 w-4 mr-2" />
                      <span>教練: {activity.coaches.map(coach => coach.name).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>報名進度</span>
                    <span>{activity.maxParticipants - activity.currentParticipants} 個名額</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (activity.currentParticipants / activity.maxParticipants) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEditActivity(activity)}
                    className="flex-1 flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <PencilIcon className="h-4 w-4 mr-2" />
                    編輯
                  </button>
                  <button
                    onClick={() => handleDeleteActivity(activity._id, activity.title)}
                    className="flex-1 flex items-center justify-center px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    刪除
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
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

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedActivity ? '編輯活動' : '創建新活動'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedActivity(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動標題 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="請輸入活動標題"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動地點 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="請輸入活動地點"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入活動描述"
                    required
                  />
                </div>

                {/* 人數限制和費用 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      人數限制 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      費用 (積分) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      required
                    />
                  </div>
                </div>

                {/* 時間設置 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      報名截止時間 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動開始時間 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動結束時間 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                </div>

                {/* 活動要求 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動要求
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入活動要求（可選）"
                  />
                </div>

                {/* 教練選擇 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <AcademicCapIcon className="w-4 h-4" />
                      <span>負責教練</span>
                    </div>
                  </label>
                  <div className="space-y-2">
                    {formData.coaches.map((coach, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-50 px-3 py-2 rounded-md">
                          <span className="text-sm font-medium">{coach.name}</span>
                          <span className="text-sm text-gray-500 ml-2">({coach.email})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newCoaches = formData.coaches.filter((_, i) => i !== index);
                            setFormData({ ...formData, coaches: newCoaches });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <CoachAutocomplete
                      value=""
                      onChange={(coach) => {
                        if (coach && !formData.coaches.find(c => c._id === coach._id)) {
                          setFormData({ ...formData, coaches: [...formData.coaches, coach] });
                        }
                      }}
                      placeholder="搜索並添加教練（可選）"
                      className="w-full"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    選擇負責此活動的教練，教練將在「我的課程預約」頁面看到此活動
                  </p>
                </div>

                {/* 活動海報 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動海報
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    支持 PNG、JPG、JPEG 格式，文件大小不超過 5MB
                  </p>
                  
                  {/* 圖片預覽 */}
                  {imagePreview && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-700 mb-2">預覽：</p>
                      <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="活動海報預覽"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedActivity(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {selectedActivity ? '更新活動' : '創建活動'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityManagement;
