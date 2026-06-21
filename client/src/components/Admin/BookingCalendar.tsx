import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import CreateBookingModal from './CreateBookingModal';
import UserAutocomplete from '../Common/UserAutocomplete';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  BuildingStorefrontIcon,
  EyeIcon,
  XMarkIcon,
  PlusIcon,
  ChatBubbleLeftIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface StoreRef {
  _id: string;
  name: string;
  slug?: string;
}

/** 日曆列表（精簡 API） */
interface CalendarBooking {
  _id: string;
  store?: StoreRef | string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  court: {
    _id: string;
    name: string;
    number: string;
    type: string;
    store?: StoreRef | string;
  };
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  specialRequests?: string;
  specialRequestsProcessed?: boolean;
  adminNoteCount?: number;
  createdAt: string;
  venueBundleId?: string | null;
  venueBundleKind?: string | null;
  isFullVenue?: boolean;
  fullVenueBookings?: string[];
}

/** 詳情彈窗（點擊後另取完整資料） */
interface Booking extends CalendarBooking {
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  players: Array<{
    name: string;
    email: string;
    phone: string;
  }>;
  payment: {
    method: string;
    status: string;
    amount: number;
    pointsDeducted?: number;
  };
  noUserBalanceDebited?: boolean;
  bypassRestrictions?: boolean;
  venueBundleKind?: string | null;
  isFullVenue?: boolean;
  specialRequests?: string;
  pricing: {
    totalPrice: number;
    duration: number;
    basePrice: number;
    isCustomPoints?: boolean;
    customPoints?: number;
  };
  adminNotes?: Array<{
    _id: string;
    content: string;
    createdBy: {
      _id: string;
      name: string;
      email: string;
    };
    createdAt: string;
  }>;
  updatedAt: string;
}

/** 香港時間 2026-04-15 00:00:00；與預約「建立時間 createdAt」比較（非場次活動日） */
const LEGACY_BOOKING_CUTOFF_MS = new Date('2026-04-15T00:00:00+08:00').getTime();

function getHongKongCalendarYmd(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function hkWallTimeToUtcMs(ymd: string, hhmm: string): number {
  const parts = hhmm.split(':');
  const h = Number(parts[0]);
  const min = Number(parts[1] ?? 0);
  const hh = String(h).padStart(2, '0');
  const mm = String(min).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00+08:00`).getTime();
}

function addDaysToYmd(ymd: string, days: number): string {
  const noonMs = hkWallTimeToUtcMs(ymd, '12:00');
  return getHongKongCalendarYmd(new Date(noonMs + days * 86400000));
}

function resolveBookingStoreName(booking: CalendarBooking | Booking): string {
  const fromBooking = booking.store;
  if (fromBooking && typeof fromBooking === 'object' && fromBooking.name) {
    return fromBooking.name;
  }
  const fromCourt = booking.court?.store;
  if (fromCourt && typeof fromCourt === 'object' && fromCourt.name) {
    return fromCourt.name;
  }
  return '（未指派店鋪）';
}

/** 包場整組只顯示一條日曆事件 */
function collapseFullVenueCalendarBookings(bookings: CalendarBooking[]): CalendarBooking[] {
  const childIds = new Set<string>();
  for (const b of bookings) {
    if (b.isFullVenue && b.fullVenueBookings?.length) {
      b.fullVenueBookings.forEach((id) => childIds.add(String(id)));
    }
  }

  const bundleGroups = new Map<string, CalendarBooking[]>();
  for (const b of bookings) {
    if (b.venueBundleKind === 'full_venue' && b.venueBundleId) {
      const key = String(b.venueBundleId);
      if (!bundleGroups.has(key)) bundleGroups.set(key, []);
      bundleGroups.get(key)!.push(b);
    }
  }

  const bundleCounts = new Map<string, number>();
  bundleGroups.forEach((group: CalendarBooking[]) => {
    const leader = group.find((b: CalendarBooking) => b.isFullVenue) || group[0];
    if (!leader) return;
    bundleCounts.set(String(leader._id), group.length);
    group.forEach((b: CalendarBooking) => {
      if (String(b._id) !== String(leader._id)) childIds.add(String(b._id));
    });
  });

  return bookings
    .filter((b) => !childIds.has(String(b._id)))
    .map((b) => {
      const count = bundleCounts.get(String(b._id));
      if (count && count > 1) {
        return { ...b, _collapsedFullVenueCount: count } as CalendarBooking & { _collapsedFullVenueCount?: number };
      }
      return b;
    });
}

/** 預約結束時間（香港）；24:00 為翌日 00:00（HKT）；跨日時段則加一日 */
function hkBookingEndToUtcMs(ymd: string, endTime: string, startMs: number): number {
  if (endTime === '24:00') {
    return hkWallTimeToUtcMs(addDaysToYmd(ymd, 1), '00:00');
  }
  let endMs = hkWallTimeToUtcMs(ymd, endTime);
  if (endMs <= startMs) {
    endMs = hkWallTimeToUtcMs(addDaysToYmd(ymd, 1), endTime);
  }
  return endMs;
}

const BookingCalendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('dayGridMonth');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [storeFilterId, setStoreFilterId] = useState<string>('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState<string>('');
  const [settleUser, setSettleUser] = useState<{ _id: string; name: string; email: string; phone?: string } | null>(null);
  const [settlePoints, setSettlePoints] = useState('');
  const [settleReason, setSettleReason] = useState('預約結算');
  const [settleUserBalance, setSettleUserBalance] = useState<number | null>(null);
  const [settleInfo, setSettleInfo] = useState<{
    eligible: boolean;
    alreadySettled?: boolean;
    suggestedPoints: number;
    bundleCount?: number;
    isFullVenue?: boolean;
    label?: string | null;
    bundleBreakdown?: Array<{ id: string; courtName: string; pointsDeducted: number }>;
  } | null>(null);
  const [settling, setSettling] = useState(false);
  const calendarRangeRef = useRef<{ start: string; end: string } | null>(null);
  /** 避免 datesSet 與 events 更新連鎖造成重複請求／loading 卡死 */
  const lastFetchedRangeKeyRef = useRef<string>('');

  const fetchBookings = useCallback(
    async (range?: { start: string; end: string }) => {
      const r = range ?? calendarRangeRef.current;
      if (!r?.start || !r?.end) {
        return;
      }
      try {
        setEventsLoading(true);
        setError(null);
        const params = new URLSearchParams({
          dateFrom: r.start,
          dateTo: r.end,
        });
        if (storeFilterId) {
          params.append('store', storeFilterId);
        }
        const response = await axios.get(`/bookings/admin/calendar?${params.toString()}`);
        setBookings(response.data.bookings || []);
      } catch (error: any) {
        console.error('獲取預約列表失敗:', error);
        setError(error.response?.data?.message || '獲取預約列表失敗');
      } finally {
        setEventsLoading(false);
      }
    },
    [storeFilterId]
  );

  useEffect(() => {
    axios
      .get('/stores/admin/all')
      .then((r) => setStores(r.data.stores || []))
      .catch(() => setStores([]));
  }, []);

  const refetchBookings = useCallback(
    () => fetchBookings(calendarRangeRef.current ?? undefined),
    [fetchBookings]
  );

  /** 避免 FullCalendar 回傳不同字串格式導致誤判為新範圍而無限 refetch */
  const calendarRangeKey = (startStr: string, endStr: string) => {
    const d = (s: string) =>
      s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
    return `${d(startStr)}|${d(endStr)}`;
  };

  const handleDatesSet = useCallback(
    (info: { startStr: string; endStr: string }) => {
      calendarRangeRef.current = { start: info.startStr, end: info.endStr };
      const key = calendarRangeKey(info.startStr, info.endStr);
      if (key === lastFetchedRangeKeyRef.current) {
        return;
      }
      lastFetchedRangeKeyRef.current = key;
      fetchBookings({ start: info.startStr, end: info.endStr });
    },
    [fetchBookings]
  );

  useEffect(() => {
    lastFetchedRangeKeyRef.current = '';
    if (calendarRangeRef.current) {
      fetchBookings(calendarRangeRef.current);
    }
  }, [storeFilterId, fetchBookings]);

  useEffect(() => {
    const onFocus = () => {
      if (calendarRangeRef.current) {
        fetchBookings(calendarRangeRef.current);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchBookings]);

  const getCourtTypeColor = (courtType: string, status: string) => {
    // 如果狀態是已取消，統一使用灰色
    if (status === 'cancelled') {
      return '#9CA3AF'; // gray-400
    }
    
    // 根據場地類型設置顏色
    switch (courtType) {
      case 'competition':
        return status === 'confirmed' ? '#3B82F6' : '#60A5FA'; // blue-500 : blue-400
      case 'training':
        return status === 'confirmed' ? '#10B981' : '#34D399'; // green-500 : green-400
      case 'solo':
        return status === 'confirmed' ? '#8B5CF6' : '#A78BFA'; // violet-500 : violet-400
      case 'dink':
        return status === 'confirmed' ? '#F59E0B' : '#FBBF24'; // amber-500 : amber-400
      default:
        return status === 'confirmed' ? '#6B7280' : '#9CA3AF'; // gray-500 : gray-400
    }
  };

  // 將預約數據轉換為FullCalendar事件格式（必須 memo，否則每次父層 render 新陣列會觸發 FC 內部 datesSet → 無限 refetch、無法換月）
  const events = useMemo(
    () =>
      collapseFullVenueCalendarBookings(bookings).map((booking) => {
    const collapsedCount = (booking as CalendarBooking & { _collapsedFullVenueCount?: number })._collapsedFullVenueCount;
    const isCollapsedFullVenue = collapsedCount && collapsedCount > 1;
    const ymdHk = getHongKongCalendarYmd(booking.date);
    const startMs = hkWallTimeToUtcMs(ymdHk, booking.startTime);
    const endMs = hkBookingEndToUtcMs(ymdHk, booking.endTime, startMs);
    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    // 檢查狀態
    const hasSpecialRequests = booking.specialRequests && booking.specialRequests.trim().length > 0;
    const hasAdminNotes = (booking.adminNoteCount ?? 0) > 0;
    const isSpecialRequestsProcessed = booking.specialRequestsProcessed === true;
    
    // 計算邊框顏色和樣式
    // 如果特殊要求已處理，使用綠色；否則如果有特殊要求，使用紅色
    // 如果有留言，使用藍色
    // 如果有多個狀態，使用漸變色
    let borderColor = isCollapsedFullVenue
      ? '#6366F1'
      : getCourtTypeColor(booking.court.type, booking.status);
    let classNames: string[] = [];
    
    // 構建狀態數組
    const states: string[] = [];
    if (hasSpecialRequests && !isSpecialRequestsProcessed) {
      states.push('special-request');
    }
    if (isSpecialRequestsProcessed) {
      states.push('processed');
    }
    if (hasAdminNotes) {
      states.push('has-notes');
    }
    
    // 包場：彩色橫向漸層（左→右 = 比賽/訓練/單人/發球機）
    if (isCollapsedFullVenue) {
      classNames.push('booking-full-venue');
      if (booking.status === 'cancelled') {
        classNames.push('booking-full-venue-cancelled');
      }
      if (hasSpecialRequests && !isSpecialRequestsProcessed) {
        classNames.push('booking-full-venue-alert');
      } else if (isSpecialRequestsProcessed) {
        classNames.push('booking-full-venue-processed');
      } else if (hasAdminNotes) {
        classNames.push('booking-full-venue-notes');
      }
    } else if (states.length === 1) {
      // 單一狀態
      if (states[0] === 'special-request') {
        borderColor = '#DC2626'; // 紅色 - 特殊要求未處理
        classNames.push('booking-red-border');
      } else if (states[0] === 'processed') {
        borderColor = '#10B981'; // 綠色 - 已處理
        classNames.push('booking-green-border');
      } else if (states[0] === 'has-notes') {
        borderColor = '#3B82F6'; // 藍色 - 有留言
        classNames.push('booking-blue-border');
      }
    } else if (!isCollapsedFullVenue && states.length === 2) {
      // 兩個狀態，使用漸變色
      classNames.push('booking-gradient-border');
      // 根據狀態組合決定漸變方向
      if (states.includes('special-request') && states.includes('has-notes')) {
        classNames.push('gradient-red-blue');
      } else if (states.includes('special-request') && states.includes('processed')) {
        classNames.push('gradient-red-green');
      } else if (states.includes('processed') && states.includes('has-notes')) {
        classNames.push('gradient-green-blue');
      }
    } else if (!isCollapsedFullVenue && states.length === 3) {
      // 三個狀態，使用三色漸變
      classNames.push('booking-gradient-border');
      classNames.push('gradient-red-blue-green');
    }

    const createdMs = booking.createdAt ? new Date(booking.createdAt).getTime() : NaN;
    if (!Number.isNaN(createdMs) && createdMs < LEGACY_BOOKING_CUTOFF_MS) {
      classNames.push('booking-legacy-cutoff-frame');
    }

    // 計算最終的邊框顏色和寬度
    let finalBorderColor = borderColor;
    let finalBorderWidth = 1;
    
    if (isCollapsedFullVenue) {
      finalBorderColor = 'transparent';
      finalBorderWidth = 0;
    } else if (classNames.includes('booking-gradient-border')) {
      // 漸變色邊框時，使用透明邊框，讓 CSS 處理漸變
      finalBorderColor = 'transparent';
      finalBorderWidth = 0;
    } else if (states.length > 0) {
      // 單一狀態時，使用實色邊框
      // 已處理狀態使用更粗的邊框（5px），其他狀態使用 3px
      if (states[0] === 'processed') {
        finalBorderWidth = 5;
      } else {
        finalBorderWidth = 3;
      }
    }

    const storeLabel = resolveBookingStoreName(booking);
    const title = isCollapsedFullVenue
      ? (storeFilterId
          ? `🏢 包場 (${collapsedCount}場) - ${booking.user.name}`
          : `[${storeLabel}] 🏢 包場 (${collapsedCount}場) - ${booking.user.name}`)
      : (storeFilterId
          ? `${booking.court.name} - ${booking.user.name}`
          : `[${storeLabel}] ${booking.court.name} - ${booking.user.name}`);

    return {
      id: booking._id,
      title,
      start: startDate,
      end: endDate,
      backgroundColor: isCollapsedFullVenue ? 'transparent' : getCourtTypeColor(booking.court.type, booking.status),
      borderColor: finalBorderColor,
      borderWidth: finalBorderWidth,
      textColor: 'white',
      classNames: classNames.length > 0 ? classNames.join(' ') : undefined,
      extendedProps: {
        booking: booking,
        states: states
      }
    };
      }),
    [bookings, storeFilterId]
  );

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '已確認';
      case 'pending':
        return '待確認';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const isBookingPendingSettle = (booking: Booking, info?: typeof settleInfo) => {
    if (info) return info.eligible;
    if (booking.status === 'cancelled') return false;
    const method = booking.payment?.method;
    const pts = Number(booking.payment?.pointsDeducted) || 0;
    if (method === 'points' && pts > 0 && !booking.noUserBalanceDebited) return false;
    if (['cash', 'bank_transfer', 'stripe'].includes(method) && booking.payment?.status === 'paid') {
      return false;
    }
    return (
      method === 'admin_waived' ||
      booking.noUserBalanceDebited === true ||
      (method === 'points' && pts === 0)
    );
  };

  const isFullVenueBooking = (booking: Booking) =>
    booking.venueBundleKind === 'full_venue' ||
    booking.isFullVenue === true ||
    String(booking.specialRequests || '').includes('包場');

  const getSuggestedSettlePoints = (booking: Booking, info?: typeof settleInfo) => {
    if (info?.suggestedPoints) return info.suggestedPoints;
    if (booking.pricing?.isCustomPoints && booking.pricing.customPoints) {
      return booking.pricing.customPoints;
    }
    return booking.pricing?.totalPrice || 0;
  };

  const getDisplayChargePoints = (booking: Booking, info?: typeof settleInfo) => {
    const paid = Number(booking.payment?.pointsDeducted) || 0;
    const isFV = info?.isFullVenue || isFullVenueBooking(booking);
    const bundleCount =
      info?.bundleCount ||
      (booking.isFullVenue && booking.fullVenueBookings
        ? booking.fullVenueBookings.length + 1
        : isFV
          ? 2
          : 0);

    if (booking.payment?.method === 'points' && paid > 0 && !booking.noUserBalanceDebited) {
      if (isFV && bundleCount > 1) {
        const bundleTotal = info?.suggestedPoints && info.suggestedPoints > paid
          ? info.suggestedPoints
          : info?.suggestedPoints || paid;
        return {
          amount: bundleTotal,
          suffix: '已結算 · 包場總收',
          courtShare: paid,
          bundleCount,
        };
      }
      return { amount: paid, suffix: '已結算', courtShare: null, bundleCount: 0 };
    }
    if (isBookingPendingSettle(booking, info)) {
      return {
        amount: getSuggestedSettlePoints(booking, info),
        suffix: `待結算${info?.label ? ` · ${info.label}` : ''}`,
        courtShare: null,
        bundleCount: isFV ? bundleCount : 0,
      };
    }
    return { amount: booking.pricing?.totalPrice || 0, suffix: null, courtShare: null, bundleCount: 0 };
  };

  const resetSettleForm = () => {
    setSettleUser(null);
    setSettlePoints('');
    setSettleReason('預約結算');
    setSettleUserBalance(null);
    setSettleInfo(null);
    setSettling(false);
  };

  const initSettleForm = (booking: Booking, info?: typeof settleInfo) => {
    setSettleUser(null);
    setSettlePoints(String(getSuggestedSettlePoints(booking, info) || ''));
    setSettleReason('預約結算');
    setSettleUserBalance(null);
    setSettling(false);
  };

  const handleSettleUserChange = async (user: { _id: string; name: string; email: string; phone?: string } | null) => {
    setSettleUser(user);
    setSettleUserBalance(null);
    if (!user) return;
    try {
      const response = await axios.get(`/users/${user._id}`);
      setSettleUserBalance(response.data.user?.balance ?? null);
    } catch {
      setSettleUserBalance(null);
    }
  };

  const handleSettleBooking = async () => {
    if (!selectedBooking || !settleUser || !settlePoints) return;
    const points = parseInt(settlePoints, 10);
    if (points <= 0) {
      alert('扣款積分必須大於 0');
      return;
    }
    if (settleUserBalance !== null && settleUserBalance < points) {
      alert(`用戶餘額不足！當前：${settleUserBalance}，需要：${points}`);
      return;
    }
    const courtLabel = settleInfo?.isFullVenue
      ? `包場（${settleInfo.bundleCount || 3} 個場地）`
      : selectedBooking.court?.name || '場地';
    const dateLabel = formatDate(selectedBooking.date);
    if (
      !window.confirm(
        `確認將${settleInfo?.isFullVenue ? '包場' : '此預約'}指派予 ${settleUser.name} 並扣除 ${points} 積分？\n${dateLabel} ${selectedBooking.startTime}–${selectedBooking.endTime} ${courtLabel}`
      )
    ) {
      return;
    }
    try {
      setSettling(true);
      const response = await axios.post(`/bookings/${selectedBooking._id}/settle`, {
        userId: settleUser._id,
        points,
        reason: settleReason.trim() || '預約結算',
      });
      alert(response.data.message || '結算成功');
      const refresh = await axios.get(`/bookings/${selectedBooking._id}`);
      setSelectedBooking(refresh.data.booking);
      setSettleInfo(refresh.data.settleInfo || null);
      setSettleUser(null);
      setSettlePoints('');
      setSettleUserBalance(null);
      setSettling(false);
      refetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.message || '結算失敗');
    } finally {
      setSettling(false);
    }
  };

  const handleEventClick = async (info: any) => {
    const bookingId = info.event.id;
    setShowDetailModal(true);
    setDetailLoading(true);
    setSelectedBooking(null);
    setNewNoteContent('');
    setEditingNoteId(null);
    setEditingNoteContent('');
    resetSettleForm();
    try {
      const response = await axios.get(`/bookings/${bookingId}`);
      const booking = response.data.booking as Booking;
      const settlePreview = response.data.settleInfo as typeof settleInfo;
      setSelectedBooking(booking);
      setSettleInfo(settlePreview || null);
      if (isBookingPendingSettle(booking, settlePreview || undefined)) {
        initSettleForm(booking, settlePreview || undefined);
      }
    } catch (error: any) {
      console.error('獲取預約詳情失敗:', error);
      alert(error.response?.data?.message || '獲取預約詳情失敗');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDateClick = (info: any) => {
    // 當點擊空白日期時，設置選中的日期並打開創建預約模態框
    const clickedDate = info.dateStr;
    setSelectedDate(clickedDate);
    setSelectedCourt('');
    setSelectedTime('');
    setShowCreateModal(true);
  };

  const handleViewChange = (newView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => {
    setView(newView);
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.changeView(newView);
    }
  };

  const handleResendEmail = async () => {
    if (!selectedBooking) return;
    
    if (!window.confirm('確認要重新發送開門通知郵件嗎？')) {
      return;
    }
    
    try {
      setResendingEmail(true);
      const response = await axios.post(`/bookings/${selectedBooking._id}/resend-access-email`);
      alert(`郵件已重新發送到：${response.data.email}`);
    } catch (error: any) {
      console.error('重發郵件失敗:', error);
      alert(error.response?.data?.message || '重發郵件失敗，請稍後再試');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedBooking || !newNoteContent.trim()) return;

    try {
      setAddingNote(true);
      const response = await axios.post(`/bookings/${selectedBooking._id}/admin-notes`, {
        content: newNoteContent.trim()
      });
      setSelectedBooking(response.data.booking);
      setNewNoteContent('');
      refetchBookings();
    } catch (error: any) {
      console.error('添加留言失敗:', error);
      alert(error.response?.data?.message || '添加留言失敗，請稍後再試');
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!selectedBooking || !editingNoteContent.trim()) return;

    try {
      const response = await axios.put(`/bookings/${selectedBooking._id}/admin-notes/${noteId}`, {
        content: editingNoteContent.trim()
      });
      setSelectedBooking(response.data.booking);
      setEditingNoteId(null);
      setEditingNoteContent('');
      refetchBookings();
    } catch (error: any) {
      console.error('編輯留言失敗:', error);
      alert(error.response?.data?.message || '編輯留言失敗，請稍後再試');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedBooking) return;
    
    if (!window.confirm('確定要刪除此留言嗎？')) return;

    try {
      const response = await axios.delete(`/bookings/${selectedBooking._id}/admin-notes/${noteId}`);
      setSelectedBooking(response.data.booking);
      refetchBookings();
      alert('留言已刪除');
    } catch (error: any) {
      console.error('刪除留言失敗:', error);
      alert(error.response?.data?.message || '刪除留言失敗，請稍後再試');
    }
  };

  const handleMarkAsProcessed = async () => {
    if (!selectedBooking) return;

    try {
      const response = await axios.put(`/bookings/${selectedBooking._id}/special-requests-processed`, {
        specialRequestsProcessed: true
      });
      setSelectedBooking(response.data.booking);
      refetchBookings();
      alert('已標記為已處理');
    } catch (error: any) {
      console.error('更新處理狀態失敗:', error);
      alert(error.response?.data?.message || '更新失敗，請稍後再試');
    }
  };

  return (
    <div className="space-y-6">
      {/* 頁面標題和操作按鈕 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">預約日曆</h2>
          <p className="text-gray-600 mt-1">查看和管理預約安排，支持點擊空白區域創建新預約</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          創建預約
        </button>
      </div>

      {/* 錯誤信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 視圖切換和圖例 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* 店鋪篩選 + 視圖切換 */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2">
              <BuildingStorefrontIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
              <select
                value={storeFilterId}
                onChange={(e) => {
                  setStoreFilterId(e.target.value);
                  lastFetchedRangeKeyRef.current = '';
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white min-w-[200px]"
              >
                <option value="">全部店鋪</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewChange('dayGridMonth')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'dayGridMonth'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              月視圖
            </button>
            <button
              onClick={() => handleViewChange('timeGridWeek')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'timeGridWeek'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              週視圖
            </button>
            <button
              onClick={() => handleViewChange('timeGridDay')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                view === 'timeGridDay'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              日視圖
            </button>
          </div>
          </div>
        </div>

        {/* 圖例 */}
        <div className="mt-4">
          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">比賽場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">訓練場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-violet-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">單人場</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-amber-500 rounded mr-2"></div>
              <span className="text-sm text-gray-600">練習場</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-400 rounded mr-2"></div>
              <span className="text-sm text-gray-600">已取消</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-red-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">有特殊要求（未處理）</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-green-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">特殊要求已處理</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 border-2 border-blue-600 rounded mr-2"></div>
              <span className="text-sm text-gray-600">有管理員留言</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded mr-2" style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderImage: 'linear-gradient(135deg, #DC2626 0%, #3B82F6 50%, #10B981 100%) 1'
              }}></div>
              <span className="text-sm text-gray-600">多種狀態（漸變色）</span>
            </div>
            <div className="text-xs text-gray-500">
              * 深色表示已確認，淺色表示待確認
            </div>
          </div>
        </div>
      </div>

      {/* FullCalendar */}
      <div className="bg-white rounded-lg shadow-sm p-6 relative">
        {eventsLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-lg">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''
          }}
          events={events}
          eventClick={handleEventClick}
          dateClick={handleDateClick}
          height="auto"
          locale="zh-tw"
          buttonText={{
            today: '今天',
            month: '月',
            week: '週',
            day: '日'
          }}
          eventDisplay="block"
          dayMaxEvents={3}
          moreLinkClick="popover"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          nowIndicator={true}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }}
          datesSet={handleDatesSet}
          titleFormat={{
            year: 'numeric',
            month: 'long'
          }}
        />
      </div>

      {/* 詳情模態框 */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">預約詳情</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedBooking(null);
                  setNewNoteContent('');
                  setEditingNoteId(null);
                  setEditingNoteContent('');
                  resetSettleForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {detailLoading || !selectedBooking ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
              </div>
            ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">日期</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedBooking.date)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">時間</label>
                  <p className="text-sm text-gray-900">{selectedBooking.startTime} - {selectedBooking.endTime}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">店鋪</label>
                <p className="text-sm text-gray-900 flex items-center gap-1 mt-0.5">
                  <BuildingStorefrontIcon className="w-4 h-4 text-primary-600" />
                  {resolveBookingStoreName(selectedBooking)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">場地</label>
                  <p className="text-sm text-gray-900">{selectedBooking.court.name} ({selectedBooking.court.number}號場)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">狀態</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getStatusText(selectedBooking.status)}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">用戶信息</label>
                <div className="mt-1 text-sm text-gray-900">
                  <p>{selectedBooking.user.name}</p>
                  <p>{selectedBooking.user.email}</p>
                  {selectedBooking.user.phone && <p>{selectedBooking.user.phone}</p>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">參與者</label>
                <div className="mt-1 space-y-2">
                  {(selectedBooking.players || []).map((player, index) => (
                    <div key={index} className="text-sm text-gray-900">
                      {player.name} ({player.email})
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedBooking.specialRequests && selectedBooking.specialRequests.trim() && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">特殊要求</label>
                    {!selectedBooking.specialRequestsProcessed && (
                      <button
                        onClick={handleMarkAsProcessed}
                        className="flex items-center space-x-1 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>標記為已處理</span>
                      </button>
                    )}
                    {selectedBooking.specialRequestsProcessed && (
                      <span className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-lg">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>已處理</span>
                      </span>
                    )}
                  </div>
                  <div className={`text-sm text-gray-900 mt-1 p-3 rounded-lg ${
                    selectedBooking.specialRequestsProcessed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {selectedBooking.specialRequests}
                  </div>
                </div>
              )}

              {/* 管理員留言 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700 flex items-center space-x-2">
                    <ChatBubbleLeftIcon className="w-4 h-4" />
                    <span>管理員留言 ({selectedBooking.adminNotes?.length || 0})</span>
                  </label>
                </div>

                {/* 留言列表 */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {selectedBooking.adminNotes && selectedBooking.adminNotes.length > 0 ? (
                    selectedBooking.adminNotes.map((note) => (
                      <div key={note._id} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        {editingNoteId === note._id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteContent('');
                                }}
                                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => handleEditNote(note._id)}
                                className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                                <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                                  <span>{note.createdBy?.name || '未知管理員'}</span>
                                  <span>•</span>
                                  <span>{new Date(note.createdAt).toLocaleString('zh-TW')}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note._id);
                                    setEditingNoteContent(note.content);
                                  }}
                                  className="p-1 text-gray-500 hover:text-primary-600 transition-colors"
                                  title="編輯留言"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteNote(note._id)}
                                  className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                                  title="刪除留言"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-sm text-gray-400 italic">暫無留言</p>
                    </div>
                  )}
                </div>

                {/* 添加新留言 */}
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-start space-x-2">
                    <textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      rows={3}
                      placeholder="添加新留言..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote || !newNoteContent.trim()}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors flex items-center space-x-1"
                    >
                      {addingNote ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>添加中...</span>
                        </>
                      ) : (
                        <>
                          <PlusIcon className="w-4 h-4" />
                          <span>添加</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
              
              {settleInfo?.alreadySettled && settleInfo.isFullVenue && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-900">包場已結算</p>
                  <p className="text-2xl font-bold text-green-800 mt-1">
                    {settleInfo.suggestedPoints} 積分
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    共 {settleInfo.bundleCount} 個場地 · 用戶已付清（此頁為其中一場詳情）
                  </p>
                  {settleInfo.bundleBreakdown && settleInfo.bundleBreakdown.length > 0 && (
                    <ul className="mt-2 text-xs text-green-800 space-y-0.5">
                      {settleInfo.bundleBreakdown.map((row) => (
                        <li key={row.id}>
                          {row.courtName}：{row.pointsDeducted} 積分
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">總價</label>
                  {(() => {
                    const charge = getDisplayChargePoints(selectedBooking, settleInfo || undefined);
                    return (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {charge.suffix
                            ? `${charge.amount} 積分（${charge.suffix}）`
                            : `${charge.amount} 積分`}
                        </p>
                        {charge.courtShare != null &&
                          charge.bundleCount > 1 &&
                          charge.amount !== charge.courtShare && (
                            <p className="text-xs text-gray-500 mt-1">
                              此場地分攤 {charge.courtShare} 積分 · 共 {charge.bundleCount} 場
                              （T&amp;L 按各場認列，總收以包場總額為準）
                            </p>
                          )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">付款方式</label>
                  <p className="text-sm text-gray-900">
                  {selectedBooking.payment.method === 'admin_waived'
                    ? '管理員留場（未扣積分）'
                    : selectedBooking.payment.method === 'points'
                      ? '積分'
                      : selectedBooking.payment.method}
                </p>
                </div>
              </div>

              {isBookingPendingSettle(selectedBooking, settleInfo || undefined) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-amber-900">
                      {settleInfo?.isFullVenue ? '包場指派用戶並結算' : '指派用戶並結算'}
                    </h4>
                    <p className="text-xs text-amber-800 mt-1">
                      {settleInfo?.isFullVenue
                        ? `此為包場預約（共 ${settleInfo.bundleCount || 3} 個場地），結算一次會整組轉至用戶並扣總價，T&L 按各場地認列。`
                        : '客戶充值後，選擇用戶並扣積分。預約會轉至該用戶名下，收入計入 T&L（按預約日期／場地）。'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      指派用戶 <span className="text-red-500">*</span>
                    </label>
                    <UserAutocomplete
                      value={settleUser?._id || ''}
                      onChange={handleSettleUserChange}
                      placeholder="搜索姓名、電郵或電話…"
                    />
                    {settleUserBalance !== null && (
                      <p className="mt-1 text-xs text-gray-600">
                        用戶餘額：<span className={settleUserBalance < parseInt(settlePoints || '0', 10) ? 'text-red-600 font-medium' : 'text-green-700 font-medium'}>{settleUserBalance}</span> 積分
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">扣款積分</label>
                      <input
                        type="number"
                        min={1}
                        value={settlePoints}
                        onChange={(e) => setSettlePoints(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
                      <input
                        type="text"
                        value={settleReason}
                        onChange={(e) => setSettleReason(e.target.value)}
                        placeholder="預約結算"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSettleBooking}
                    disabled={settling || !settleUser || !settlePoints}
                    className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
                  >
                    {settling ? '結算中…' : settleInfo?.isFullVenue ? '包場指派並扣積分結算' : '指派用戶並扣積分結算'}
                  </button>
                </div>
              )}

              {/* 管理動作 */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    onClick={handleResendEmail}
                    disabled={resendingEmail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded flex items-center gap-2"
                  >
                    {resendingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        發送中...
                      </>
                    ) : (
                      '重發開門通知郵件'
                    )}
                  </button>
                  {selectedBooking.status !== 'cancelled' && (
                    <button
                      onClick={async () => {
                        const isAdminWaived = selectedBooking.payment?.method === 'admin_waived';
                        if (
                          !window.confirm(
                            isAdminWaived
                              ? '確認要取消此預約嗎？'
                              : '確認要取消此預約並退回積分嗎？'
                          )
                        )
                          return;
                        try {
                          await axios.put(`/bookings/${selectedBooking._id}/cancel`, { reason: 'Admin cancel via calendar' });
                          alert(
                            isAdminWaived
                              ? '預約已取消，因管理員權限故不會補回積分。'
                              : '預約已取消，積分已退回'
                          );
                          setShowDetailModal(false);
                          refetchBookings();
                        } catch (e: any) {
                          alert(e?.response?.data?.message || '取消失敗');
                        }
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      取消預約並退款
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* 關閉時卸載，避免與 FullCalendar 連動重繪時子元件重複掛載／effect 洗版 */}
      {showCreateModal && (
        <CreateBookingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onBookingCreated={() => {
            refetchBookings();
            setShowCreateModal(false);
          }}
          selectedDate={selectedDate}
          selectedCourt={selectedCourt}
          selectedTime={selectedTime}
          initialStoreId={storeFilterId || undefined}
        />
      )}
    </div>
  );
};

export default BookingCalendar;
