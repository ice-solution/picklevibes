import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../contexts/BookingContext';
import { useAuth } from '../contexts/AuthContext';
import CourtSelector from '../components/Booking/CourtSelector';
import DateSelector from '../components/Booking/DateSelector';
import TimeSlotSelector from '../components/Booking/TimeSlotSelector';
import PlayerForm from '../components/Booking/PlayerForm';
import BookingSummary from '../components/Booking/BookingSummary';
import { CalendarDaysIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';

const Booking: React.FC = () => {
  const { 
    selectedCourt, 
    selectedDate, 
    selectedTimeSlot, 
    players,
    loading,
    error,
    fetchCourts,
    setSelectedCourt,
    setSelectedDate,
    setSelectedTimeSlot,
    setPlayers,
    clearError
  } = useBooking();
  
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [availability, setAvailability] = useState<any>(null);
  const [bookingFormData, setBookingFormData] = useState({
    totalPlayers: 1,
    contactName: '',
    contactEmail: '',
    contactPhone: ''
  });

  useEffect(() => {
    fetchCourts();
  }, []); // 移除 fetchCourts 依賴，只在組件掛載時調用一次

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const steps = [
    { id: 1, name: '選擇場地', icon: CalendarDaysIcon },
    { id: 2, name: '選擇日期', icon: CalendarDaysIcon },
    { id: 3, name: '選擇時間', icon: ClockIcon },
    { id: 4, name: '填寫信息', icon: UsersIcon },
    { id: 5, name: '確認預約', icon: CalendarDaysIcon }
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedCourt !== null;
      case 2: return selectedDate !== '';
      case 3: return selectedTimeSlot !== null;
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
    setBookingFormData({
      totalPlayers: 1,
      contactName: '',
      contactEmail: '',
      contactPhone: ''
    });
    setCurrentStep(1);
    setAvailability(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            預約場地
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            選擇您喜歡的場地和時間，開始您的匹克球之旅
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    currentStep >= step.id
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    currentStep >= step.id ? 'text-primary-600' : 'text-gray-400'
                  }`}>
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-4 ${
                      currentStep > step.id ? 'bg-primary-600' : 'bg-gray-300'
                    }`} />
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
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        )}

        {/* Booking Form */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {currentStep === 1 && (
                  <CourtSelector
                    onSelect={setSelectedCourt}
                    selectedCourt={selectedCourt}
                  />
                )}

                {currentStep === 2 && (
                  <DateSelector
                    onSelect={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                )}

                {currentStep === 3 && (
                  <TimeSlotSelector
                    court={selectedCourt}
                    date={selectedDate}
                    onSelect={setSelectedTimeSlot}
                    selectedTimeSlot={selectedTimeSlot}
                    onAvailabilityChange={setAvailability}
                  />
                )}

                {currentStep === 4 && (
                  <PlayerForm
                    formData={bookingFormData}
                    onFormDataChange={setBookingFormData}
                    maxPlayers={selectedCourt?.capacity || 8}
                  />
                )}

                {currentStep === 5 && (
                  <BookingSummary
                    court={selectedCourt}
                    date={selectedDate}
                    timeSlot={selectedTimeSlot}
                    bookingData={bookingFormData}
                    availability={availability}
                    onReset={resetBooking}
                  />
                )}

                {/* Navigation Buttons */}
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

                  {currentStep < 5 ? (
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
                  ) : (
                    <button
                      onClick={() => {/* Handle booking submission */}}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors duration-200"
                    >
                      確認預約
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">預約摘要</h3>
                
                <div className="space-y-4">
                  <div>
                    <span className="text-sm text-gray-500">場地</span>
                    <p className="font-medium">
                      {selectedCourt ? selectedCourt.name : '未選擇'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">日期</span>
                    <p className="font-medium">
                      {selectedDate ? new Date(selectedDate).toLocaleDateString('zh-TW') : '未選擇'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">時間</span>
                    <p className="font-medium">
                      {selectedTimeSlot ? `${selectedTimeSlot.start} - ${selectedTimeSlot.end}` : '未選擇'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">人數</span>
                    <p className="font-medium">
                      {players.length + 1} 人
                    </p>
                  </div>

                  {availability && (
                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">總價</span>
                        <span className="font-bold text-lg text-primary-600">
                          ${availability.pricing?.totalPrice || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {!user && (
                  <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      請先登入以完成預約
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
