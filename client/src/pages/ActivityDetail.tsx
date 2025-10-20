import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon, 
  ClockIcon,
  CurrencyDollarIcon,
  UserPlusIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon
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

const ActivityDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchActivityDetail();
    }
  }, [id]);

  const fetchActivityDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities/${id}`);
      
      if (!response.ok) {
        throw new Error('活動不存在');
      }
      
      const data = await response.json();
      setActivity(data);
    } catch (error: any) {
      setError(error.message);
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

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5001';
    return `${serverUrl}${imagePath}`;
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

  const canRegister = () => {
    if (!user) return false;
    if (!activity) return false;
    return activity.canRegister && activity.availableSpots > 0;
  };

  const getRegisterButtonText = () => {
    if (!activity) return '';
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
          <p className="mt-4 text-gray-600">載入活動詳情中...</p>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">活動不存在</h2>
          <p className="text-gray-600 mb-6">{error || '找不到指定的活動'}</p>
          <Link
            to="/activities"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            返回活動列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link
              to="/activities"
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回活動列表
            </Link>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activity.status)}`}>
              {getStatusText(activity.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
          {/* Poster */}
          {activity.poster && (
            <div className="h-64 md:h-80 bg-gray-200 overflow-hidden">
              <img
                src={getImageUrl(activity.poster)}
                alt={activity.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-8">
            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {activity.title}
            </h1>

            {/* Description */}
            <div className="prose max-w-none mb-8">
              <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                {activity.description}
              </p>
            </div>

            {/* Activity Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <div className="flex items-start">
                  <CalendarIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">活動時間</h3>
                    <p className="text-gray-600">
                      {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <MapPinIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">活動地點</h3>
                    <p className="text-gray-600">{activity.location}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <UsersIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">人數限制</h3>
                    <p className="text-gray-600">
                      {activity.totalRegistered}/{activity.maxParticipants} 人
                    </p>
                    <p className="text-sm text-gray-500">
                      剩餘 {activity.availableSpots} 個名額
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <CurrencyDollarIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">費用</h3>
                    <p className="text-gray-600">{activity.price} 積分/人</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <ClockIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">報名截止</h3>
                    <p className="text-gray-600">{formatDate(activity.registrationDeadline)}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <UsersIcon className="h-6 w-6 text-primary-600 mr-3 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">主辦方</h3>
                    <p className="text-gray-600">{activity.organizer.name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>報名進度</span>
                <span>{activity.availableSpots} 個名額</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (activity.totalRegistered / activity.maxParticipants) * 100)}%`
                  }}
                ></div>
              </div>
            </div>

            {/* Requirements */}
            {activity.requirements && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">活動要求</h3>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 whitespace-pre-line">
                    {activity.requirements}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {canRegister() ? (
                <Link
                  to={`/activities/${activity._id}/register`}
                  className="flex-1 flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  <UserPlusIcon className="h-5 w-5 mr-2" />
                  立即報名
                </Link>
              ) : (
                <button
                  disabled
                  className="flex-1 flex items-center justify-center px-6 py-3 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed font-medium"
                >
                  <UserPlusIcon className="h-5 w-5 mr-2" />
                  {getRegisterButtonText()}
                </button>
              )}
              
              {!user && (
                <Link
                  to="/login"
                  className="flex-1 flex items-center justify-center px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-medium"
                >
                  登入後報名
                </Link>
              )}
            </div>

            {/* Warning Messages */}
            {activity.isExpired && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                  <p className="text-red-800 text-sm">
                    報名已截止，無法再報名此活動
                  </p>
                </div>
              </div>
            )}

            {activity.isFull && !activity.isExpired && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 mt-0.5" />
                  <p className="text-yellow-800 text-sm">
                    活動人數已滿，無法再報名
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ActivityDetail;
