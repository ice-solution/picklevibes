import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BookingPicker from '../components/Booking/BookingPicker';
import PlayerForm from '../components/Booking/PlayerForm';
import BookingSummary from '../components/Booking/BookingSummary';
import BackToTop from '../components/Common/BackToTop';
import { CalendarDaysIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';
import {
  buildBookingUrl,
  parseBookingParams,
  parseBookingSection,
  scrollToBookingSection,
  sectionToProgressStep,
  inferBookingSection,
  type BookingPathParams,
  type BookingSection,
} from '../utils/bookingRoutes';
import type { StoreSummary } from '../contexts/BookingContext';

const Booking: React.FC = () => {
  const params = useParams<{ storeSlug?: string; courtSlug?: string; date?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDeepLinkRoute = !location.pathname.startsWith('/booking');
  const routeParams = parseBookingParams(params.storeSlug, params.courtSlug, params.date);
  const activeSection = parseBookingSection(location.hash);

  const {
    stores,
    selectedStore,
    selectedCourt,
    selectedDate,
    selectedTimeSlot,
    includeSoloCourt,
    soloCourtAvailable,
    loading,
    error,
    fetchStores,
    fetchCourts,
    setSelectedStore,
    setSelectedCourt,
    setSelectedDate,
    setSelectedTimeSlot,
    setIncludeSoloCourt,
    checkSoloCourtAvailability,
    clearError,
  } = useBooking();

  const { user } = useAuth();
  const [availability, setAvailability] = useState<any>(null);
  const [maxAdvanceDaysByRole, setMaxAdvanceDaysByRole] = useState<Record<string, number>>({
    user: 7,
    coach: 14,
    admin: 30,
  });
  const [bookingFormData, setBookingFormData] = useState({
    totalPlayers: 1,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [routeError, setRouteError] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const hydratedKey = useRef<string>('');
  const scrollAfterHydrate = useRef<BookingSection | null>(null);

  const stableAvailability = useMemo(() => availability, [availability]);
  const progressStep = sectionToProgressStep(activeSection);

  const maxAdvanceDays =
    user?.role && maxAdvanceDaysByRole[user.role] != null
      ? maxAdvanceDaysByRole[user.role]
      : maxAdvanceDaysByRole.user ?? 7;

  const steps = [
    { id: 1, name: '選擇預約', icon: CalendarDaysIcon },
    { id: 2, name: '填寫資料', icon: UsersIcon },
    { id: 3, name: '確認預約', icon: ClockIcon },
  ];

  const pathParams = useCallback((): BookingPathParams => {
    return {
      storeSlug: selectedStore?.slug,
      courtSlug: selectedCourt?.slug,
      date: selectedDate || undefined,
    };
  }, [selectedStore?.slug, selectedCourt?.slug, selectedDate]);

  const goToSection = useCallback(
    (section: BookingSection, pathOverride?: BookingPathParams) => {
      const p = pathOverride ?? pathParams();
      const url = buildBookingUrl(p, section, { deepLink: isDeepLinkRoute });
      if (`${location.pathname}${location.hash}` !== url) {
        navigate(url, { replace: true });
      }
      scrollToBookingSection(section);
    },
    [isDeepLinkRoute, location.pathname, location.hash, navigate, pathParams]
  );

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (selectedStore?._id) {
      fetchCourts(selectedStore._id);
    }
  }, [selectedStore?._id, fetchCourts]);

  useEffect(() => {
    const loadBookingConfig = async () => {
      try {
        const res = await api.get('/config/booking');
        const data = res.data?.data?.maxAdvanceDaysByRole;
        if (data && typeof data === 'object') setMaxAdvanceDaysByRole(data);
      } catch (_) {
        // 預設值
      }
    };
    loadBookingConfig();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => clearError(), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (selectedCourt?.type === 'competition' && selectedDate && selectedTimeSlot) {
      checkSoloCourtAvailability(selectedDate, selectedTimeSlot.start, selectedTimeSlot.end);
    }
  }, [selectedCourt, selectedDate, selectedTimeSlot, checkSoloCourtAvailability]);

  // 瀏覽器前進／後退：hash 變更時捲動到對應區塊
  useEffect(() => {
    const section = parseBookingSection(location.hash);
    scrollToBookingSection(section, 'smooth');
  }, [location.hash]);

  // URL 路徑 → 狀態
  useEffect(() => {
    if (routeParams === null) {
      setRouteError('無效的預約連結');
      return;
    }
    setRouteError(null);

    const key = `${routeParams.storeSlug || ''}|${routeParams.courtSlug || ''}|${routeParams.date || ''}`;
    if (!routeParams.storeSlug) {
      hydratedKey.current = key;
      if (!location.hash) {
        navigate(buildBookingUrl({}, 'store', { deepLink: isDeepLinkRoute }), { replace: true });
      }
      return;
    }
    if (key === hydratedKey.current) return;

    const hydrate = async () => {
      setHydrating(true);
      try {
        const storeRes = await axios.get(`/stores/by-slug/${routeParams.storeSlug}`);
        const store = storeRes.data.store;
        setSelectedStore(store);
        await fetchCourts(store._id);

        if (routeParams.courtSlug) {
          const courtRes = await axios.get(
            `/courts?storeSlug=${routeParams.storeSlug}&courtSlug=${routeParams.courtSlug}`
          );
          setSelectedCourt(courtRes.data.court);
        }

        if (routeParams.date) {
          setSelectedDate(routeParams.date);
          scrollAfterHydrate.current = inferBookingSection({
            storeSlug: routeParams.storeSlug,
            courtSlug: routeParams.courtSlug,
            date: routeParams.date,
            hash: location.hash,
          });
        } else {
          scrollAfterHydrate.current = inferBookingSection({
            storeSlug: routeParams.storeSlug,
            courtSlug: routeParams.courtSlug,
            hash: location.hash,
          });
        }

        hydratedKey.current = key;
      } catch {
        setRouteError('找不到指定的店鋪或場地，請重新選擇');
        hydratedKey.current = key;
      } finally {
        setHydrating(false);
      }
    };

    hydrate();
  }, [
    routeParams,
    setSelectedStore,
    setSelectedCourt,
    setSelectedDate,
    fetchCourts,
    location.hash,
    isDeepLinkRoute,
    navigate,
  ]);

  // hydrate 完成後捲動到目標區塊
  useEffect(() => {
    if (!hydrating && scrollAfterHydrate.current) {
      const section = scrollAfterHydrate.current;
      scrollAfterHydrate.current = null;
      const p: BookingPathParams = {
        storeSlug: routeParams?.storeSlug,
        courtSlug: routeParams?.courtSlug,
        date: routeParams?.date,
      };
      const url = buildBookingUrl(p, section, { deepLink: isDeepLinkRoute });
      if (`${location.pathname}${location.hash}` !== url) {
        navigate(url, { replace: true });
      } else {
        scrollToBookingSection(section);
      }
    }
  }, [hydrating, routeParams, isDeepLinkRoute, location.pathname, location.hash, navigate]);

  const handleSelectStore = (store: StoreSummary) => {
    setSelectedStore(store);
    fetchCourts(store._id);
    goToSection('court', { storeSlug: store.slug });
  };

  const handleSelectCourt = (court: NonNullable<typeof selectedCourt>) => {
    setSelectedCourt(court);
    setSelectedDate('');
    setSelectedTimeSlot(null);
    setAvailability(null);
    if (selectedStore?.slug && court.slug) {
      goToSection('date', { storeSlug: selectedStore.slug, courtSlug: court.slug });
    }
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    setAvailability(null);
    if (selectedStore?.slug && selectedCourt?.slug) {
      goToSection('time', {
        storeSlug: selectedStore.slug,
        courtSlug: selectedCourt.slug,
        date,
      });
    }
  };

  const handleSelectTime = (slot: { start: string; end: string } | null) => {
    setSelectedTimeSlot(slot);
    if (slot && selectedStore?.slug && selectedCourt?.slug && selectedDate) {
      goToSection('details', {
        storeSlug: selectedStore.slug,
        courtSlug: selectedCourt.slug,
        date: selectedDate,
      });
    }
  };

  const canProceedToConfirm = () =>
    bookingFormData.totalPlayers > 0 &&
    bookingFormData.contactName.trim() !== '' &&
    bookingFormData.contactEmail.trim() !== '' &&
    bookingFormData.contactPhone.trim() !== '';

  const goToConfirm = () => {
    if (!canProceedToConfirm()) return;
    goToSection('confirm');
  };

  const goBack = () => {
    switch (activeSection) {
      case 'confirm':
        goToSection('details');
        break;
      case 'details':
        goToSection('time');
        break;
      case 'time':
        goToSection('date');
        break;
      case 'date':
        goToSection('court');
        break;
      case 'court':
        goToSection('store');
        break;
      default:
        break;
    }
  };

  const resetBooking = () => {
    setSelectedCourt(null);
    setSelectedDate('');
    setSelectedTimeSlot(null);
    setBookingFormData({
      totalPlayers: 1,
      contactName: '',
      contactEmail: '',
      contactPhone: '',
    });
    setAvailability(null);
    navigate(buildBookingUrl({}, 'store', { deepLink: false }), { replace: true });
  };

  const handleEditBooking = (field: keyof typeof bookingFormData, value: any) => {
    setBookingFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (routeParams === null) {
    return <Navigate to="/booking#store" replace />;
  }

  const showLoading = loading || hydrating;
  const showDetails =
    Boolean(selectedTimeSlot) && ['details', 'confirm'].includes(activeSection);
  const showConfirm = activeSection === 'confirm' && canProceedToConfirm();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">預約場地</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            選擇店鋪、場地、日期後即可在同一頁挑選時段
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center justify-center overflow-x-auto pb-2">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-max px-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      progressStep >= step.id
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium whitespace-nowrap ${
                      progressStep >= step.id ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-6 md:w-8 h-0.5 mx-2 md:mx-4 ${
                        progressStep > step.id ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {(error || routeError) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <p className="text-sm text-red-800">{routeError || error}</p>
          </motion.div>
        )}

        {showLoading && !selectedStore ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {!showConfirm && (
                  <BookingPicker
                    stores={stores}
                    selectedStore={selectedStore}
                    selectedCourt={selectedCourt}
                    selectedDate={selectedDate}
                    selectedTimeSlot={selectedTimeSlot}
                    maxAdvanceDays={maxAdvanceDays}
                    loading={loading}
                    onSelectStore={handleSelectStore}
                    onSelectCourt={handleSelectCourt}
                    onSelectDate={handleSelectDate}
                    onSelectTime={handleSelectTime}
                    onAvailabilityChange={setAvailability}
                  />
                )}

                {showDetails && !showConfirm && (
                  <section
                    id="booking-section-details"
                    className="pt-8 border-t border-gray-100 scroll-mt-24 mt-10"
                  >
                    <PlayerForm
                      formData={bookingFormData}
                      onFormDataChange={setBookingFormData}
                      maxPlayers={selectedCourt?.capacity || 8}
                    />
                    <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={goBack}
                        className="px-6 py-3 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                      >
                        上一步
                      </button>
                      <button
                        type="button"
                        onClick={goToConfirm}
                        disabled={!canProceedToConfirm()}
                        className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                          canProceedToConfirm()
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        確認預約
                      </button>
                    </div>
                  </section>
                )}

                {showConfirm && (
                  <section id="booking-section-confirm" className="scroll-mt-24">
                    <BookingSummary
                      court={selectedCourt}
                      date={selectedDate}
                      timeSlot={selectedTimeSlot}
                      bookingData={bookingFormData}
                      availability={stableAvailability}
                      onReset={resetBooking}
                      onPrevStep={goBack}
                      onEditBooking={handleEditBooking}
                      includeSoloCourt={includeSoloCourt}
                      soloCourtAvailable={soloCourtAvailable}
                      onToggleSoloCourt={setIncludeSoloCourt}
                      storeName={selectedStore?.name}
                      storeAddress={selectedStore?.address}
                    />
                  </section>
                )}
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">預約摘要</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">店鋪</span>
                    <p className="font-medium">{selectedStore?.name || '未選擇'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">場地</span>
                    <p className="font-medium">{selectedCourt?.name || '未選擇'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">日期</span>
                    <p className="font-medium">
                      {selectedDate
                        ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('zh-TW')
                        : '未選擇'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">時間</span>
                    <p className="font-medium">
                      {selectedTimeSlot
                        ? `${selectedTimeSlot.start} - ${selectedTimeSlot.end}`
                        : '未選擇'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">人數</span>
                    <p className="font-medium">{bookingFormData.totalPlayers} 人</p>
                  </div>
                  {availability && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">總價</span>
                        <span className="font-bold text-lg text-primary-600">
                          {availability.pricing?.totalPrice || 0} 積分
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <BackToTop />
    </div>
  );
};

export default Booking;
