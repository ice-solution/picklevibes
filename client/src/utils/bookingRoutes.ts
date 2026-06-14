/** 預約 deep link 路徑工具 */

export const BOOKING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 不可作為店鋪 slug 的頂層路徑 */
export const BOOKING_RESERVED_SEGMENTS = new Set([
  'about', 'faq', 'privacy', 'terms', 'pricing', 'booking', 'login', 'register',
  'forgot-password', 'reset-password', 'dashboard', 'my-bookings', 'profile', 'admin',
  'admin-v2', 'payment-result', 'recharge', 'recharge-success', 'balance', 'maintenance',
  'coach-calendar', 'coach-courses', 'coach', 'activities', 'my-activities', 'shop', 'cart',
  'checkout', 'orders', 'game', 'vlog',
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

/** 建立預約 URL（預設 /booking 前綴；deepLink=true 用根路徑分享） */
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
