import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPinIcon,
  PhoneIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import DateSelector from './DateSelector';
import TimeSlotSelector from './TimeSlotSelector';
import type { StoreSummary } from '../../contexts/BookingContext';

const COURT_TYPE_LABEL: Record<string, string> = {
  competition: '比賽場',
  training: '訓練場',
  solo: '單人場',
  dink: '特色場',
};

interface PickCourtBookingPickerProps {
  store: StoreSummary | null;
  court: {
    _id: string;
    name: string;
    type: string;
    number: number;
    capacity: number;
    description?: string;
  } | null;
  selectedDate: string;
  selectedTimeSlot: { start: string; end: string } | null;
  maxAdvanceDays: number;
  loading?: boolean;
  onSelectDate: (date: string) => void;
  onSelectTime: (timeSlot: { start: string; end: string } | null) => void;
  onAvailabilityChange: (availability: unknown) => void;
}

const PickCourtBookingPicker: React.FC<PickCourtBookingPickerProps> = ({
  store,
  court,
  selectedDate,
  selectedTimeSlot,
  maxAdvanceDays,
  loading,
  onSelectDate,
  onSelectTime,
  onAvailabilityChange,
}) => {
  if (loading && !store) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-gold mx-auto" />
        <p className="mt-4 text-gray-600">載入場地資料…</p>
      </div>
    );
  }

  if (!store || !court) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>找不到場地資料，請返回店鋪頁重新選擇。</p>
        {store?.slug && (
          <Link
            to={`/store/${store.slug}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-pickcourt-gold hover:underline"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            返回 {store.name}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div
        className="rounded-xl border border-slate-200 p-5 sm:p-6"
        style={{ backgroundColor: 'var(--store-primary-soft, #f8fafc)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <Link
              to={`/store/${store.slug}`}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-2"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              返回場地介紹
            </Link>
            <p className="text-sm font-medium text-gray-500">{store.name}</p>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">{court.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {COURT_TYPE_LABEL[court.type] && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 text-gray-600 border border-slate-200">
                  {COURT_TYPE_LABEL[court.type]}
                </span>
              )}
              <span className="text-xs text-gray-500">#{court.number} · 最多 {court.capacity} 人</span>
            </div>
            {court.description && (
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">{court.description}</p>
            )}
          </div>
          <div className="text-sm text-gray-500 space-y-1 shrink-0">
            {store.address && (
              <p className="flex items-start gap-1.5">
                <MapPinIcon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{store.address}</span>
              </p>
            )}
            {store.phone && (
              <p className="flex items-center gap-1.5">
                <PhoneIcon className="w-4 h-4 shrink-0" />
                <a href={`tel:${store.phone}`} className="hover:text-gray-800">
                  {store.phone}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>

      <section id="booking-section-date" className="scroll-mt-24">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDaysIcon className="w-5 h-5 text-pickcourt-gold" />
          <h3 className="text-lg font-bold text-gray-900">選擇日期</h3>
        </div>
        <DateSelector
          onSelect={onSelectDate}
          selectedDate={selectedDate}
          maxAdvanceDays={maxAdvanceDays}
        />
      </section>

      {selectedDate && (
        <section id="booking-section-time" className="pt-6 border-t border-slate-100 scroll-mt-24">
          <div className="flex items-center gap-2 mb-4">
            <ClockIcon className="w-5 h-5 text-pickcourt-gold" />
            <h3 className="text-lg font-bold text-gray-900">選擇時段</h3>
          </div>
          <TimeSlotSelector
            court={court}
            date={selectedDate}
            onSelect={onSelectTime}
            selectedTimeSlot={selectedTimeSlot}
            onAvailabilityChange={onAvailabilityChange}
          />
        </section>
      )}
    </div>
  );
};

export default PickCourtBookingPicker;
