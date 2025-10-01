import React, { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import axios from 'axios';
import apiConfig from '../config/api';

interface Court {
  _id: string;
  name: string;
  number: number;
  type: 'indoor' | 'outdoor' | 'dink';
  description?: string;
  capacity: number;
  amenities: string[];
  pricing: {
    peakHour: number;
    offPeak: number;
    memberDiscount: number;
  };
  operatingHours: {
    [key: string]: {
      start: string;
      end: string;
      isOpen: boolean;
    };
  };
  isActive: boolean;
  images: Array<{
    url: string;
    alt: string;
    isPrimary: boolean;
  }>;
}

interface Player {
  name: string;
  email: string;
  phone: string;
}

interface Booking {
  _id: string;
  user: string | { _id: string; name: string; email: string };
  court: Court;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  players: Player[];
  totalPlayers: number;
  pricing: {
    basePrice: number;
    memberDiscount: number;
    totalPrice: number;
  };
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  payment: {
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    method: 'stripe' | 'cash' | 'bank_transfer';
    transactionId?: string;
    paidAt?: string;
    refundedAt?: string;
  };
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingContextType {
  courts: Court[];
  bookings: Booking[];
  selectedCourt: Court | null;
  selectedDate: string;
  selectedTimeSlot: { start: string; end: string } | null;
  players: Player[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchCourts: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  checkAvailability: (courtId: string, date: string, startTime: string, endTime: string) => Promise<any>;
  checkBatchAvailability: (courtId: string, date: string, timeSlots: Array<{startTime: string, endTime: string}>) => Promise<any>;
  createBooking: (bookingData: CreateBookingData) => Promise<Booking>;
  cancelBooking: (bookingId: string, reason?: string) => Promise<void>;
  setSelectedCourt: (court: Court | null) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTimeSlot: (timeSlot: { start: string; end: string } | null) => void;
  setPlayers: (players: Player[]) => void;
  clearError: () => void;
}

interface CreateBookingData {
  court: string;
  date: string;
  startTime: string;
  endTime: string;
  players: Player[];
  specialRequests?: string;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 防止重複調用的 ref
  const fetchingCourts = useRef(false);
  const fetchingBookings = useRef(false);

  const fetchCourts = useCallback(async () => {
    // 防止重複調用
    if (fetchingCourts.current) {
      console.log('fetchCourts already in progress, skipping...');
      return;
    }
    
    try {
      fetchingCourts.current = true;
      setLoading(true);
      const response = await axios.get('/courts');
      setCourts(response.data.courts);
    } catch (error: any) {
      setError(error.response?.data?.message || '獲取場地信息失敗');
    } finally {
      setLoading(false);
      fetchingCourts.current = false;
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    // 防止重複調用
    if (fetchingBookings.current) {
      console.log('fetchBookings already in progress, skipping...');
      return;
    }
    
    try {
      fetchingBookings.current = true;
      setLoading(true);
      
      // 獲取所有預約（不分頁）
      const response = await axios.get('/bookings?limit=100');
      setBookings(response.data.bookings);
    } catch (error: any) {
      setError(error.response?.data?.message || '獲取預約信息失敗');
    } finally {
      setLoading(false);
      fetchingBookings.current = false;
    }
  }, []);

  const checkAvailability = useCallback(async (courtId: string, date: string, startTime: string, endTime: string) => {
    try {
      const response = await axios.get(`/courts/${courtId}/availability`, {
        params: { date, startTime, endTime }
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '檢查可用性失敗');
    }
  }, []);

  const checkBatchAvailability = useCallback(async (courtId: string, date: string, timeSlots: Array<{startTime: string, endTime: string}>) => {
    try {
      const response = await axios.post(`/courts/${courtId}/availability/batch`, {
        date,
        timeSlots
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '批量檢查可用性失敗');
    }
  }, []);

  const createBooking = useCallback(async (bookingData: CreateBookingData): Promise<Booking> => {
    try {
      setLoading(true);
      const response = await axios.post('/bookings', bookingData);
      const newBooking = response.data.booking;
      setBookings(prev => [newBooking, ...prev]);
      return newBooking;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '創建預約失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelBooking = useCallback(async (bookingId: string, reason?: string) => {
    try {
      setLoading(true);
      await axios.put(`/bookings/${bookingId}/cancel`, { reason });
      setBookings(prev => 
        prev.map(booking => 
          booking._id === bookingId 
            ? { ...booking, status: 'cancelled' as const }
            : booking
        )
      );
    } catch (error: any) {
      throw new Error(error.response?.data?.message || '取消預約失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(() => ({
    courts,
    bookings,
    selectedCourt,
    selectedDate,
    selectedTimeSlot,
    players,
    loading,
    error,
    fetchCourts,
    fetchBookings,
    checkAvailability,
    checkBatchAvailability,
    createBooking,
    cancelBooking,
    setSelectedCourt,
    setSelectedDate,
    setSelectedTimeSlot,
    setPlayers,
    clearError
  }), [
    courts,
    bookings,
    selectedCourt,
    selectedDate,
    selectedTimeSlot,
    players,
    loading,
    error,
    fetchCourts,
    fetchBookings,
    checkAvailability,
    checkBatchAvailability,
    createBooking,
    cancelBooking,
    clearError
  ]);

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};
