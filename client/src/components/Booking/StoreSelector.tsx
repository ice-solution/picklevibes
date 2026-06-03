import React from 'react';
import { motion } from 'framer-motion';
import { BuildingStorefrontIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import type { StoreSummary } from '../../contexts/BookingContext';

export type { StoreSummary as StoreOption };

interface StoreSelectorProps {
  stores: StoreSummary[];
  selectedStore: StoreSummary | null;
  onSelect: (store: StoreSummary) => void;
  loading?: boolean;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({
  stores,
  selectedStore,
  onSelect,
  loading,
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" aria-hidden />
        <p className="mt-4 text-gray-600">載入店鋪中...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">選擇店鋪</h2>
      <p className="text-gray-600 mb-8">請先選擇您要預約的店鋪，再選擇場地</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stores.map((store, index) => (
          <motion.button
            key={store._id}
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelect(store)}
            className={`text-left p-6 rounded-xl border-2 transition-all ${
              selectedStore?._id === store._id
                ? 'border-primary-500 bg-primary-50 shadow-md'
                : 'border-gray-200 hover:border-primary-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <BuildingStorefrontIcon className="w-8 h-8 text-primary-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
                <p className="text-sm text-gray-600 mt-2 flex items-start gap-1">
                  <MapPinIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{store.address}</span>
                </p>
                {store.phone ? (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <PhoneIcon className="w-4 h-4" />
                    {store.phone}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {stores.length === 0 && (
        <p className="text-center text-gray-500 py-8">暫無可預約店鋪</p>
      )}
    </div>
  );
};

export default StoreSelector;
