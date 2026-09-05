import React, { useEffect, useMemo, useState } from 'react';
import { XMarkIcon, AcademicCapIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import BookingCoachAssignPanel, {
  BookingCoachAssignValue,
  buildCoachClassPayloadFromAssign,
  emptyCoachAssignValue,
  sessionHoursFromTimes,
} from './BookingCoachAssignPanel';

function toDateInputValue(d: string): string {
  if (!d) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(x);
}

function resolveStoreId(booking: {
  store?: { _id?: string } | string | null;
  court?: { store?: { _id?: string } | string | null } | null;
}): string {
  const fromBooking = booking.store;
  if (fromBooking && typeof fromBooking === 'object' && fromBooking._id) {
    return String(fromBooking._id);
  }
  if (typeof fromBooking === 'string' && fromBooking) return fromBooking;
  const fromCourt = booking.court?.store;
  if (fromCourt && typeof fromCourt === 'object' && fromCourt._id) {
    return String(fromCourt._id);
  }
  if (typeof fromCourt === 'string' && fromCourt) return fromCourt;
  return '';
}

export interface AssignBookingCoachesBooking {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  store?: { _id?: string; name?: string } | string | null;
  court?: {
    _id: string;
    name?: string;
    store?: { _id?: string; name?: string } | string | null;
  } | null;
}

interface AssignBookingCoachesModalProps {
  isOpen: boolean;
  booking: AssignBookingCoachesBooking | null;
  onClose: () => void;
  onSaved?: () => void;
}

const AssignBookingCoachesModal: React.FC<AssignBookingCoachesModalProps> = ({
  isOpen,
  booking,
  onClose,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid' | null>(null);
  const [assignValue, setAssignValue] = useState<BookingCoachAssignValue>(emptyCoachAssignValue());
  const [preservePaymentsOnce, setPreservePaymentsOnce] = useState(false);

  const hours = useMemo(() => {
    if (!booking) return 0;
    return sessionHoursFromTimes(booking.startTime, booking.endTime);
  }, [booking]);

  useEffect(() => {
    if (!isOpen || !booking) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setEditingId(null);
    setPaymentStatus(null);
    setAssignValue(emptyCoachAssignValue());
    setPreservePaymentsOnce(false);

    api
      .get(`/coach-classes/by-booking/${booking._id}`)
      .then((res) => {
        if (cancelled) return;
        const row = res.data?.coachClass;
        if (!row) return;

        setEditingId(row._id);
        setPaymentStatus(row.paymentStatus === 'paid' ? 'paid' : 'unpaid');
        const coachIds =
          row.coaches?.map((c: { _id: string }) => c._id) ||
          (row.coach?._id ? [row.coach._id] : []);
        const coachPayments = coachIds.map((id: string) => {
          const fromRow = (row.coachPayments || []).find(
            (p: { coach: string | { _id: string }; hourlyRate: number; amount: number }) =>
              String(typeof p.coach === 'object' ? p.coach._id : p.coach) === id
          );
          const coach =
            (row.coaches || []).find((c: { _id: string; name?: string }) => c._id === id) ||
            row.coach;
          const hourlyRate = fromRow?.hourlyRate ?? Number(coach?.coachHourlyRate) ?? 0;
          const amount =
            fromRow?.amount ?? Math.round(hourlyRate * hours * 100) / 100;
          return {
            coachId: id,
            name: coach?.name || id,
            hourlyRate,
            amount,
          };
        });
        setPreservePaymentsOnce(true);
        setAssignValue({
          coachIds,
          coachPayments,
          title: row.title || '教練課堂',
          notes: row.notes || '',
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.message || '載入派課資料失敗');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, booking?._id, hours]);

  if (!isOpen || !booking) return null;

  const storeId = resolveStoreId(booking);
  const courtId = booking.court?._id || '';
  const sessionDate = toDateInputValue(booking.date);
  const readOnly = paymentStatus === 'paid';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!storeId) {
      setError('此預約缺少店鋪資訊，無法派課');
      return;
    }
    if (!courtId) {
      setError('此預約缺少場地，無法派課');
      return;
    }
    if (!assignValue.coachIds.length) {
      setError('請至少選擇一位教練');
      return;
    }
    if (!sessionDate || !booking.startTime || !booking.endTime) {
      setError('預約日期或時間不完整');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = buildCoachClassPayloadFromAssign(assignValue, {
        storeId,
        courtId,
        sessionDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        bookingId: booking._id,
      });

      let res;
      if (editingId) {
        res = await api.put(`/coach-classes/${editingId}`, payload);
      } else {
        res = await api.post('/coach-classes', payload);
      }

      const notify = res.data?.notify;
      const baseMsg = res.data?.message || (editingId ? '派課已更新' : '派課成功');
      const notifyHint =
        notify?.success === false
          ? `\n（WhatsApp 通知未成功${notify?.error ? `：${notify.error}` : ''}）`
          : notify?.sent
            ? `\n已發送 WhatsApp 通知（${notify.sent} 則）`
            : '';
      alert(`${baseMsg}${notifyHint}`);
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || (editingId ? '更新派課失敗' : '派課失敗'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="w-6 h-6 text-violet-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? '編輯派課' : '派課'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {sessionDate} {booking.startTime}–{booking.endTime}
                {booking.court?.name ? ` · ${booking.court.name}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {readOnly && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-sm">
              此課堂已標記付款，不可再編輯教練／薪資。
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-600">
                將建立／更新教練課堂並連結此預約（不另 hold 場）。預設時薪來自教練資料，儲存後會發送
                WhatsApp 通知。
              </p>
              <BookingCoachAssignPanel
                hours={hours}
                value={assignValue}
                onChange={setAssignValue}
                preservePaymentsOnce={preservePaymentsOnce}
                disabled={readOnly || saving}
                compact
              />
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || loading || readOnly || !assignValue.coachIds.length}
              className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '儲存中…' : editingId ? '更新派課' : '確認派課'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignBookingCoachesModal;
