import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import StoreSelector from '../components/Booking/StoreSelector';
import type { StoreSummary } from '../contexts/BookingContext';
import CourtSelector from '../components/Booking/CourtSelector';
import DateSelector from '../components/Booking/DateSelector';
import TimeSlotSelector from '../components/Booking/TimeSlotSelector';
import PlayerForm from '../components/Booking/PlayerForm';
import BookingSummary from '../components/Booking/BookingSummary';
import BackToTop from '../components/Common/BackToTop';
import { CalendarDaysIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

const Booking: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { 
    stores,
    selectedStore,
    selectedCourt, 
    selectedDate, 
    selectedTimeSlot, 
    players,
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
    setPlayers,
    setIncludeSoloCourt,
    checkSoloCourtAvailability,
    clearError
  } = useBooking();
  
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [availability, setAvailability] = useState<any>(null);
  const [maxAdvanceDaysByRole, setMaxAdvanceDaysByRole] = useState<Record<string, number>>({ user: 7, coach: 14, admin: 30 });
  const [bookingFormData, setBookingFormData] = useState({
    totalPlayers: 1,
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  });
  const stepSectionRef = useRef<HTMLDivElement>(null);
  const skipInitialFocusRef = useRef(true);

  // 調試：監控 bookingFormData 變化
  useEffect(() => {
    console.log('🔍 bookingFormData 更新:', bookingFormData);
    console.log('🔍 bookingFormData.totalPlayers:', bookingFormData.totalPlayers);
  }, [bookingFormData]);

  // 預約現在使用積分支付，不再需要支付狀態管理

  // 使用 useMemo 來穩定 availability 對象，避免 BookingSummary 重新創建
  const stableAvailability = useMemo(() => availability, [availability]);

  /** 轉步驟後捲到對應 section 並 focus，避免停在舊內容位置 */
  const focusStepSection = useCallback(() => {
    const el = stepSectionRef.current;
    if (!el) return;
    // 等 DOM 換咗新步驟再捲
    window.requestAnimationFrame(() => {
      const navOffset = 72; // sticky Navbar 高度緩衝
      const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      // 令鍵盤／讀屏都對準新區塊
      if (typeof el.focus === 'function') {
        try {
          el.focus({ preventScroll: true });
        } catch {
          el.focus();
        }
      }
    });
  }, []);

  useEffect(() => {
    if (skipInitialFocusRef.current) {
      skipInitialFocusRef.current = false;
      return;
    }
    focusStepSection();
  }, [currentStep, focusStepSection]);
  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  useEffect(() => {
    if (selectedStore?._id) {
      fetchCourts(selectedStore._id);
    }
  }, [selectedStore?._id, fetchCourts]);

  // 載入預約設定（依 role 的可預約天數）
  useEffect(() => {
    const loadBookingConfig = async () => {
      try {
        const res = await api.get('/config/booking');
        const data = res.data?.data?.maxAdvanceDaysByRole;
        if (data && typeof data === 'object') setMaxAdvanceDaysByRole(data);
      } catch (_) {
        // 使用預設值
      }
    };
    loadBookingConfig();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // 檢查單人場可用性 - 當選擇比賽場且選擇了時間段時
  useEffect(() => {
    if (selectedCourt?.type === 'competition' && selectedDate && selectedTimeSlot) {
      checkSoloCourtAvailability(selectedDate, selectedTimeSlot.start, selectedTimeSlot.end);
    }
  }, [selectedCourt, selectedDate, selectedTimeSlot, checkSoloCourtAvailability]);

  const maxAdvanceDays = user?.role && maxAdvanceDaysByRole[user.role] != null
    ? maxAdvanceDaysByRole[user.role]
    : (maxAdvanceDaysByRole.user ?? 7);

  const steps = [
    { id: 1, name: t('bookingPage.steps.store'), icon: CalendarDaysIcon },
    { id: 2, name: t('bookingPage.steps.court'), icon: CalendarDaysIcon },
    { id: 3, name: t('bookingPage.steps.dateTime'), icon: ClockIcon },
    { id: 4, name: t('bookingPage.steps.info'), icon: UsersIcon },
    { id: 5, name: t('bookingPage.steps.confirm'), icon: CalendarDaysIcon }
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedStore !== null;
      case 2: return selectedCourt !== null;
      case 3: return selectedDate !== '' && selectedTimeSlot !== null;
      case 4: return bookingFormData.totalPlayers > 0 && 
                     bookingFormData.contactName.trim() !== '' &&
                     bookingFormData.contactEmail.trim() !== '' &&
                     bookingFormData.contactPhone.trim() !== '';
      default: return true;
    }
  };

  const nextStep = () => {
    if (canProceed() && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const resetBooking = () => {
    setSelectedCourt(null);
    setSelectedDate('');
    setSelectedTimeSlot(null);
    // 保留 selectedStore（含 localStorage 記憶）
    setBookingFormData({
      totalPlayers: 1,
      contactName: '',
      contactEmail: '',
      contactPhone: ''
    });
    setAvailability(null);
    // 預約現在使用積分支付，不再需要支付狀態重置
    setCurrentStep(1);
  };

  // 處理預約數據編輯
  const handleEditBooking = (field: keyof typeof bookingFormData, value: any) => {
    console.log('🔍 handleEditBooking:', field, value);
    setBookingFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      console.log('🔍 handleEditBooking 新數據:', newData);
      return newData;
    });
  };

  // 處理 PlayerForm 數據變化
  const handlePlayerFormChange = (newFormData: typeof bookingFormData) => {
    setBookingFormData(newFormData);
  };


  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full min-w-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6 sm:mb-12 px-1"
        >
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2 sm:mb-6">
            {t('bookingPage.title')}
          </h1>
          <p className="text-sm sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('bookingPage.subtitle')}
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6 sm:mb-12 w-full min-w-0"
        >
          {/* Mobile：只顯示圓點＋當前步驟名稱，避免橫向穿出 */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-1 px-1">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 ${
                      currentStep >= step.id
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}
                    aria-current={currentStep === step.id ? 'step' : undefined}
                    title={step.name}
                  >
                    <step.icon className="w-4 h-4" />
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 min-w-[6px] ${
                        currentStep > step.id ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="mt-3 text-center text-sm font-medium text-primary-700">
              {currentStep}/{steps.length} · {steps.find((s) => s.id === currentStep)?.name}
            </p>
          </div>

          {/* Desktop：完整文字步驟 */}
          <div className="hidden sm:flex items-center justify-center overflow-x-auto">
            <div className="flex items-center gap-2 md:gap-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center shrink-0">
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

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t('bookingPage.loading')}</p>
          </div>
        )}

        {/* Booking Form */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 min-w-0">
            {/* Main Content */}
            <div className="lg:col-span-2 min-w-0">
              <div
                ref={stepSectionRef}
                id={`booking-step-${currentStep}`}
                tabIndex={-1}
                className="bg-white rounded-2xl shadow-lg p-4 sm:p-8 overflow-hidden outline-none scroll-mt-20"
              >
                {currentStep === 1 && (
                  <StoreSelector
                    stores={stores}
                    selectedStore={selectedStore}
                    onSelect={(s: StoreSummary) => {
                      setSelectedStore(s);
                      fetchCourts(s._id);
                      setCurrentStep(2);
                    }}
                    loading={loading && stores.length === 0}
                  />
                )}

                {currentStep === 2 && (
                  <CourtSelector
                    onSelect={(court) => {
                      setSelectedCourt(court);
                      setCurrentStep(3);
                    }}
                    selectedCourt={selectedCourt}
                  />
                )}

                {currentStep === 3 && (
                  <div className="space-y-8">
                    <DateSelector
                      onSelect={(date) => {
                        if (date !== selectedDate) {
                          setSelectedTimeSlot(null);
                          setAvailability(null);
                        }
                        setSelectedDate(date);
                      }}
                      selectedDate={selectedDate}
                      maxAdvanceDays={maxAdvanceDays}
                    />
                    {selectedDate && selectedCourt && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <TimeSlotSelector
                          court={selectedCourt}
                          date={selectedDate}
                          onSelect={setSelectedTimeSlot}
                          selectedTimeSlot={selectedTimeSlot}
                          onAvailabilityChange={setAvailability}
                        />
                      </motion.div>
                    )}
                  </div>
                )}

                {currentStep === 4 && (
                  <PlayerForm
                    formData={bookingFormData}
                    onFormDataChange={handlePlayerFormChange}
                    maxPlayers={selectedCourt?.capacity || 8}
                  />
                )}

                {currentStep === 5 && (
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

                {/* Navigation：選店／選場已點擊即前進，這兩步唔顯示「下一步」 */}
                {currentStep < 5 && currentStep !== 1 && currentStep !== 2 && (
                  <div className="flex justify-between gap-3 mt-8 pt-6 border-t border-gray-200 sticky bottom-0 bg-white/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:static sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:mx-0 sm:px-0 z-10">
                    <button
                      type="button"
                      onClick={prevStep}
                      className="flex-1 sm:flex-none min-h-[48px] px-6 py-3 rounded-lg font-medium transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      {t('bookingPage.nav.prev')}
                    </button>

                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!canProceed()}
                      className={`flex-1 sm:flex-none min-h-[48px] px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${
                        canProceed()
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {t('bookingPage.nav.next')}
                    </button>
                  </div>
                )}
                {(currentStep === 1 || currentStep === 2) && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    {currentStep === 2 && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        {t('bookingPage.nav.prev')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar：desktop 詳情；mobile 精簡只顯示已選＋價錢 */}
            <div className="lg:col-span-1 min-w-0">
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 sticky top-8">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                  {t('bookingPage.sidebar.title')}
                </h3>
                
                <div className="space-y-3 sm:space-y-4">
                  {selectedStore && (
                    <div>
                      <span className="text-sm text-gray-500">{t('bookingPage.steps.store')}</span>
                      <p className="font-medium text-sm sm:text-base truncate">{selectedStore.name}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-500">{t('bookingPage.sidebar.court')}</span>
                    <p className="font-medium text-sm sm:text-base">
                      {selectedCourt ? selectedCourt.name : t('common.notSelected')}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">{t('bookingPage.sidebar.date')}</span>
                    <p className="font-medium text-sm sm:text-base">
                      {selectedDate ? new Date(selectedDate).toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'zh-TW') : t('common.notSelected')}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">{t('bookingPage.sidebar.time')}</span>
                    <p className="font-medium text-sm sm:text-base">
                      {selectedTimeSlot ? `${selectedTimeSlot.start} - ${selectedTimeSlot.end}` : t('common.notSelected')}
                    </p>
                  </div>
                  
                  <div className="hidden sm:block">
                    <span className="text-sm text-gray-500">{t('bookingPage.sidebar.players')}</span>
                    <p className="font-medium">
                      {bookingFormData.totalPlayers} {t('common.people')}
                    </p>
                  </div>

                  {(availability?.pricing?.totalPrice != null) && (
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-500">{t('bookingPage.sidebar.total')}</span>
                        <span className="font-bold text-lg text-primary-600">
                          {availability.pricing.totalPrice} {t('common.currency')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {!user && (
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 rounded-lg hidden sm:block">
                    <p className="text-sm text-yellow-800">
                      {t('bookingPage.sidebar.loginNotice')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 返回頂部按鈕 */}
      <BackToTop />
    </div>
  );
};

export default Booking;
