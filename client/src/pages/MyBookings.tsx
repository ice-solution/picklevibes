import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useBooking } from '../contexts/BookingContext';
import CurrentBookings from '../components/Booking/CurrentBookings';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  MapPinIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const MyBookings: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary-100 rounded-xl">
              <CalendarDaysIcon className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">我的預約</h1>
              <p className="text-gray-600">查看和管理您的所有預約</p>
            </div>
          </div>
        </motion.div>

        {/* Bookings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserIcon className="w-6 h-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">所有預約</h2>
              </div>
              <div className="text-sm text-gray-500">
                顯示所有預約記錄
              </div>
            </div>
          </div>

          <div className="p-6">
            <CurrentBookings showAll={false} showUpcomingOnly={false} limit={0} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MyBookings;
