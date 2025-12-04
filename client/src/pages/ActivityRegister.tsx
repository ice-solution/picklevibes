import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  CalendarIcon, 
  MapPinIcon, 
  UsersIcon, 
  CurrencyDollarIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import RedeemCodeInput from '../components/Common/RedeemCodeInput';

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

interface RegistrationForm {
  participantCount: number;
  contactInfo: {
    email: string;
    phone: string;
  };
  notes: string;
}

const ActivityRegister: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redeemData, setRedeemData] = useState<any>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationForm>({
    participantCount: 1,
    contactInfo: {
      email: user?.email || '',
      phone: user?.phone || ''
    },
    notes: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (id) {
      fetchActivityDetail();
    }
  }, [id, user, navigate]);

  const fetchActivityDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities/${id}`);
      
      if (!response.ok) {
        throw new Error('活動不存在');
      }
      
      const data = await response.json();
      setActivity(data);
      
      // 檢查是否可以報名
      if (!data.canRegister) {
        if (data.isExpired) {
          setError('活動報名已截止');
        } else if (data.isFull) {
          setError('活動人數已滿');
        } else {
          setError('活動不可報名');
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setRegistrationData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof RegistrationForm] as object),
          [child]: value
        }
      }));
    } else {
      setRegistrationData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activity) return;

    // 驗證表單
    if (registrationData.participantCount < 1) {
      setError('參加人數至少為1人');
      return;
    }

    if (registrationData.participantCount > activity.availableSpots) {
      setError(`人數已到上限，剩餘名額：${activity.availableSpots}人`);
      return;
    }

    if (!registrationData.contactInfo.email || !registrationData.contactInfo.phone) {
      setError('請填寫完整的聯繫信息');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/activities/${id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...registrationData,
          redeemCodeId: redeemData?.id || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '報名失敗');
      }

      setSuccess(true);
      
      // 3秒後跳轉到我的活動頁面
      setTimeout(() => {
        navigate('/my-activities');
      }, 3000);

    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
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

  const baseCost = activity ? activity.price * registrationData.participantCount : 0;
  const totalCost = redeemData ? redeemData.finalAmount : baseCost;

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

  if (error && !activity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">無法報名</h2>
          <p className="text-gray-600 mb-6">{error}</p>
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">報名成功！</h2>
          <p className="text-gray-600 mb-6">
            您已成功報名活動「{activity?.title}」<br />
            系統將在3秒後跳轉到我的活動頁面
          </p>
          <Link
            to="/my-activities"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            立即查看我的活動
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
              to={`/activities/${id}`}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              返回活動詳情
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">活動報名</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Activity Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl shadow-lg p-6 sticky top-8"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">{activity?.title}</h2>
              
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>{formatDate(activity?.startDate || '')}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <MapPinIcon className="h-4 w-4 mr-2" />
                  <span>{activity?.location}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  <span>{activity?.totalRegistered}/{activity?.maxParticipants} 人</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                  <span>{activity?.price} 積分/人</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">剩餘名額：</span>
                  <span className="font-semibold text-gray-900">{activity?.availableSpots} 人</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Registration Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">填寫報名信息</h2>

              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Participant Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    參加人數 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={registrationData.participantCount}
                    onChange={(e) => handleInputChange('participantCount', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {Array.from({ length: Math.min(10, activity?.availableSpots || 1) }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num} 人</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    最多可選擇 {Math.min(10, activity?.availableSpots || 1)} 人
                  </p>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      聯繫郵箱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={registrationData.contactInfo.email}
                      onChange={(e) => handleInputChange('contactInfo.email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="請輸入郵箱地址"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      聯繫電話 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={registrationData.contactInfo.phone}
                      onChange={(e) => handleInputChange('contactInfo.phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="請輸入電話號碼"
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    備註
                  </label>
                  <textarea
                    value={registrationData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="如有特殊需求或備註，請在此填寫"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {registrationData.notes.length}/200 字符
                  </p>
                </div>

                {/* Redeem Code */}
                <RedeemCodeInput
                  amount={baseCost}
                  orderType="activity"
                  onRedeemApplied={(data) => setRedeemData(data)}
                  onRedeemRemoved={() => setRedeemData(null)}
                  restrictedCode="activity"
                />

                {/* Cost Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">費用明細</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">單價：</span>
                      <span className="text-gray-900">{activity?.price} 積分/人</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">人數：</span>
                      <span className="text-gray-900">{registrationData.participantCount} 人</span>
                    </div>
                    {redeemData && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">原價：</span>
                          <span className="text-gray-900">{baseCost} 積分</span>
                        </div>
                        <div className="flex justify-between text-sm text-green-600">
                          <span>折扣：</span>
                          <span>-{redeemData.discountAmount.toFixed(0)} 積分</span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-900">總計：</span>
                        <span className="text-primary-600">{totalCost} 積分</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex space-x-4">
                  <Link
                    to={`/activities/${id}`}
                    className="flex-1 flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting || !activity?.canRegister}
                    className="flex-1 flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? '提交中...' : `確認報名 (${totalCost} 積分)`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityRegister;
