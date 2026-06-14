import React from 'react';
import StoreSelector from './StoreSelector';
import CourtSelector from './CourtSelector';
import DateSelector from './DateSelector';
import type { StoreSummary } from '../../contexts/BookingContext';

interface BookingPickerProps {
  stores: StoreSummary[];
  selectedStore: StoreSummary | null;
  selectedCourt: any;
  selectedDate: string;
  maxAdvanceDays: number;
  loading?: boolean;
  onSelectStore: (store: StoreSummary) => void;
  onSelectCourt: (court: any) => void;
  onSelectDate: (date: string) => void;
}

const BookingPicker: React.FC<BookingPickerProps> = ({
  stores,
  selectedStore,
  selectedCourt,
  selectedDate,
  maxAdvanceDays,
  loading,
  onSelectStore,
  onSelectCourt,
  onSelectDate,
}) => {
  return (
    <div className="space-y-10">
      <section>
        <StoreSelector
          stores={stores}
          selectedStore={selectedStore}
          onSelect={onSelectStore}
          loading={loading && stores.length === 0}
        />
      </section>

      {selectedStore && (
        <section className="pt-8 border-t border-gray-100">
          <CourtSelector
            onSelect={onSelectCourt}
            selectedCourt={selectedCourt}
          />
        </section>
      )}

      {selectedStore && selectedCourt && (
        <section className="pt-8 border-t border-gray-100">
          <DateSelector
            onSelect={onSelectDate}
            selectedDate={selectedDate}
            maxAdvanceDays={maxAdvanceDays}
          />
        </section>
      )}
    </div>
  );
};

export default BookingPicker;
