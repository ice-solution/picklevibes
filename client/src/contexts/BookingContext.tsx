import React, { createContext, useContext, useState, useCallback, useMemo, useRef, ReactNode } from 'react';
import axios from 'axios';
import apiConfig from '../config/api';

export const BOOKING_STORE_STORAGE_KEY = 'picklevibes_selected_store_id';

export interface StoreSummary {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone?: string;
  enableHikAccess?: boolean;
}

interface Court {
  _id: string;
  store?: string | { _id: string; name: string };
  name: string;
  number: number;
  type: 'competition' | 'training' | 'solo' | 'dink' | 'full_venue';
  description?: string;
  capacity: number;
  amenities: string[];
  pricing: {
    peakHour: number;
    offPeak: number;
    memberDiscount: number;
    timeSlots?: Array<{
      startTime: string;
      endTime: string;
      price: number;
      name: string;
    }>;
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
    method: 'stripe' | 'cash' | 'bank_transfer' | 'points';
    transactionId?: string;
    paidAt?: string;
    refundedAt?: string;
    pointsDeducted?: number;
    originalPrice?: number;
    discount?: number;
  };
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingContextType {
  stores: StoreSummary[];
  selectedStore: StoreSummary | null;
  courts: Court[];
  bookings: Booking[];
  selectedCourt: Court | null;
  selectedDate: string;
  selectedTimeSlot: { start: string; end: string } | null;
  players: Player[];
  includeSoloCourt: boolean;
  soloCourtAvailable: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchStores: () => Promise<void>;
  fetchCourts: (storeId?: string) => Promise<void>;
  fetchBookings: () => Promise<void>;
  setSelectedStore: (store: StoreSummary | null) => void;
  checkAvailability: (courtId: string, date: string, startTime: string, endTime: string) => Promise<any>;
  checkBatchAvailability: (courtId: string, date: string, timeSlots: Array<{startTime: string, endTime: string}>) => Promise<any>;
  checkSoloCourtAvailability: (date: string, startTime: string, endTime: string) => Promise<boolean>;
  createBooking: (bookingData: CreateBookingData) => Promise<Booking>;
  cancelBooking: (bookingId: string, reason?: string) => Promise<void>;
  setSelectedCourt: (court: Court | null) => void;
  setSelectedDate: (date: string) => void;
  setSelectedTimeSlot: (timeSlot: { start: string; end: string } | null) => void;
  setPlayers: (players: Player[]) => void;
  setIncludeSoloCourt: (include: boolean) => void;
  clearError: () => void;
}

interface CreateBookingData {
  court: string;
  date: string;
  startTime: string;
  endTime: string;
  players: Player[];
  specialRequests?: string;
  includeSoloCourt?: boolean;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const BookingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [selectedStore, setSelectedStoreState] = useState<StoreSummary | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ start: string; end: string } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [includeSoloCourt, setIncludeSoloCourt] = useState(false);
  const [soloCourtAvailable, setSoloCourtAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 防止重複調用的 ref
  const fetchingCourts = useRef(false);
  const fetchingBookings = useRef(false);

  const fetchStores = useCallback(async () => {
    try {
      const response = await axios.get('/stores');
      const list: StoreSummary[] = response.data.stores || [];
      setStores(list);
      const savedId = localStorage.getItem(BOOKING_STORE_STORAGE_KEY);
      if (savedId) {
        const remembered = list.find((s) => s._id === savedId);
        if (remembered) setSelectedStoreState(remembered);
      }
    } catch (error: any) {
      console.error('獲取店鋪失敗:', error);
      setError(error.response?.data?.message || '獲取店鋪失敗');
    }
  }, []);

  const setSelectedStore = useCallback((store: StoreSummary | null) => {
    setSelectedStoreState(store);
    if (store) {
      localStorage.setItem(BOOKING_STORE_STORAGE_KEY, store._id);
    } else {
      localStorage.removeItem(BOOKING_STORE_STORAGE_KEY);
    }
    setSelectedCourt(null);
    setSelectedDate('');
    setSelectedTimeSlot(null);
  }, []);

  const fetchCourts = useCallback(async (storeId?: string) => {
    if (fetchingCourts.current) {
      return;
    }
    const sid = storeId ?? selectedStore?._id;
    const url = sid ? `/courts?store=${sid}` : '/courts?all=true';

    try {
      fetchingCourts.current = true;
      setLoading(true);
      const response = await axios.get(url);
      setCourts(response.data.courts || []);
    } catch (error: any) {
      console.error('獲取場地信息失敗:', error);
      setError(error.response?.data?.message || '獲取場地信息失敗');
    } finally {
      setLoading(false);
      fetchingCourts.current = false;
    }
  }, [selectedStore?._id]);

  const fetchBookings = useCallback(async () => {
    // 防止重複調用
    if (fetchingBookings.current) {
      console.log('fetchBookings already in progress, skipping...');
      return;
    }
    
    try {
      fetchingBookings.current = true;
      setLoading(true);
      console.log('開始獲取預約信息...');
      
      // 獲取所有預約（不分頁）
      const response = await axios.get('/bookings?limit=100');
      console.log('預約信息獲取成功:', response.data.bookings.length, '個預約');
      setBookings(response.data.bookings);
    } catch (error: any) {
      console.error('獲取預約信息失敗:', error);
      setError(error.response?.data?.message || '獲取預約信息失敗');
    } finally {
      setLoading(false);
      fetchingBookings.current = false;
      console.log('fetchBookings 完成，重置標誌');
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

  const checkSoloCourtAvailability = useCallback(async (date: string, startTime: string, endTime: string) => {
    try {
      console.log('🔍 檢查單人場可用性:', { date, startTime, endTime });
      
      // 找到單人場
      const selectedStoreId = selectedCourt
        ? (typeof selectedCourt.store === 'object' ? selectedCourt.store?._id : selectedCourt.store)
        : selectedStore?._id;
      const soloCourt = courts.find(
        (court) =>
          court.type === 'solo' &&
          (!selectedStoreId ||
            (typeof court.store === 'object'
              ? court.store?._id === selectedStoreId
              : court.store === selectedStoreId))
      );
      if (!soloCourt) {
        console.log('❌ 找不到單人場');
        setSoloCourtAvailable(false);
        return false;
      }

      console.log('📋 找到單人場:', soloCourt.name);

      // 只檢查時間衝突，不檢查營業時間（因為是連同比賽場一起租用）
      const response = await axios.get(`/courts/${soloCourt._id}/availability`, {
        params: { date, startTime, endTime }
      });
      
      console.log('📡 API 回應:', response.data);
      
      // 如果 API 返回不可用，檢查是否只是營業時間問題
      if (!response.data.available && response.data.reason === '場地在該時間段不開放') {
        console.log('✅ 忽略營業時間限制，允許 24 小時');
        // 營業時間限制，但對於連同比賽場租用，我們允許 24 小時
        setSoloCourtAvailable(true);
        return true;
      }
      
      const isAvailable = response.data.available;
      console.log('🎯 單人場可用性:', isAvailable);
      setSoloCourtAvailable(isAvailable);
      return isAvailable;
    } catch (error: any) {
      console.error('❌ 檢查單人場可用性失敗:', error);
      setSoloCourtAvailable(false);
      return false;
    }
  }, [courts, selectedCourt, selectedStore?._id]);

  const createBooking = useCallback(async (bookingData: CreateBookingData): Promise<Booking> => {
    try {
      setLoading(true);
      const response = await axios.post('/bookings', bookingData);
      const newBooking = response.data.booking;
      setBookings(prev => [newBooking, ...prev]);
      return newBooking;
    } catch (error: any) {
      const message = error.response?.data?.message || '創建預約失敗';
      const bookingError = new Error(message) as Error & { isInsufficientBalance?: boolean };
      bookingError.isInsufficientBalance =
        message.includes('積分餘額不足') || message.includes('餘額不足');
      throw bookingError;
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
    stores,
    selectedStore,
    courts,
    bookings,
    selectedCourt,
    selectedDate,
    selectedTimeSlot,
    players,
    includeSoloCourt,
    soloCourtAvailable,
    loading,
    error,
    fetchStores,
    fetchCourts,
    fetchBookings,
    setSelectedStore,
    checkAvailability,
    checkBatchAvailability,
    checkSoloCourtAvailability,
    createBooking,
    cancelBooking,
    setSelectedCourt,
    setSelectedDate,
    setSelectedTimeSlot,
    setPlayers,
    setIncludeSoloCourt,
    clearError
  }), [
    stores,
    selectedStore,
    courts,
    bookings,
    selectedCourt,
    selectedDate,
    selectedTimeSlot,
    players,
    includeSoloCourt,
    soloCourtAvailable,
    loading,
    error,
    fetchStores,
    fetchCourts,
    fetchBookings,
    setSelectedStore,
    checkAvailability,
    checkBatchAvailability,
    checkSoloCourtAvailability,
    createBooking,
    cancelBooking,
    setIncludeSoloCourt,
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
