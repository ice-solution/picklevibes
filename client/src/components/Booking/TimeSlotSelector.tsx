import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { checkAvailability, checkBatchAvailability } = useBooking();
  const [timeSlots, setTimeSlots] = useState<Array<{ start: string; end: string; available: boolean; price: number; slotName?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(60); // 默認1小時
  const [currentTime, setCurrentTime] = useState(new Date()); // 添加當前時間狀態
  const [forceUpdate, setForceUpdate] = useState(0); // 強制更新計數器

  const durations = [
    { value: 60, label: t('bookingPage.timeSlotSelector.durations.1h') },
    { value: 120, label: t('bookingPage.timeSlotSelector.durations.2h') }
  ];

  /** 由場地 operatingHours 取當日開放小時範圍（結束小時為不可達上界，如 22 表示開到 22:00） */
  const getCourtOpenHourRange = (courtDoc: any, selectedDate: string) => {
    const fallback =
      courtDoc?.type === 'solo'
        ? { startHour: 8, endHour: 23 }
        : { startHour: 0, endHour: 24 };

    const hours = courtDoc?.operatingHours;
    if (!hours) return fallback;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const [y, m, d] = String(selectedDate).slice(0, 10).split('-').map(Number);
    const localDate = y && m && d ? new Date(y, m - 1, d) : new Date(selectedDate);
    const dayKey = dayNames[localDate.getDay()];
    const day = hours[dayKey];
    if (!day || day.isOpen === false) return { startHour: 0, endHour: 0 };

    const parseHour = (t: string, isEnd = false) => {
      if (!t) return isEnd ? 24 : 0;
      if (t === '24:00' || t.startsWith('24:')) return 24;
      const [hh, mm] = t.split(':').map(Number);
      if (isEnd && mm > 0) return Math.min(24, hh + 1); // 非整點結束：保守多開一小時格
      return hh;
    };

    return {
      startHour: parseHour(day.start || '00:00', false),
      endHour: parseHour(day.end || '24:00', true),
    };
  };

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
    const { startHour, endHour } = getCourtOpenHourRange(court, date);

    for (let hour = startHour; hour < endHour; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const slotEndHour = hour + Math.floor(selectedDuration / 60);
      const endTime =
        slotEndHour >= 24 ? '24:00' : `${slotEndHour.toString().padStart(2, '0')}:00`;

      // 結束時間不可超過場地營業結束（例：收場 22:00 則 21:00 起唔可以訂 2 小時）
      if (slotEndHour > endHour) continue;

      const isPast = isTimeInPast(startTime, date);
      slots.push({
        start: startTime,
        end: endTime,
        available: !isPast,
        price: 0,
        isPast,
      });
    }

    return slots;
  }, [selectedDuration, date, isTimeInPast, court]);

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

      const slots = generateTimeSlots();

      // 使用批量 API 檢查所有時段的可用性
      const timeSlotData = slots.map((slot) => ({
        startTime: slot.start,
        endTime: slot.end,
      }));

      checkBatchAvailability(court._id, date, timeSlotData)
        .then((batchResult) => {
          type BatchSlot = {
            startTime?: string;
            endTime?: string;
            available?: boolean;
            pricing?: { totalPrice?: number; slotName?: string };
          };
          const byKey = new Map<string, BatchSlot>(
            (batchResult.timeSlots || []).map((a: BatchSlot) => [
              `${a.startTime}-${a.endTime}`,
              a,
            ])
          );
          const results = slots.map((slot) => {
            const availability = byKey.get(`${slot.start}-${slot.end}`);
            return {
              ...slot,
              available: slot.isPast ? false : Boolean(availability?.available),
              price: availability?.pricing?.totalPrice || 0,
              slotName: availability?.pricing?.slotName,
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
                available: slot.isPast ? false : availability.available,
                price: availability.price,
                slotName: availability.slotName,
              };
            })
          ).then((results) => {
            setTimeSlots(results);
            setLoading(false);
          });
        });
    }
  }, [court, date, selectedDuration, forceUpdate, currentTime, generateTimeSlots, checkBatchAvailability, checkSlotAvailability]);

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
        alert(t('bookingPage.courtSelector.priceError', { start: slot.start, end: slot.end }));
        return;
      }
      
      onSelect({ start: slot.start, end: slot.end });
      onAvailabilityChange({
        available: true,
        pricing: {
          totalPrice: slot.price,
          duration: selectedDuration,
          basePrice: slot.price,
          slotName: (slot as any).slotName,
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
        <p className="text-gray-600">{t('bookingPage.timeSlotSelector.needCourtAndDate')}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
        {t('bookingPage.timeSlotSelector.title')}
      </h2>
      <div className="hidden sm:block mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <p className="text-lg font-semibold text-yellow-800">
          {t('bookingPage.timeSlotSelector.ampmNotice')}
        </p>
      </div>
      <p className="hidden sm:block text-gray-600 mb-8">{t('bookingPage.timeSlotSelector.subtitle')}</p>

      {/* 時長選擇 */}
      <div className="mb-4 sm:mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-3">
          {t('bookingPage.timeSlotSelector.duration')}
        </label>
        <div className="flex gap-2">
          {durations.map((duration) => (
            <button
              key={duration.value}
              type="button"
              onClick={() => setSelectedDuration(duration.value)}
              className={`flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
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

      {/* 時間段選擇：每格顯示該時段收費 */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('bookingPage.timeSlotSelector.checking')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {timeSlots.map((slot, index) => (
            <motion.button
              key={index}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
              onClick={() => handleSlotSelect(slot)}
              disabled={!slot.available}
              className={`relative p-3 sm:p-4 rounded-lg text-center transition-all duration-200 min-h-[72px] sm:min-h-0 ${
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
                <CheckCircleIcon className="absolute top-1.5 right-1.5 w-4 h-4 sm:w-5 sm:h-5 text-white" />
              )}
              
              <div className="text-sm font-semibold sm:font-medium">
                {formatTime(slot.start)}
              </div>
              <div className="text-[11px] sm:text-xs opacity-75">
                – {formatTime(slot.end)}
              </div>
              
              {slot.available && slot.price > 0 && (
                <div className="text-xs sm:text-xs font-bold sm:font-semibold mt-1">
                  {slot.price} {t('common.currency')}
                  <span className="hidden sm:inline">{slot.slotName === '貓頭鷹時間' ? ' 🦉' : ''}</span>
                </div>
              )}
              
              {slot.available && (slot.price === 0 || slot.price === undefined || slot.price === null) && (
                <div className="text-xs font-semibold mt-1 text-red-600">
                  ❌ {t('bookingPage.timeSlotSelector.priceErrorShort')}
                </div>
              )}
              
              {!slot.available && (
                <div className="text-[11px] sm:text-xs mt-1">
                  {(slot as any).isPast ? t('bookingPage.timeSlotSelector.expired') : t('bookingPage.timeSlotSelector.booked')}
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
          className="mt-4 sm:mt-6 p-3 sm:p-4 bg-primary-50 rounded-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ClockIcon className="w-5 h-5 text-primary-600 shrink-0" />
              <span className="text-primary-800 font-medium text-sm sm:text-base truncate">
                {t('bookingPage.timeSlotSelector.selected', {
                  start: formatTime(selectedTimeSlot.start),
                  end: formatTime(selectedTimeSlot.end),
                })}
              </span>
            </div>
            {(() => {
              const p = timeSlots.find(
                (s) => s.start === selectedTimeSlot.start && s.end === selectedTimeSlot.end
              )?.price;
              return p != null && p > 0 ? (
                <span className="shrink-0 font-bold text-primary-700">
                  {p} {t('common.currency')}
                </span>
              ) : null;
            })()}
          </div>
        </motion.div>
      )}

      {/* 說明：僅 desktop */}
      <div className="hidden sm:block mt-6 text-sm text-gray-500">
        <p>• {t('bookingPage.timeSlotSelector.expiredHint')}</p>
        <p>• {t('bookingPage.timeSlotSelector.bookedHint')}</p>
        <p>• {t('bookingPage.timeSlotSelector.priceHint')}</p>
        <p>• {t('bookingPage.timeSlotSelector.owlHint')}</p>
      </div>
    </div>
  );
};

export default TimeSlotSelector;
