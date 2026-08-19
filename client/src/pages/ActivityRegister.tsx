import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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
        throw new Error(t('activityRegister.errors.activityNotFound'));
      }
      
      const data = await response.json();
      setActivity(data);
      
      // 檢查是否可以報名
      if (!data.canRegister) {
        if (data.isExpired) {
          setError(t('activityRegister.errors.cannotRegister.expired'));
        } else if (data.isFull) {
          setError(t('activityRegister.errors.cannotRegister.full'));
        } else {
          setError(t('activityRegister.errors.cannotRegister.general'));
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
      setError(t('activityRegister.errors.participantsMin'));
      return;
    }

    if (registrationData.participantCount > activity.availableSpots) {
      setError(t('activityRegister.errors.participantsLimit', { n: activity.availableSpots }));
      return;
    }

    if (!registrationData.contactInfo.email || !registrationData.contactInfo.phone) {
      setError(t('activityRegister.errors.contactMissing'));
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
        throw new Error(data.message || t('activityRegister.errors.submitFailed'));
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
    const locale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-TW';
    return new Date(dateString).toLocaleDateString(locale, {
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
          <p className="mt-4 text-gray-600">{t('activityRegister.loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !activity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('activityRegister.invalid.title')}</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/activities"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            {t('activityRegister.invalid.backToList')}
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('activityRegister.success.title')}</h2>
          <p className="text-gray-600 mb-6">
            {t('activityRegister.success.message', { title: activity?.title })}
            <br />
            {t('activityRegister.success.redirect')}
          </p>
          <Link
            to="/my-activities"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('activityRegister.success.cta')}
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
              {t('activityRegister.header.backToDetail')}
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">{t('activityRegister.header.title')}</h1>
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
                  <span>
                    {activity?.totalRegistered}/{activity?.maxParticipants} {t('common.people')}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                  <span>{t('activityRegister.sidebar.pointsPerPerson', { n: activity?.price })}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('activityRegister.sidebar.remaining')}:</span>
                  <span className="font-semibold text-gray-900">
                    {activity?.availableSpots} {t('common.people')}
                  </span>
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
              <h2 className="text-xl font-bold text-gray-900 mb-6">{t('activityRegister.form.fillInfo')}</h2>

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
                    {t('activityRegister.form.participantCount')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={registrationData.participantCount}
                    onChange={(e) => handleInputChange('participantCount', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    {Array.from({ length: Math.min(10, activity?.availableSpots || 1) }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        {num} {t('common.people')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('activityRegister.form.maxSelectable', { n: Math.min(10, activity?.availableSpots || 1) })}
                  </p>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('activityRegister.form.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={registrationData.contactInfo.email}
                      onChange={(e) => handleInputChange('contactInfo.email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={t('activityRegister.form.email')}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('activityRegister.form.phone')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={registrationData.contactInfo.phone}
                      onChange={(e) => handleInputChange('contactInfo.phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder={t('activityRegister.form.phone')}
                      required
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('activityRegister.form.notes')}
                  </label>
                  <textarea
                    value={registrationData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={t('activityRegister.form.notesPlaceholder')}
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('activityRegister.form.charCount', { n: registrationData.notes.length })}
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
                  <h3 className="font-semibold text-gray-900 mb-3">{t('activityRegister.cost.title')}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('activityRegister.cost.unitPrice')}:</span>
                      <span className="text-gray-900">{t('activityRegister.sidebar.pointsPerPerson', { n: activity?.price })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('activityRegister.cost.peopleCount')}:</span>
                      <span className="text-gray-900">
                        {registrationData.participantCount} {t('common.people')}
                      </span>
                    </div>
                    {redeemData && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t('activityRegister.cost.original')}:</span>
                          <span className="text-gray-900">
                            {baseCost} {t('common.currency')}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-green-600">
                          <span>{t('activityRegister.cost.discount')}:</span>
                          <span>
                            -{redeemData.discountAmount.toFixed(0)} {t('common.currency')}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-gray-200 pt-2">
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-900">{t('activityRegister.cost.total')}:</span>
                        <span className="text-primary-600">
                          {totalCost} {t('common.currency')}
                        </span>
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
                    {t('activityRegister.buttons.cancel')}
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting || !activity?.canRegister}
                    className="flex-1 flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting
                      ? t('activityRegister.buttons.submitting')
                      : t('activityRegister.buttons.submit', { totalPts: totalCost })}
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
