import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useBooking } from '../../contexts/BookingContext';
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface TimeSlotSelectorProps {
  court: any;
  date: string;
  onSelect: (timeSlot: { start: string; end: string } | null) => void;
  selectedTimeSlot: { start: string; end: string } | null;
  onAvailabilityChange: (availability: any) => void;
}

const TimeSlotSelector: React.FC<TimeSlotSelectorProps> = ({
  court,
  date,
  onSelect,
  selectedTimeSlot,
  onAvailabilityChange
}) => {
  const { checkAvailability, checkBatchAvailability } = useBooking();
  const [timeSlots, setTimeSlots] = useState<Array<{ start: string; end: string; available: boolean; price: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60); // 默認1小時

  const durations = [
    { value: 60, label: '1小時' },
    { value: 120, label: '2小時' },
    { value: 180, label: '3小時' },
    { value: 240, label: '4小時' }
  ];

  const generateTimeSlots = useCallback(() => {
    const slots = [];
    const startHour = 0; // 24小時營業
    const endHour = 24;
    
    // 每1小時為一組，不提供半小時選項
    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endHour = hour + Math.floor(selectedDuration / 60);
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;
      
      if (endHour <= 24) {
        slots.push({
          start: startTime,
          end: endTime,
          available: true,
          price: 0
        });
      }
    }
    
    return slots;
  }, [selectedDuration]);

  const checkSlotAvailability = useCallback(async (slot: { start: string; end: string }) => {
    if (!court || !date) return { available: false, price: 0 };
    
    try {
      const availability = await checkAvailability(court._id, date, slot.start, slot.end);
      return {
        available: availability.available,
        price: availability.pricing?.totalPrice || 0
      };
    } catch (error) {
      console.error('檢查可用性失敗:', error);
      return { available: false, price: 0 };
    }
  }, [court, date, checkAvailability]);

  useEffect(() => {
    if (court && date) {
      setLoading(true);
      const slots = generateTimeSlots();
      
      // 使用批量 API 檢查所有時段的可用性
      const timeSlotData = slots.map(slot => ({
        startTime: slot.start,
        endTime: slot.end
      }));
      
      checkBatchAvailability(court._id, date, timeSlotData)
        .then((batchResult) => {
          const results = slots.map((slot, index) => {
            const availability = batchResult.timeSlots[index];
            return {
              ...slot,
              available: availability.available,
              price: availability.pricing?.totalPrice || 0
            };
          });
          setTimeSlots(results);
          setLoading(false);
        })
        .catch((error) => {
          console.error('批量檢查可用性失敗:', error);
          // 如果批量 API 失敗，回退到原來的單個檢查方式
          Promise.all(
            slots.map(async (slot) => {
              const availability = await checkSlotAvailability(slot);
              return { ...slot, ...availability };
            })
          ).then((results) => {
            setTimeSlots(results);
            setLoading(false);
          });
        });
    }
  }, [court, date, selectedDuration, checkBatchAvailability, checkAvailability, checkSlotAvailability, generateTimeSlots]);

  const handleSlotSelect = (slot: { start: string; end: string; available: boolean; price: number }) => {
    if (slot.available) {
      onSelect({ start: slot.start, end: slot.end });
      onAvailabilityChange({
        pricing: {
          totalPrice: slot.price,
          duration: selectedDuration
        }
      });
    }
  };

  const isSelected = (slot: { start: string; end: string }) => {
    return selectedTimeSlot?.start === slot.start && selectedTimeSlot?.end === slot.end;
  };

  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:${minute} ${period}`;
  };

  if (!court || !date) {
    return (
      <div className="text-center py-12">
        <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">請先選擇場地和日期</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">選擇時間</h2>
      <p className="text-gray-600 mb-8">請選擇您想要預約的時間段</p>

      {/* 時長選擇 */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          預約時長
        </label>
        <div className="flex gap-2">
          {durations.map((duration) => (
            <button
              key={duration.value}
              onClick={() => setSelectedDuration(duration.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                selectedDuration === duration.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {duration.label}
            </button>
          ))}
        </div>
      </div>

      {/* 時間段選擇 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">檢查可用性中...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {timeSlots.map((slot, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.02 }}
              onClick={() => handleSlotSelect(slot)}
              disabled={!slot.available}
              className={`relative p-4 rounded-lg text-center transition-all duration-200 ${
                slot.available
                  ? isSelected(slot)
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSelected(slot) && (
                <CheckCircleIcon className="absolute top-2 right-2 w-5 h-5 text-white" />
              )}
              
              <div className="text-sm font-medium">
                {formatTime(slot.start)}
              </div>
              <div className="text-xs opacity-75">
                - {formatTime(slot.end)}
              </div>
              
              {slot.available && slot.price > 0 && (
                <div className="text-xs font-semibold mt-1">
                  ${slot.price}
                </div>
              )}
              
              {!slot.available && (
                <div className="text-xs mt-1">
                  已預約
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* 選中時間信息 */}
      {selectedTimeSlot && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-primary-50 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-primary-600" />
            <span className="text-primary-800 font-medium">
              已選擇: {formatTime(selectedTimeSlot.start)} - {formatTime(selectedTimeSlot.end)}
            </span>
          </div>
        </motion.div>
      )}

      {/* 說明文字 */}
      <div className="mt-6 text-sm text-gray-500">
        <p>• 綠色時段表示可用</p>
        <p>• 灰色時段表示已被預約</p>
        <p>• 價格可能因高峰時段而有所不同</p>
      </div>
    </div>
  );
};

export default TimeSlotSelector;
