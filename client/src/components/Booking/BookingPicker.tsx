import React from 'react';
import StoreSelector from './StoreSelector';
import CourtSelector from './CourtSelector';
import DateSelector from './DateSelector';
import TimeSlotSelector from './TimeSlotSelector';
import type { StoreSummary } from '../../contexts/BookingContext';

interface BookingPickerProps {
  stores: StoreSummary[];
  selectedStore: StoreSummary | null;
  selectedCourt: any;
  selectedDate: string;
  selectedTimeSlot: { start: string; end: string } | null;
  maxAdvanceDays: number;
  loading?: boolean;
  onSelectStore: (store: StoreSummary) => void;
  onSelectCourt: (court: any) => void;
  onSelectDate: (date: string) => void;
  onSelectTime: (timeSlot: { start: string; end: string } | null) => void;
  onAvailabilityChange: (availability: any) => void;
}

const BookingPicker: React.FC<BookingPickerProps> = ({
  stores,
  selectedStore,
  selectedCourt,
  selectedDate,
  selectedTimeSlot,
  maxAdvanceDays,
  loading,
  onSelectStore,
  onSelectCourt,
  onSelectDate,
  onSelectTime,
  onAvailabilityChange,
}) => {
  return (
    <div className="space-y-10">
      <section id="booking-section-store" className="scroll-mt-24">
        <StoreSelector
          stores={stores}
          selectedStore={selectedStore}
          onSelect={onSelectStore}
          loading={loading && stores.length === 0}
        />
      </section>

      {selectedStore && (
        <section id="booking-section-court" className="pt-8 border-t border-gray-100 scroll-mt-24">
          <CourtSelector onSelect={onSelectCourt} selectedCourt={selectedCourt} />
        </section>
      )}

      {selectedStore && selectedCourt && (
        <section id="booking-section-date" className="pt-8 border-t border-gray-100 scroll-mt-24">
          <DateSelector
            onSelect={onSelectDate}
            selectedDate={selectedDate}
            maxAdvanceDays={maxAdvanceDays}
          />
        </section>
      )}

      {selectedStore && selectedCourt && selectedDate && (
        <section id="booking-section-time" className="pt-8 border-t border-gray-100 scroll-mt-24">
          <TimeSlotSelector
            court={selectedCourt}
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

export default BookingPicker;
