import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { TicketIcon } from '@heroicons/react/24/outline';

export type MonthlyPassItem = {
  planType: string;
  name: string;
  description?: string;
  expiresAt: string;
  isActive: boolean;
  offPeakStart?: string | null;
  offPeakEnd?: string | null;
};

function formatExpiry(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-HK', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return iso;
  }
}

type Props = {
  /** compact = Dashboard 卡片；full = Profile 區塊 */
  variant?: 'compact' | 'full';
  className?: string;
};

const MyMonthlyPasses: React.FC<Props> = ({ variant = 'full', className = '' }) => {
  const [items, setItems] = useState<MonthlyPassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/monthly-pass-plans/me');
      setItems(res.data.entitlements || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = items.filter((i) => i.isActive);
  const expired = items.filter((i) => !i.isActive);

  if (loading) {
    if (variant === 'compact') {
      return (
        <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>
          <p className="text-sm text-gray-500">載入月卡…</p>
        </div>
      );
    }
    return (
      <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
        <p className="text-sm text-gray-500">載入月卡…</p>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white rounded-xl p-6 shadow-lg ${className}`}>
        <div className="flex items-center mb-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <TicketIcon className="w-6 h-6 text-teal-700" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">我的月卡</p>
            <p className="text-2xl font-bold text-gray-900">{active.length}</p>
          </div>
        </div>
        {active.length === 0 ? (
          <p className="text-xs text-gray-500">暫無有效月卡</p>
        ) : (
          <ul className="space-y-2">
            {active.map((p) => (
              <li key={p.planType} className="text-sm">
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-teal-700">有效至 {formatExpiry(p.expiresAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-teal-100 bg-teal-50/40 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <TicketIcon className="w-5 h-5 text-teal-700" />
        <h3 className="text-sm font-semibold text-gray-900">我的月卡</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">你尚未購買月卡。</p>
      ) : (
        <ul className="space-y-3">
          {active.map((p) => (
            <li
              key={p.planType}
              className="rounded-lg bg-white border border-teal-100 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">{p.name}</p>
                  {p.description ? (
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  ) : null}
                  {p.planType === 'off_peak' && p.offPeakStart && p.offPeakEnd ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      非繁忙窗：{p.offPeakStart} – {p.offPeakEnd}（24小時制）
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                  有效
                </span>
              </div>
              <p className="text-sm text-teal-800 mt-1.5">
                有效至 <span className="font-semibold">{formatExpiry(p.expiresAt)}</span>
              </p>
            </li>
          ))}
          {expired.map((p) => (
            <li
              key={`exp-${p.planType}`}
              className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5 opacity-70"
            >
              <p className="font-medium text-gray-700">{p.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                已於 {formatExpiry(p.expiresAt)} 到期
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyMonthlyPasses;
