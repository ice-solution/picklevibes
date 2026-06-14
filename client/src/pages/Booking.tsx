import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import BookingPicker from '../components/Booking/BookingPicker';
import TimeSlotSelector from '../components/Booking/TimeSlotSelector';
import PlayerForm from '../components/Booking/PlayerForm';
import BookingSummary from '../components/Booking/BookingSummary';
import BackToTop from '../components/Common/BackToTop';
import { CalendarDaysIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';
import {
  buildBookingPath,
  parseBookingParams,
  type BookingPathParams,
} from '../utils/bookingRoutes';
import type { StoreSummary } from '../contexts/BookingContext';

const Booking: React.FC = () => {
  const params = useParams<{ storeSlug?: string; courtSlug?: string; date?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDeepLinkRoute = !location.pathname.startsWith('/booking');
  const routeParams = parseBookingParams(params.storeSlug, params.courtSlug, params.date);

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
  const [currentStep, setCurrentStep] = useState(1);
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

  const stableAvailability = useMemo(() => availability, [availability]);

  const maxAdvanceDays =
    user?.role && maxAdvanceDaysByRole[user.role] != null
      ? maxAdvanceDaysByRole[user.role]
      : maxAdvanceDaysByRole.user ?? 7;

  const steps = [
    { id: 1, name: '選擇店鋪／場地／日期', icon: CalendarDaysIcon },
    { id: 2, name: '選擇時間', icon: ClockIcon },
    { id: 3, name: '填寫信息', icon: UsersIcon },
    { id: 4, name: '確認預約', icon: CalendarDaysIcon },
  ];

  const syncUrl = useCallback(
    (next: BookingPathParams) => {
      const path = buildBookingPath(next, { deepLink: isDeepLinkRoute });
      if (location.pathname !== path) {
        navigate(path, { replace: true });
      }
    },
    [isDeepLinkRoute, location.pathname, navigate]
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

  // URL → 狀態
  useEffect(() => {
    if (routeParams === null) {
      setRouteError('無效的預約連結');
      return;
    }
    setRouteError(null);

    const key = `${routeParams.storeSlug || ''}|${routeParams.courtSlug || ''}|${routeParams.date || ''}`;
    if (!routeParams.storeSlug) {
      hydratedKey.current = key;
      setCurrentStep(1);
      return;
    }
    if (key === hydratedKey.current) return;

    const hydrate = async () => {
      setHydrating(true);
      try {
        if (!routeParams.storeSlug) {
          hydratedKey.current = key;
          setCurrentStep(1);
          return;
        }

        const storeRes = await axios.get(`/stores/by-slug/${routeParams.storeSlug}`);
        const store = storeRes.data.store;
        setSelectedStore(store);
        await fetchCourts(store._id);

        let court = null;
        if (routeParams.courtSlug) {
          const courtRes = await axios.get(
            `/courts?storeSlug=${routeParams.storeSlug}&courtSlug=${routeParams.courtSlug}`
          );
          court = courtRes.data.court;
          setSelectedCourt(court);
        }

        if (routeParams.date) {
          setSelectedDate(routeParams.date);
          setCurrentStep(2);
        } else {
          setCurrentStep(1);
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
  }, [routeParams, setSelectedStore, setSelectedCourt, setSelectedDate, fetchCourts]);

  const handleSelectStore = (store: StoreSummary) => {
    setSelectedStore(store);
    fetchCourts(store._id);
    syncUrl({ storeSlug: store.slug });
  };

  const handleSelectCourt = (court: NonNullable<typeof selectedCourt>) => {
    setSelectedCourt(court);
    setSelectedDate('');
    setSelectedTimeSlot(null);
    if (selectedStore?.slug && court.slug) {
      syncUrl({ storeSlug: selectedStore.slug, courtSlug: court.slug });
    }
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedTimeSlot(null);
    if (selectedStore?.slug && selectedCourt?.slug) {
      syncUrl({ storeSlug: selectedStore.slug, courtSlug: selectedCourt.slug, date });
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedStore !== null && selectedCourt !== null && selectedDate !== '';
      case 2:
        return selectedTimeSlot !== null;
      case 3:
        return (
          bookingFormData.totalPlayers > 0 &&
          bookingFormData.contactName.trim() !== '' &&
          bookingFormData.contactEmail.trim() !== '' &&
          bookingFormData.contactPhone.trim() !== ''
        );
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setCurrentStep(1);
    navigate(buildBookingPath({}, { deepLink: false }), { replace: true });
  };

  const handleEditBooking = (field: keyof typeof bookingFormData, value: any) => {
    setBookingFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlayerFormChange = (newFormData: typeof bookingFormData) => {
    setBookingFormData(newFormData);
  };

  if (routeParams === null) {
    return <Navigate to="/booking" replace />;
  }

  const showLoading = loading || hydrating;

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
            在同一頁選擇店鋪、場地與日期，再挑選時段完成預約
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
                      currentStep >= step.id
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium whitespace-nowrap ${
                      currentStep >= step.id ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-6 md:w-8 h-0.5 mx-2 md:mx-4 ${
                        currentStep > step.id ? 'bg-primary-600' : 'bg-gray-300'
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

        {showLoading && currentStep === 1 && !selectedStore && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        )}

        {!showLoading || currentStep > 1 || selectedStore ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {currentStep === 1 && (
                  <BookingPicker
                    stores={stores}
                    selectedStore={selectedStore}
                    selectedCourt={selectedCourt}
                    selectedDate={selectedDate}
                    maxAdvanceDays={maxAdvanceDays}
                    loading={loading}
                    onSelectStore={handleSelectStore}
                    onSelectCourt={handleSelectCourt}
                    onSelectDate={handleSelectDate}
                  />
                )}

                {currentStep === 2 && (
                  <TimeSlotSelector
                    court={selectedCourt}
                    date={selectedDate}
                    onSelect={setSelectedTimeSlot}
                    selectedTimeSlot={selectedTimeSlot}
                    onAvailabilityChange={setAvailability}
                  />
                )}

                {currentStep === 3 && (
                  <PlayerForm
                    formData={bookingFormData}
                    onFormDataChange={handlePlayerFormChange}
                    maxPlayers={selectedCourt?.capacity || 8}
                  />
                )}

                {currentStep === 4 && (
                  <BookingSummary
                    court={selectedCourt}
                    date={selectedDate}
                    timeSlot={selectedTimeSlot}
                    bookingData={bookingFormData}
                    availability={stableAvailability}
                    onReset={resetBooking}
                    onPrevStep={prevStep}
                    onEditBooking={handleEditBooking}
                    includeSoloCourt={includeSoloCourt}
                    soloCourtAvailable={soloCourtAvailable}
                    onToggleSoloCourt={setIncludeSoloCourt}
                    storeName={selectedStore?.name}
                    storeAddress={selectedStore?.address}
                  />
                )}

                {currentStep < 4 && (
                  <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                    <button
                      onClick={prevStep}
                      disabled={currentStep === 1}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                        currentStep === 1
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      上一步
                    </button>
                    <button
                      onClick={nextStep}
                      disabled={!canProceed()}
                      className={`px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                        canProceed()
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      下一步
                    </button>
                  </div>
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
                    <p className="font-medium">{selectedCourt ? selectedCourt.name : '未選擇'}</p>
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
        ) : null}
      </div>
      <BackToTop />
    </div>
  );
};

export default Booking;
