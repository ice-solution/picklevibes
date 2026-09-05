import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { TicketIcon, XMarkIcon } from '@heroicons/react/24/outline';

export type PendingRedeemRow = {
  redeemCodeId: string;
  code: string;
  name: string;
  type?: 'fixed' | 'percentage' | string;
  value?: number;
  discountAmount: number;
  valid?: boolean;
  error?: string | null;
};

export type PendingRedeemPreview = {
  baseAmount: number;
  suggestedPoints?: number;
  applied: PendingRedeemRow[];
  totalDiscount: number;
  netPayable: number;
};

type Props = {
  bookingId: string;
  baseAmount: number;
  forUserId?: string | null;
  courtId?: string;
  date?: string;
  startTime?: string;
  onPreviewChange?: (preview: PendingRedeemPreview | null) => void;
  disabled?: boolean;
};

const SettlePendingRedeems: React.FC<Props> = ({
  bookingId,
  baseAmount,
  forUserId,
  onPreviewChange,
  disabled = false,
}) => {
  const [preview, setPreview] = useState<PendingRedeemPreview | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pocketLoading, setPocketLoading] = useState(false);
  const [error, setError] = useState('');
  const [pocketItems, setPocketItems] = useState<
    Array<{
      _id: string;
      redeemCode: {
        _id: string;
        code: string;
        name: string;
        type: string;
        value: number;
        applicableTypes?: string[];
      } | null;
    }>
  >([]);

  const applyPreview = useCallback(
    (data: PendingRedeemPreview) => {
      setPreview(data);
      onPreviewChange?.(data);
    },
    [onPreviewChange]
  );

  const loadPreview = useCallback(async () => {
    if (!bookingId) return;
    try {
      const params = new URLSearchParams();
      if (baseAmount != null && Number.isFinite(baseAmount)) {
        params.set('baseAmount', String(baseAmount));
      }
      if (forUserId) params.set('forUserId', forUserId);
      const res = await axios.get(`/bookings/${bookingId}/pending-redeems?${params.toString()}`);
      applyPreview({
        baseAmount: res.data.baseAmount,
        suggestedPoints: res.data.suggestedPoints,
        applied: res.data.applied || [],
        totalDiscount: res.data.totalDiscount || 0,
        netPayable: res.data.netPayable ?? res.data.baseAmount,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '載入兌換碼失敗');
    }
  }, [bookingId, baseAmount, forUserId, applyPreview]);

  const loadPocket = useCallback(async () => {
    if (!forUserId) {
      setPocketItems([]);
      return;
    }
    setPocketLoading(true);
    try {
      const res = await axios.get(`/redeem/admin/user-pocket/${forUserId}?status=available`);
      const items = (res.data.items || []).filter(
        (item: { redeemCode: { applicableTypes?: string[] } | null }) => {
          if (!item.redeemCode) return false;
          const types = item.redeemCode.applicableTypes || [];
          return types.includes('all') || types.includes('booking');
        }
      );
      setPocketItems(items);
    } catch {
      setPocketItems([]);
    } finally {
      setPocketLoading(false);
    }
  }, [forUserId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    void loadPocket();
  }, [loadPocket]);

  const handleAdd = async (payload: Record<string, unknown>) => {
    if (disabled || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`/bookings/${bookingId}/pending-redeems`, {
        baseAmount,
        forUserId: forUserId || undefined,
        ...payload,
      });
      applyPreview({
        baseAmount: res.data.baseAmount,
        suggestedPoints: res.data.suggestedPoints,
        applied: res.data.applied || [],
        totalDiscount: res.data.totalDiscount || 0,
        netPayable: res.data.netPayable ?? res.data.baseAmount,
      });
      setCode('');
      await loadPocket();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '掛載兌換碼失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (redeemCodeId: string) => {
    if (disabled || loading) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ baseAmount: String(baseAmount) });
      if (forUserId) params.set('forUserId', forUserId);
      const res = await axios.delete(
        `/bookings/${bookingId}/pending-redeems/${redeemCodeId}?${params.toString()}`
      );
      applyPreview({
        baseAmount: res.data.baseAmount,
        suggestedPoints: res.data.suggestedPoints,
        applied: res.data.applied || [],
        totalDiscount: res.data.totalDiscount || 0,
        netPayable: res.data.netPayable ?? res.data.baseAmount,
      });
      await loadPocket();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '移除兌換碼失敗');
    } finally {
      setLoading(false);
    }
  };

  const applied = preview?.applied || [];
  const totalDiscount = preview?.totalDiscount || 0;
  const netPayable = preview?.netPayable ?? baseAmount;

  return (
    <div className="border border-amber-200 rounded-lg p-3 bg-white/70 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
        <TicketIcon className="h-4 w-4" />
        結算兌換碼（可多張）
      </div>
      <p className="text-xs text-gray-600">
        折扣以結算基數計算（非場地牌價）。百分比與固定金額皆對同一基數折扣後加總。
      </p>

      {applied.length > 0 && (
        <ul className="space-y-2">
          {applied.map((row) => (
            <li
              key={row.redeemCodeId}
              className={`flex items-start justify-between gap-2 text-sm rounded-md px-2 py-1.5 ${
                row.valid === false ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-gray-800'
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {row.name || row.code}
                  <span className="ml-2 text-xs text-gray-500 font-normal">{row.code}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {row.type === 'percentage' ? `${row.value}%` : `$${row.value}`}
                  {row.valid === false ? (
                    <span className="text-red-600"> · {row.error || '無效'}</span>
                  ) : (
                    <span> · 折扣 ${row.discountAmount}</span>
                  )}
                </div>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => void handleRemove(row.redeemCodeId)}
                  className="p-1 text-gray-500 hover:text-red-600 shrink-0"
                  title="移除"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd({ code: code.trim() });
            }
          }}
          disabled={disabled || loading}
          placeholder="輸入兌換碼"
          className="flex-1 border rounded-md px-3 py-1.5 text-sm uppercase"
        />
        <button
          type="button"
          disabled={disabled || loading || !code.trim()}
          onClick={() => void handleAdd({ code: code.trim() })}
          className="px-3 py-1.5 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? '…' : '加入'}
        </button>
      </div>

      {forUserId ? (
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1">客戶口袋（booking 適用）</p>
          {pocketLoading ? (
            <p className="text-xs text-gray-400">載入中…</p>
          ) : pocketItems.length === 0 ? (
            <p className="text-xs text-gray-400">口袋暫無可用兌換券</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pocketItems.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => void handleAdd({ pocketItemId: item._id })}
                  className="text-xs px-2 py-1 rounded border border-amber-200 bg-white hover:bg-amber-50 disabled:opacity-50"
                >
                  {item.redeemCode?.name || item.redeemCode?.code}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">選擇指派用戶後可從客戶口袋選券。</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="text-xs text-gray-700 space-y-0.5 border-t border-amber-100 pt-2">
        <div className="flex justify-between">
          <span>結算基數</span>
          <span>${baseAmount}</span>
        </div>
        <div className="flex justify-between">
          <span>兌換折扣合計</span>
          <span className="text-green-700">−${totalDiscount}</span>
        </div>
        <div className="flex justify-between font-semibold text-amber-900">
          <span>應付</span>
          <span>${netPayable}</span>
        </div>
      </div>
    </div>
  );
};

export default SettlePendingRedeems;
