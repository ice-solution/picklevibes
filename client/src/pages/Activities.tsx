import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import SEO from '../components/SEO/SEO';
import RegularActivities from '../components/Activities/RegularActivities';
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
  store?: {
    _id: string;
    name: string;
    slug?: string;
    branding?: { displayName?: string };
  } | null;
  requirements?: string;
  canRegister: boolean;
  isExpired: boolean;
  isFull: boolean;
  totalRegistered: number;
  availableSpots: number;
  userRegistration?: {
    id: string;
    participantCount: number;
    totalCost: number;
    createdAt: string;
  } | null;
  isEffectivelyPinned?: boolean;
  pinnedUntil?: string | null;
}

type SectionStatus = 'upcoming' | 'ongoing' | 'completed';

interface StoreOption {
  _id: string;
  name: string;
  slug?: string;
}

const SECTION_ORDER: SectionStatus[] = ['upcoming', 'ongoing', 'completed'];
const FIXED_VENUE_LOCATION = '荔枝角福源廣場8樓B C D室';

const Activities: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  /** '' = 全部；'other' = 其他；其餘為 store _id */
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'activities' | 'regular'>('activities');
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');

  useEffect(() => {
    fetchActivities();
    fetchStores();
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch(`${apiBase}/stores`);
      const data = await response.json();
      setStores(data.stores || data || []);
    } catch (error) {
      console.error('獲取店鋪列表失敗:', error);
      setStores([]);
    }
  };

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '100'
      });

      const response = await fetch(`${apiBase}/activities?${params}`);
      const data = await response.json();
      
      setActivities(data.activities || []);
    } catch (error) {
      console.error('獲取活動列表失敗:', error);
    } finally {
      setLoading(false);
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
        return t('activitiesPage.status.upcoming');
      case 'ongoing':
        return t('activitiesPage.status.ongoing');
      case 'completed':
        return t('activitiesPage.status.completed');
      case 'cancelled':
        return t('activitiesPage.status.cancelled');
      default:
        return status;
    }
  };

  // 前端依現在時間動態判斷顯示狀態
  const getDerivedStatus = (a: Activity) => {
    try {
      const now = new Date();
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      if (now >= end) return 'completed';
      if (now >= start && now < end) return 'ongoing';
      return 'upcoming';
    } catch {
      return a.status;
    }
  };

  const getSectionStatus = (a: Activity): SectionStatus => {
    if (a.status === 'cancelled') return 'completed';
    const derived = getDerivedStatus(a);
    if (derived === 'cancelled') return 'completed';
    return derived as SectionStatus;
  };

  const isLaiChiKokLocation = (location?: string) => {
    const loc = location || '';
    return loc.includes('荔枝角') || loc === FIXED_VENUE_LOCATION;
  };

  const getStoreGroupName = (activity: Activity): string => {
    const store = activity.store;
    if (store && typeof store === 'object' && store.name) {
      return store.branding?.displayName || store.name;
    }
    if (isLaiChiKokLocation(activity.location)) {
      return t('activitiesPage.storeGroups.laiChiKok');
    }
    return t('activitiesPage.storeGroups.other');
  };

  const activityMatchesStoreFilter = (activity: Activity, filter: string): boolean => {
    if (!filter) return true;

    const storeId =
      activity.store && typeof activity.store === 'object' ? activity.store._id : null;

    if (filter === 'other') {
      if (storeId) return false;
      return !isLaiChiKokLocation(activity.location);
    }

    if (storeId && storeId === filter) return true;

    // 未綁 store 但地點屬荔枝角：對應 slug / 名稱含荔枝角的店鋪
    const selected = stores.find((s) => s._id === filter);
    if (
      !storeId &&
      selected &&
      isLaiChiKokLocation(activity.location) &&
      (selected.slug === 'lai-chi-kok' || /荔枝角/i.test(selected.name || ''))
    ) {
      return true;
    }

    return false;
  };

  const filteredActivities = useMemo(
    () => activities.filter((a) => activityMatchesStoreFilter(a, storeFilter)),
    [activities, storeFilter, stores]
  );

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
    const base = apiUrl.replace(/\/$/, '');
    return `${base}${imagePath}`;
  };

  const canRegister = (activity: Activity) => {
    if (!user) return false;
    if (activity.userRegistration) return false; // 已報名
    const derived = getDerivedStatus(activity);
    if (derived !== 'upcoming') return false;
    return activity.canRegister && activity.availableSpots > 0 && !activity.isExpired;
  };

  const getRegisterButtonText = (activity: Activity) => {
    if (activity.userRegistration) return t('activitiesPage.registration.yourRegistered');
    const derived = getDerivedStatus(activity);
    if (derived === 'completed') return t('activitiesPage.registration.completed');
    if (derived === 'ongoing') return t('activitiesPage.registration.ongoing');
    if (activity.isExpired) return t('activitiesPage.registration.registrationClosed');
    if (activity.isFull) return t('activitiesPage.registration.full');
    if (activity.availableSpots <= 0) return t('activitiesPage.registration.maxReached');
    return t('activitiesPage.actions.registerNow');
  };

  const sortStoreKeys = (keys: string[]) => {
    const other = t('activitiesPage.storeGroups.other');
    return [...keys].sort((a, b) => {
      if (a === other) return 1;
      if (b === other) return -1;
      return a.localeCompare(b, i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'zh-Hant');
    });
  };

  const groupedByStatus = useMemo(() => {
    const sections: Record<SectionStatus, Record<string, Activity[]>> = {
      upcoming: {},
      ongoing: {},
      completed: {}
    };

    for (const activity of filteredActivities) {
      const status = getSectionStatus(activity);
      const storeKey = getStoreGroupName(activity);
      if (!sections[status][storeKey]) {
        sections[status][storeKey] = [];
      }
      sections[status][storeKey].push(activity);
    }

    return sections;
  }, [filteredActivities, i18n.language]);

  const visibleSections = useMemo(() => {
    if (!statusFilter) return SECTION_ORDER;
    return SECTION_ORDER.filter((s) => s === statusFilter);
  }, [statusFilter]);

  const hasAnyVisibleActivity = useMemo(() => {
    return visibleSections.some((status) => Object.keys(groupedByStatus[status]).length > 0);
  }, [visibleSections, groupedByStatus]);

  const renderActivityCard = (activity: Activity, index: number) => (
    <motion.div
      key={activity._id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className={`bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow ${
        activity.isEffectivelyPinned ? 'ring-2 ring-amber-400' : ''
      }`}
    >
      {/* Poster */}
      {(activity as any).posterThumb || activity.poster ? (
        <div className="relative h-48 bg-gray-200 overflow-hidden flex items-center justify-center">
          <img
            src={getImageUrl(((activity as any).posterThumb || activity.poster) as string)}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
          {activity.isEffectivelyPinned && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full shadow">
              {t('activitiesPage.pinned')}
            </span>
          )}
        </div>
      ) : activity.isEffectivelyPinned ? (
        <div className="h-10 bg-amber-50 border-b border-amber-200 flex items-center px-4">
          <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
            {t('activitiesPage.pinned')}
          </span>
        </div>
      ) : null}

      <div className="p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(getDerivedStatus(activity))}`}>
            {getStatusText(getDerivedStatus(activity))}
          </span>
          <span className="text-sm text-gray-500">
            {t('activitiesPage.deadline', { date: formatDate(activity.registrationDeadline) })}
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
            <span>
              {activity.totalRegistered}/{activity.maxParticipants} {t('common.people')}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <CurrencyDollarIcon className="h-4 w-4 mr-2" />
            <span>{t('activityRegister.sidebar.pointsPerPerson', { n: activity.price })}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{t('activitiesPage.progress.label')}</span>
            <span>{t('activitiesPage.progress.spots', { n: activity.availableSpots })}</span>
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
            {t('activitiesPage.actions.viewDetail')}
          </Link>
          {canRegister(activity) ? (
            <Link
              to={`/activities/${activity._id}/register`}
              className="flex-1 flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <UserPlusIcon className="h-4 w-4 mr-2" />
              {t('activitiesPage.actions.registerNow')}
            </Link>
          ) : activity.userRegistration ? (
            <button
              disabled
              className="flex-1 flex items-center justify-center px-4 py-2 bg-green-100 text-green-800 rounded-lg cursor-not-allowed border border-green-200"
            >
              <UserPlusIcon className="h-4 w-4 mr-2" />
              {getRegisterButtonText(activity)}
            </button>
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
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('activitiesPage.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={t('activitiesPage.seoTitle')}
        description={t('activitiesPage.seoDescription')}
        keywords="pickleball events,coaching,social,event registration,Picklevibes"
        url="/activities"
      />
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">{t('activitiesPage.headerTitle')}</h1>
            <p className="mt-2 text-gray-600">{t('activitiesPage.headerSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('activities')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activities'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('activitiesPage.tabs.activities')}
            </button>
            <button
              onClick={() => setActiveTab('regular')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'regular'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t('activitiesPage.tabs.regular')}
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'regular' ? (
          <RegularActivities />
        ) : (
          <>
            {/* Filter */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <label htmlFor="activities-store-filter" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  {t('activitiesPage.filters.store')}
                </label>
                <select
                  id="activities-store-filter"
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="min-w-[180px] px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">{t('activitiesPage.filters.allStores')}</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="other">{t('activitiesPage.storeGroups.other')}</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === ''
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('activitiesPage.filters.all')}
                </button>
                <button
                  onClick={() => setStatusFilter('upcoming')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'upcoming'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('activitiesPage.filters.upcoming')}
                </button>
                <button
                  onClick={() => setStatusFilter('ongoing')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'ongoing'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('activitiesPage.filters.ongoing')}
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === 'completed'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {t('activitiesPage.filters.completed')}
                </button>
              </div>
            </div>

            {!hasAnyVisibleActivity ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <CalendarIcon className="h-16 w-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('activitiesPage.empty.title')}</h3>
                <p className="text-gray-600">{t('activitiesPage.empty.description')}</p>
              </div>
            ) : (
              <div className="space-y-12">
                {visibleSections.map((status) => {
                  const storeGroups = groupedByStatus[status];
                  const storeKeys = sortStoreKeys(Object.keys(storeGroups));
                  if (storeKeys.length === 0) return null;

                  let cardIndex = 0;

                  return (
                    <section key={status} className="space-y-6">
                      <h2 className="text-2xl font-bold text-gray-900 border-b border-gray-200 pb-3">
                        {t(`activitiesPage.filters.${status}`)}
                      </h2>

                      <div className="space-y-8">
                        {storeKeys.map((storeKey) => {
                          const storeActivities = storeGroups[storeKey];
                          return (
                            <div key={`${status}-${storeKey}`} className="space-y-4">
                              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <MapPinIcon className="h-5 w-5 text-primary-600" />
                                {storeKey}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {storeActivities.map((activity) =>
                                  renderActivityCard(activity, cardIndex++)
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default Activities;
