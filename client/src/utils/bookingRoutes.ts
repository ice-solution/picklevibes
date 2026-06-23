/** 預約 deep link 路徑與區塊 hash 工具 */

export const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type BookingSection =
  | 'store'
  | 'court'
  | 'date'
  | 'time'
  | 'details'
  | 'confirm';

export const BOOKING_SECTIONS: BookingSection[] = [
  'store',
  'court',
  'date',
  'time',
  'details',
  'confirm',
];

/** 不可作為店鋪 slug 的頂層路徑 */
export const BOOKING_RESERVED_SEGMENTS = new Set([
  'about', 'faq', 'privacy', 'terms', 'pricing', 'booking', 'login', 'register',
  'forgot-password', 'reset-password', 'dashboard', 'my-bookings', 'profile', 'admin',
  'admin-v2', 'payment-result', 'recharge', 'recharge-success', 'balance', 'maintenance',
  'coach-calendar', 'coach-courses', 'coach', 'activities', 'my-activities', 'shop', 'cart',
  'checkout', 'orders', 'game', 'vlog', 'pickcourt', 'picklecourt', 'picklevibes', 'search', 'store',
]);

export interface BookingPathParams {
  storeSlug?: string;
  courtSlug?: string;
  date?: string;
}

export function isValidBookingDate(date?: string): boolean {
  if (!date || !BOOKING_DATE_PATTERN.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

export function parseBookingSection(hash: string): BookingSection {
  const h = hash.replace(/^#/, '').toLowerCase();
  if (BOOKING_SECTIONS.includes(h as BookingSection)) {
    return h as BookingSection;
  }
  return 'store';
}

/** 依目前選擇推斷應停留的區塊 */
export function inferBookingSection(params: {
  storeSlug?: string;
  courtSlug?: string;
  date?: string;
  hasTime?: boolean;
  hash?: string;
}): BookingSection {
  const fromHash = params.hash ? parseBookingSection(params.hash) : null;
  if (fromHash && fromHash !== 'store') return fromHash;
  if (params.hasTime) return 'details';
  if (params.date) return 'time';
  if (params.courtSlug) return 'date';
  if (params.storeSlug) return 'court';
  return 'store';
}

/** 建立預約 URL（路徑 + hash） */
export function buildBookingUrl(
  params: BookingPathParams,
  section: BookingSection = 'store',
  options?: { deepLink?: boolean }
): string {
  const path = buildBookingPath(params, options);
  return `${path}#${section}`;
}

/** 建立預約路徑（不含 hash） */
export function buildBookingPath(
  params: BookingPathParams,
  options?: { deepLink?: boolean }
): string {
  const { storeSlug, courtSlug, date } = params;
  const base = options?.deepLink ? '' : '/booking';
  if (!storeSlug) return base || '/booking';
  let path = `${base}/${storeSlug}`;
  if (courtSlug) path += `/${courtSlug}`;
  if (date && isValidBookingDate(date)) path += `/${date}`;
  return path || '/booking';
}

/** 聯盟搜尋帶入預約：?startTime=10:00&duration=60 */
export function parseBookingSearchPrefill(search: string): {
  startTime?: string;
  duration: number;
} {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const startTime = sp.get('startTime')?.trim() || undefined;
  const durationRaw = parseInt(sp.get('duration') || '60', 10);
  const duration = [60, 120].includes(durationRaw) ? durationRaw : 60;
  return { startTime, duration };
}

export function addMinutesToTimeHHmm(startTime: string, minutes: number): string | null {
  const parts = startTime.split(':').map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const total = parts[0] * 60 + parts[1] + minutes;
  if (total < 0) return null;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  if (endH > 24 || (endH === 24 && endM > 0)) return null;
  if (endH === 24 && endM === 0) return '24:00';
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function buildBookingPathWithPrefill(
  params: BookingPathParams,
  prefill?: { startTime?: string; duration?: number },
  options?: { deepLink?: boolean }
): string {
  const path = buildBookingPath(params, options);
  if (!prefill?.startTime) return path;
  const sp = new URLSearchParams();
  sp.set('startTime', prefill.startTime);
  if (prefill.duration) sp.set('duration', String(prefill.duration));
  return `${path}?${sp.toString()}`;
}

export function parseBookingParams(
  storeSlug?: string,
  courtSlug?: string,
  date?: string
): BookingPathParams | null {
  if (!storeSlug) return {};
  if (BOOKING_RESERVED_SEGMENTS.has(storeSlug.toLowerCase())) return null;
  const result: BookingPathParams = { storeSlug: storeSlug.toLowerCase() };
  if (courtSlug) result.courtSlug = courtSlug.toLowerCase();
  if (date) {
    if (!isValidBookingDate(date)) return null;
    result.date = date;
  }
  return result;
}

const SCROLL_OFFSET = 96;
const SCROLL_MAX_WAIT_MS = 10000;

export interface BookingScrollReadiness {
  hydrating?: boolean;
  loading?: boolean;
  storesLoaded?: boolean;
  selectedStore?: boolean;
  selectedCourt?: boolean;
  selectedDate?: boolean;
  selectedTimeSlot?: boolean;
}

/** 區塊 DOM 是否已渲染且可捲動 */
export function isBookingSectionReady(
  section: BookingSection,
  readiness: BookingScrollReadiness
): boolean {
  if (readiness.hydrating) return false;
  if (section === 'store') {
    return !readiness.hydrating && !readiness.loading;
  }
  if (section === 'court') {
    return Boolean(readiness.selectedStore) && !readiness.loading;
  }
  if (section === 'date') {
    return Boolean(readiness.selectedCourt);
  }
  if (section === 'time') {
    return Boolean(readiness.selectedDate);
  }
  if (section === 'details') {
    return Boolean(readiness.selectedTimeSlot);
  }
  if (section === 'confirm') {
    return Boolean(readiness.selectedTimeSlot);
  }
  return false;
}

/**
 * 等待 section 出現在 DOM 且前置資料就緒後再捲動
 */
export function scrollToBookingSectionWhenReady(
  section: BookingSection,
  readiness: BookingScrollReadiness,
  behavior: ScrollBehavior = 'smooth'
): () => void {
  let cancelled = false;
  const start = Date.now();

  const attempt = () => {
    if (cancelled) return;

    if (!isBookingSectionReady(section, readiness)) {
      if (Date.now() - start < SCROLL_MAX_WAIT_MS) {
        requestAnimationFrame(attempt);
      }
      return;
    }

    const el = document.getElementById(`booking-section-${section}`);
    if (!el || el.offsetHeight === 0) {
      if (Date.now() - start < SCROLL_MAX_WAIT_MS) {
        requestAnimationFrame(attempt);
      }
      return;
    }

    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior });
  };

  requestAnimationFrame(attempt);

  return () => {
    cancelled = true;
  };
}

export function scrollToBookingSection(
  section: BookingSection,
  behavior: ScrollBehavior = 'smooth'
): void {
  scrollToBookingSectionWhenReady(section, { storesLoaded: true }, behavior);
}

export function sectionToProgressStep(section: BookingSection): number {
  if (section === 'details') return 2;
  if (section === 'confirm') return 3;
  return 1;
}
