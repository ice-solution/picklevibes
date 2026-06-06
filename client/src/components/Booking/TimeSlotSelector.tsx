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
  const [timeSlots, setTimeSlots] = useState<Array<{ start: string; end: string; available: boolean; price: number; slotName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60); // 默認1小時
  const [currentTime, setCurrentTime] = useState(new Date()); // 添加當前時間狀態
  const [forceUpdate, setForceUpdate] = useState(0); // 強制更新計數器

  const durations = [
    { value: 60, label: '1小時' },
    { value: 120, label: '2小時' }
  ];

  // 定期更新當前時間
  useEffect(() => {
    // 立即更新一次
    setCurrentTime(new Date());
    setForceUpdate(prev => prev + 1);
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setForceUpdate(prev => prev + 1);
    }, 30000); // 每30秒更新一次

    return () => clearInterval(timer);
  }, []);

  // 檢查時間是否已經過去
  const isTimeInPast = useCallback((timeString: string, selectedDate: string) => {
    const now = currentTime; // 使用狀態中的當前時間
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDateObj = new Date(selectedDate);
    
    // 使用日期字符串比較而不是時間戳比較
    const todayString = today.toDateString();
    const selectedDateString = selectedDateObj.toDateString();
    const isToday = todayString === selectedDateString;
    
    // 如果選擇的不是今天，則不是過去時間
    if (!isToday) {
      return false;
    }
    
    // 如果是今天，檢查時間是否已經過去
    const [hour, minute] = timeString.split(':').map(Number);
    const slotTime = new Date(today.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000);
    
    // 添加緩衝時間，提前15分鐘就不能預約
    const bufferTime = 15 * 60 * 1000; // 15分鐘的毫秒數
    const cutoffTime = new Date(now.getTime() + bufferTime);
    
    const isPast = slotTime <= cutoffTime;
    
    return isPast;
  }, [currentTime]);

  const generateTimeSlots = useCallback(() => {
    const slots = [];
    
    // 根據場地類型確定營業時間
    let startHour, endHour;
    if (court?.type === 'solo') {
      // 單人場營業時間：08:00-23:00
      startHour = 8;
      endHour = 23;
    } else {
      // 其他場地24小時營業
      startHour = 0;
      endHour = 24;
    }
    
    // 每1小時為一組，不提供半小時選項
    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endHour = hour + Math.floor(selectedDuration / 60);
      const endTime = `${endHour.toString().padStart(2, '0')}:00`;
      
      if (endHour <= 24) {
        const isPast = isTimeInPast(startTime, date);
        slots.push({
          start: startTime,
          end: endTime,
          available: !isPast, // 過去的時間設為不可用
          price: 0,
          isPast: isPast // 標記是否為過去時間
        });
      }
    }
    
    return slots;
  }, [selectedDuration, date, isTimeInPast, currentTime, forceUpdate, court?.type]);

  const checkSlotAvailability = useCallback(async (slot: { start: string; end: string }) => {
    if (!court || !date) return { available: false, price: 0 };
    
    try {
      const availability = await checkAvailability(court._id, date, slot.start, slot.end);
      return {
        available: availability.available,
        price: availability.pricing?.totalPrice || 0,
        slotName: availability.pricing?.slotName
      };
    } catch (error) {
      console.error('檢查可用性失敗:', error);
      return { available: false, price: 0 };
    }
  }, [court, date, checkAvailability]);

  useEffect(() => {
    if (court && date) {
      setLoading(true);
      
      // 直接在useEffect內部生成時間段，確保使用最新的currentTime
      const slots: Array<{ start: string; end: string; available: boolean; price: number; isPast: boolean }> = [];
      
      // 根據場地類型確定營業時間
      let startHour, endHour;
      if (court?.type === 'solo') {
        // 單人場營業時間：08:00-23:00
        startHour = 8;
        endHour = 23;
      } else {
        // 其他場地24小時營業
        startHour = 0;
        endHour = 24;
      }
      
      for (let hour = startHour; hour < endHour; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const slotEndHour = hour + Math.floor(selectedDuration / 60);
        const endTime = `${slotEndHour.toString().padStart(2, '0')}:00`;
        
        if (slotEndHour <= 24) {
          const isPast = isTimeInPast(startTime, date);
          slots.push({
            start: startTime,
            end: endTime,
            available: !isPast, // 過去的時間設為不可用
            price: 0,
            isPast: isPast // 標記是否為過去時間
          });
        }
      }
      
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
              available: slot.isPast ? false : availability.available, // 過去時間強制設為不可用
              price: availability.pricing?.totalPrice || 0,
              slotName: availability.pricing?.slotName
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
              return { 
                ...slot, 
                available: slot.isPast ? false : availability.available, // 過去時間強制設為不可用
                price: availability.price,
                slotName: availability.slotName
              };
            })
          ).then((results) => {
            setTimeSlots(results);
            setLoading(false);
          });
        });
    }
  }, [court, date, selectedDuration, forceUpdate, currentTime]);

  const handleSlotSelect = (slot: { start: string; end: string; available: boolean; price: number }) => {
    if (slot.available) {
      // 檢查價格是否有效
      if (slot.price === 0 || slot.price === undefined || slot.price === null) {
        console.error('❌ 時間段價格無效:', {
          start: slot.start,
          end: slot.end,
          price: slot.price,
          court: court?.name,
          courtType: court?.type
        });
        
        // 顯示錯誤提示
        alert(`錯誤：時間段 ${slot.start} - ${slot.end} 的價格信息缺失。請聯繫管理員或選擇其他時間段。`);
        return;
      }
      
      onSelect({ start: slot.start, end: slot.end });
      onAvailabilityChange({
        available: true,
        pricing: {
          totalPrice: slot.price,
          duration: selectedDuration,
          basePrice: slot.price
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
      <h2 className="text-2xl font-bold text-gray-900 mb-3">選擇時間</h2>
      <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <p className="text-lg font-semibold text-yellow-800">
          以下為 12 小時制（AM/PM），請確認時間
        </p>
      </div>
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
        
        {/* 調試按鈕 */}
        <div className="mt-4">
          <button
            onClick={() => {
              setCurrentTime(new Date());
              setForceUpdate(prev => prev + 1);
              console.log('🔄 手動更新時間:', new Date().toLocaleTimeString());
            }}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            刷新時間檢查
          </button>
          <span className="ml-2 text-xs text-gray-500">
            當前時間: {currentTime.toLocaleTimeString()}
          </span>
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
                    : (slot.price === 0 || slot.price === undefined || slot.price === null)
                      ? 'bg-red-50 border-2 border-red-300 text-red-700 hover:border-red-400'
                      : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md'
                  : (slot as any).isPast
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                  {slot.price} 積分{slot.slotName === '貓頭鷹時間' ? ' 🦉' : ''}
                </div>
              )}
              
              {slot.available && (slot.price === 0 || slot.price === undefined || slot.price === null) && (
                <div className="text-xs font-semibold mt-1 text-red-600">
                  ❌ 價格錯誤
                </div>
              )}
              
              {!slot.available && (
                <div className="text-xs mt-1">
                  {(slot as any).isPast ? '已過期' : '已預約'}
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
        <p>• 深灰色時段表示已過期（不能預約過去的時間）</p>
        <p>• 淺灰色時段表示已被預約</p>
        <p>• 價格可能因高峰時段而有所不同</p>
        <p>• 🦉 表示貓頭鷹時段（深夜優惠價）</p>
      </div>
    </div>
  );
};

export default TimeSlotSelector;
