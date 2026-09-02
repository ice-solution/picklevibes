export const BOOKING_EXTERNAL_PAYMENT_METHODS = [
  { value: 'cash', label: '現金' },
  { value: 'kpay', label: 'KPay' },
  { value: 'fps', label: 'FPS 轉數快' },
  { value: 'bank_transfer', label: '銀行轉帳' },
  { value: 'other', label: '其他' },
] as const;

export type BookingExternalPaymentMethod = (typeof BOOKING_EXTERNAL_PAYMENT_METHODS)[number]['value'];

export function bookingPaymentMethodLabel(method?: string | null): string {
  const found = BOOKING_EXTERNAL_PAYMENT_METHODS.find((m) => m.value === method);
  if (found) return found.label;
  if (method === 'points') return '積分';
  if (method === 'admin_waived') return '管理員留場';
  return method || '—';
}
