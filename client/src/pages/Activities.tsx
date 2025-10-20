import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon, 
  ClockIcon,
  CurrencyDollarIcon,
  EyeIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';

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
  requirements?: string;
  canRegister: boolean;
  isExpired: boolean;
  isFull: boolean;
  totalRegistered: number;
  availableSpots: number;
}

const Activities: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { user } = useAuth();

  useEffect(() => {
    fetchActivities();
  }, [currentPage, statusFilter]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '9'
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities?${params}`);
      const data = await response.json();
      
      setActivities(data.activities || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('獲取活動列表失敗:', error);
    } finally {
      setLoading(false);
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
    
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5001';
    return `${serverUrl}${imagePath}`;
  };

  const canRegister = (activity: Activity) => {
    if (!user) return false;
    return activity.canRegister && activity.availableSpots > 0;
  };

  const getRegisterButtonText = (activity: Activity) => {
    if (activity.isExpired) return '報名已截止';
    if (activity.isFull) return '人數已滿';
    if (activity.availableSpots <= 0) return '人數已到上限';
    return '立即報名';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入活動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">活動中心</h1>
            <p className="mt-2 text-gray-600">探索精彩的匹克球活動，與其他玩家一起享受運動樂趣</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-4 mb-6">
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

        {/* Activities Grid */}
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <CalendarIcon className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">暫無活動</h3>
            <p className="text-gray-600">目前沒有符合條件的活動，請稍後再來查看</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity, index) => (
              <motion.div
                key={activity._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
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
                      {formatDate(activity.registrationDeadline)} 截止
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
                      <span>{activity.totalRegistered}/{activity.maxParticipants} 人</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                      <span>{activity.price} 積分/人</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>報名進度</span>
                      <span>{activity.availableSpots} 個名額</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (activity.totalRegistered / activity.maxParticipants) * 100)}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <Link
                      to={`/activities/${activity._id}`}
                      className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4 mr-2" />
                      查看詳情
                    </Link>
                    {canRegister(activity) ? (
                      <Link
                        to={`/activities/${activity._id}/register`}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        <UserPlusIcon className="h-4 w-4 mr-2" />
                        立即報名
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
                      >
                        <UserPlusIcon className="h-4 w-4 mr-2" />
                        {getRegisterButtonText(activity)}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8">
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
      </div>
    </div>
  );
};

export default Activities;
