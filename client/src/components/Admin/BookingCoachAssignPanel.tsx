import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';

export interface CoachOption {
  _id: string;
  name: string;
  phone?: string;
  coachHourlyRate?: number;
  hasPhone?: boolean;
}

export interface CoachPaymentForm {
  coachId: string;
  name: string;
  hourlyRate: number;
  amount: number;
}

export interface BookingCoachAssignValue {
  coachIds: string[];
  coachPayments: CoachPaymentForm[];
  title: string;
  notes: string;
}

interface BookingCoachAssignPanelProps {
  /** 課堂時數（由預約 start/end 算出） */
  hours: number;
  value: BookingCoachAssignValue;
  onChange: (next: BookingCoachAssignValue) => void;
  /** 編輯既有課堂時略過首次自動重算堂費 */
  preservePaymentsOnce?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function sessionHoursFromTimes(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    if (t === '24:00') return 24 * 60;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  if (!startTime || !endTime) return 0;
  let mins = toMin(endTime) - toMin(startTime);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

export function emptyCoachAssignValue(): BookingCoachAssignValue {
  return {
    coachIds: [],
    coachPayments: [],
    title: '教練課堂',
    notes: '',
  };
}

export function buildCoachClassPayloadFromAssign(
  value: BookingCoachAssignValue,
  opts: {
    storeId: string;
    courtId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    bookingId: string;
  }
) {
  return {
    store: opts.storeId,
    coachIds: value.coachIds,
    locationType: 'court' as const,
    courtIds: [opts.courtId],
    sessionDate: opts.sessionDate,
    startTime: opts.startTime,
    endTime: opts.endTime,
    title: value.title.trim() || '教練課堂',
    notes: value.notes.trim() || undefined,
    bookings: [opts.bookingId],
    coachPayments: value.coachPayments.map((p) => ({
      coach: p.coachId,
      hourlyRate: p.hourlyRate,
      amount: p.amount,
    })),
  };
}

const BookingCoachAssignPanel: React.FC<BookingCoachAssignPanelProps> = ({
  hours,
  value,
  onChange,
  preservePaymentsOnce = false,
  disabled = false,
  compact = false,
}) => {
  const [coachOptions, setCoachOptions] = useState<CoachOption[]>([]);
  const [loadingCoaches, setLoadingCoaches] = useState(true);
  const skipPaymentRebuildRef = useRef(preservePaymentsOnce);

  useEffect(() => {
    skipPaymentRebuildRef.current = preservePaymentsOnce;
  }, [preservePaymentsOnce]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCoaches(true);
    api
      .get('/coach-classes/coaches')
      .then((r) => {
        if (!cancelled) setCoachOptions(r.data?.coaches || []);
      })
      .catch(() => {
        if (!cancelled) setCoachOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCoaches(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipPaymentRebuildRef.current) {
      skipPaymentRebuildRef.current = false;
      return;
    }
    const prevMap = new Map(value.coachPayments.map((p) => [p.coachId, p]));
    const nextPayments = value.coachIds.map((id) => {
      const coach = coachOptions.find((c) => c._id === id);
      const old = prevMap.get(id);
      const hourlyRate = old?.hourlyRate ?? Number(coach?.coachHourlyRate) ?? 0;
      return {
        coachId: id,
        name: coach?.name || old?.name || id,
        hourlyRate,
        amount: Math.round(hourlyRate * hours * 100) / 100,
      };
    });
    const same =
      nextPayments.length === value.coachPayments.length &&
      nextPayments.every((p, i) => {
        const o = value.coachPayments[i];
        return (
          o &&
          o.coachId === p.coachId &&
          o.hourlyRate === p.hourlyRate &&
          o.amount === p.amount &&
          o.name === p.name
        );
      });
    if (!same) {
      onChange({ ...value, coachPayments: nextPayments });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync payments from coachIds/hours
  }, [value.coachIds.join(','), hours, coachOptions.length]);

  const totalPay = useMemo(
    () => value.coachPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [value.coachPayments]
  );

  const toggleCoach = (id: string) => {
    if (disabled) return;
    const coachIds = value.coachIds.includes(id)
      ? value.coachIds.filter((x) => x !== id)
      : [...value.coachIds, id];
    onChange({ ...value, coachIds });
  };

  const missingPhone = coachOptions.filter(
    (c) => value.coachIds.includes(c._id) && !(c.hasPhone ?? Boolean(String(c.phone || '').trim()))
  );

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {loadingCoaches ? (
        <p className="text-sm text-gray-500">載入教練列表中…</p>
      ) : coachOptions.length === 0 ? (
        <p className="text-sm text-amber-700">尚無教練帳戶，請先至「教練管理」新增。</p>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            教練（可多選）
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white">
            {coachOptions.map((c) => {
              const hasPhone = c.hasPhone ?? Boolean(String(c.phone || '').trim());
              return (
                <label
                  key={c._id}
                  className={`flex items-center gap-2 text-sm rounded px-2 py-1.5 ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={value.coachIds.includes(c._id)}
                    onChange={() => toggleCoach(c._id)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="min-w-0">
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-gray-500 ml-1">
                      ${Number(c.coachHourlyRate) || 0}/時
                    </span>
                    {!hasPhone && (
                      <span className="block text-[11px] text-red-600">未設電話（無法通知）</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {missingPhone.length > 0 && (
            <p className="mt-1 text-xs text-red-600">
              已選教練缺少電話：{missingPhone.map((c) => c.name).join('、')}。請先補上才能派課。
            </p>
          )}
        </div>
      )}

      {hours > 0 && value.coachIds.length > 0 && (
        <p className="text-xs text-gray-600">課堂時數：{hours} 小時</p>
      )}

      {value.coachPayments.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-800">本堂薪資（可調整）</p>
          {value.coachPayments.map((p, idx) => (
            <div key={p.coachId} className="grid grid-cols-3 gap-2 items-center text-sm">
              <span className="truncate">{p.name}</span>
              <input
                type="number"
                min={0}
                disabled={disabled}
                value={p.hourlyRate}
                onChange={(e) => {
                  const hourlyRate = Number(e.target.value) || 0;
                  const coachPayments = value.coachPayments.map((x, i) =>
                    i === idx
                      ? {
                          ...x,
                          hourlyRate,
                          amount: Math.round(hourlyRate * hours * 100) / 100,
                        }
                      : x
                  );
                  onChange({ ...value, coachPayments });
                }}
                className="border border-gray-300 rounded px-2 py-1 bg-white"
                placeholder="時薪"
              />
              <input
                type="number"
                min={0}
                disabled={disabled}
                value={p.amount}
                onChange={(e) => {
                  const amount = Number(e.target.value) || 0;
                  const coachPayments = value.coachPayments.map((x, i) =>
                    i === idx ? { ...x, amount } : x
                  );
                  onChange({ ...value, coachPayments });
                }}
                className="border border-gray-300 rounded px-2 py-1 bg-white"
                placeholder="本堂價"
              />
            </div>
          ))}
          <p className="text-xs text-gray-500">
            中欄＝時薪，右欄＝本堂應付（預設時薪×時數）。總計 ${totalPay}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">課堂標題</label>
          <input
            type="text"
            disabled={disabled}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="教練課堂"
            maxLength={120}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
          <input
            type="text"
            disabled={disabled}
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="選填"
            maxLength={2000}
          />
        </div>
      </div>
    </div>
  );
};

export default BookingCoachAssignPanel;
