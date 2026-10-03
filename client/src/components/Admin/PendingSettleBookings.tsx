import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CalendarDaysIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import UserAutocomplete from '../Common/UserAutocomplete';
import SettlePendingRedeems, { type PendingRedeemPreview } from './SettlePendingRedeems';
import { useLockedStoreId } from '../../contexts/StoreAdminContext';
import {
  BOOKING_EXTERNAL_PAYMENT_METHODS,
  type BookingExternalPaymentMethod,
} from '../../constants/bookingPaymentMethods';

type SettleMode = 'points' | 'external';

type StoreRef = { _id: string; name: string; slug?: string };

type PendingBooking = {
  _id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  store?: StoreRef | string;
  court?: { _id: string; name: string; number?: string; store?: StoreRef | string };
  user?: { _id: string; name: string; email: string; phone?: string };
  specialRequests?: string;
  payment?: { method?: string; status?: string; pointsDeducted?: number };
  noUserBalanceDebited?: boolean;
  bypassRestrictions?: boolean;
  venueBundleKind?: string | null;
  isFullVenue?: boolean;
  suggestedPoints?: number;
  bundleCount?: number;
  courtNames?: string[];
};

function hkYmd(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function addDaysYmd(ymd: string, days: number): string {
  const noon = new Date(`${ymd}T12:00:00+08:00`);
  noon.setTime(noon.getTime() + days * 86400000);
  return hkYmd(noon);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function storeName(b: PendingBooking): string {
  if (b.store && typeof b.store === 'object' && b.store.name) return b.store.name;
  const fromCourt = b.court?.store;
  if (fromCourt && typeof fromCourt === 'object' && fromCourt.name) return fromCourt.name;
  return '—';
}

const PendingSettleBookings: React.FC = () => {
  const lockedStoreId = useLockedStoreId();
  const today = useMemo(() => hkYmd(), []);
  const [dateFrom, setDateFrom] = useState(() => addDaysYmd(hkYmd(), -14));
  const [dateTo, setDateTo] = useState(() => addDaysYmd(hkYmd(), 30));
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [storeFilterId, setStoreFilterId] = useState('');
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PendingBooking | null>(null);
  const [settleUser, setSettleUser] = useState<{ _id: string; name: string; email: string; phone?: string } | null>(null);
  const [settlePoints, setSettlePoints] = useState('');
  const [settleReason, setSettleReason] = useState('預約結算');
  const [settleUserBalance, setSettleUserBalance] = useState<number | null>(null);
  const [settling, setSettling] = useState(false);
  const [settleMode, setSettleMode] = useState<SettleMode>('points');
  const [externalMethod, setExternalMethod] = useState<BookingExternalPaymentMethod>('cash');
  const [externalAmount, setExternalAmount] = useState('');
  const [externalNote, setExternalNote] = useState('');
  const [redeemPreview, setRedeemPreview] = useState<PendingRedeemPreview | null>(null);

  /** 預約詳情（按場地名開啟，類似日曆詳情） */
  const [detailBooking, setDetailBooking] = useState<Record<string, unknown> | null>(null);
  const [detailSettleInfo, setDetailSettleInfo] = useState<{
    isFullVenue?: boolean;
    bundleCount?: number;
    suggestedPoints?: number;
    eligible?: boolean;
    bundleBreakdown?: Array<{ id: string; courtName: string; pointsDeducted: number }>;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSource, setDetailSource] = useState<PendingBooking | null>(null);

  const [voidRemark, setVoidRemark] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [showVoidForm, setShowVoidForm] = useState(false);

  const settleBase = parseInt(settlePoints || '0', 10) || 0;
  const netPayable =
    redeemPreview && redeemPreview.baseAmount === settleBase
      ? redeemPreview.netPayable
      : Math.max(0, settleBase - (redeemPreview?.totalDiscount || 0));

  useEffect(() => {
    if (lockedStoreId) {
      setStoreFilterId(lockedStoreId);
      return;
    }
    axios
      .get('/stores/admin/all')
      .then((r) => setStores(r.data.stores || []))
      .catch(() => setStores([]));
  }, [lockedStoreId]);

  const fetchList = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ dateFrom, dateTo });
      const storeId = lockedStoreId || storeFilterId;
      if (storeId) params.append('store', storeId);
      const res = await axios.get(`/bookings/admin/pending-settle?${params.toString()}`);
      setBookings(res.data.bookings || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || '載入待結算預約失敗');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, storeFilterId, lockedStoreId]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openSettle = (b: PendingBooking) => {
    setSelected(b);
    setSettleUser(null);
    setSettleUserBalance(null);
    setSettlePoints(String(b.suggestedPoints || 0));
    setSettleReason('預約結算');
    setSettleMode('points');
    setExternalMethod('cash');
    setExternalAmount(String(b.suggestedPoints || 0));
    setExternalNote('');
    setRedeemPreview(null);
    setShowVoidForm(false);
    setVoidRemark('');
  };

  const openDetail = async (b: PendingBooking) => {
    setDetailSource(b);
    setDetailBooking(null);
    setDetailSettleInfo(null);
    setDetailLoading(true);
    setShowVoidForm(false);
    setVoidRemark('');
    try {
      const res = await axios.get(`/bookings/${b._id}`);
      setDetailBooking(res.data.booking || null);
      setDetailSettleInfo(res.data.settleInfo || null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '載入預約詳情失敗');
      setDetailSource(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailSource(null);
    setDetailBooking(null);
    setDetailSettleInfo(null);
    setShowVoidForm(false);
    setVoidRemark('');
  };

  const handleVoid = async (bookingId: string) => {
    const remark = voidRemark.trim();
    if (!remark) {
      alert('請填寫 Void 原因，例如「活動 XXX 已在他處扣數」');
      return;
    }
    if (
      !window.confirm(
        `確認 Void 此待結算？\n不會取消預約、不會扣積分，但會離開待結算列表。\n備註：${remark}`
      )
    ) {
      return;
    }
    try {
      setVoiding(true);
      const res = await axios.post(`/bookings/${bookingId}/void-pending-settle`, { remark });
      alert(res.data.message || '已 Void');
      setSelected(null);
      closeDetail();
      await fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Void 失敗');
    } finally {
      setVoiding(false);
    }
  };

  const handleSettleUserChange = async (
    user: { _id: string; name: string; email: string; phone?: string } | null
  ) => {
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

  const handleSettle = async () => {
    if (!selected || !settleUser || !settlePoints) return;
    const base = parseInt(settlePoints, 10);
    if (Number.isNaN(base) || base < 0) {
      alert('結算基數無效');
      return;
    }
    const charge = redeemPreview?.netPayable ?? base;
    if (charge < 0) {
      alert('應付金額無效');
      return;
    }
    if (charge === 0 && !((redeemPreview?.totalDiscount ?? 0) > 0)) {
      alert('扣款積分必須大於 0（或先掛載兌換碼全額抵扣）');
      return;
    }
    if (settleUserBalance !== null && charge > 0 && settleUserBalance < charge) {
      alert(`用戶餘額不足！當前：${settleUserBalance}，需要：${charge}`);
      return;
    }
    const isBundle = (selected.bundleCount || 1) > 1;
    const courtLabel = isBundle
      ? `包場（${selected.bundleCount} 個場地）`
      : selected.court?.name || '場地';
    const discountLine =
      redeemPreview && redeemPreview.totalDiscount > 0
        ? `\n基數：${base}，兌換折扣：${redeemPreview.totalDiscount}，應付：${charge}`
        : '';
    if (
      !window.confirm(
        `確認將${isBundle ? '包場' : '此預約'}指派予 ${settleUser.name} 並扣除 ${charge} 積分？${discountLine}\n${formatDate(selected.date)} ${selected.startTime}–${selected.endTime} ${courtLabel}`
      )
    ) {
      return;
    }
    try {
      setSettling(true);
      const response = await axios.post(`/bookings/${selected._id}/settle`, {
        userId: settleUser._id,
        points: base,
        reason: settleReason.trim() || '預約結算',
      });
      alert(response.data.message || '結算成功');
      setSelected(null);
      await fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '結算失敗');
    } finally {
      setSettling(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selected) return;
    if (externalMethod === 'other' && !externalNote.trim()) {
      alert('選擇「其他」時請填寫付款備註');
      return;
    }
    const base = externalAmount.trim() ? parseFloat(externalAmount) : selected.suggestedPoints ?? 0;
    if (Number.isNaN(base) || base < 0) {
      alert('請輸入有效金額');
      return;
    }
    const charge = redeemPreview?.netPayable ?? base;
    const methodLabel =
      BOOKING_EXTERNAL_PAYMENT_METHODS.find((m) => m.value === externalMethod)?.label || externalMethod;
    const isBundle = (selected.bundleCount || 1) > 1;
    const courtLabel = isBundle
      ? `包場（${selected.bundleCount} 個場地）`
      : selected.court?.name || '場地';
    const userLine = settleUser ? `\n指派用戶：${settleUser.name}` : '';
    const discountLine =
      redeemPreview && redeemPreview.totalDiscount > 0
        ? `\n基數：$${base}，兌換折扣：$${redeemPreview.totalDiscount}，實收：$${charge}`
        : '';
    if (
      !window.confirm(
        `確認標記${isBundle ? '包場' : '此預約'}為已付款？\n付款方式：${methodLabel}${discountLine || `\n金額：$${charge}`}${userLine}\n${formatDate(selected.date)} ${selected.startTime}–${selected.endTime} ${courtLabel}`
      )
    ) {
      return;
    }
    try {
      setSettling(true);
      const payload: Record<string, unknown> = {
        method: externalMethod,
        note: externalNote.trim() || undefined,
        amount: base,
      };
      if (settleUser) payload.userId = settleUser._id;
      const response = await axios.post(`/bookings/${selected._id}/mark-paid`, payload);
      alert(response.data.message || '已標記付款');
      setSelected(null);
      await fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '標記付款失敗');
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <CalendarDaysIcon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">待結算 Hold 場</h3>
            <p className="text-sm text-gray-600 mt-1">
              列出日期範圍內已預先佔場、尚未扣積分結算的預約（不含活動佔場）。結算或 Void 後會從列表移除。按場地名可查看詳情。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">由</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">至</label>
            <input
              type="date"
              className="w-full border rounded-md px-3 py-2 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {!lockedStoreId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">店鋪</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={storeFilterId}
                onChange={(e) => setStoreFilterId(e.target.value)}
              >
                <option value="">全部店鋪</option>
                {stores.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => void fetchList()}
              disabled={loading || !dateFrom || !dateTo}
              className="w-full md:w-auto px-4 py-2 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? '搜尋中…' : '搜尋'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          更改日期後按「搜尋」；列表由最舊到最新排列。預設：過去 14 日至未來 30 日（香港日期）。今天是 {today}。
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
          </div>
        ) : bookings.length === 0 ? (
          <p className="text-center text-gray-500 py-16 text-sm">此日期範圍內沒有待結算的 Hold 場。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時段</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[14rem] w-[28%]">場地</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">現時戶口</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">建議積分</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bookings.map((b) => {
                  const isBundle = (b.bundleCount || 1) > 1;
                  const courts =
                    isBundle && b.courtNames?.length
                      ? `${b.courtNames.join('、')}（${b.bundleCount} 場）`
                      : b.court?.name || '—';
                  const specialText = String(b.specialRequests || '').trim();
                  const hasSpecial = specialText.length > 0;
                  const specialPreview =
                    specialText.length > 48 ? `${specialText.slice(0, 48)}…` : specialText;
                  return (
                    <tr key={b._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {b.startTime}–{b.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{storeName(b)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 min-w-[14rem] max-w-md">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openDetail(b)}
                            className="text-left text-primary-700 hover:text-primary-900 hover:underline font-medium"
                            title="查看預約詳情"
                          >
                            {courts}
                          </button>
                          {isBundle && (
                            <span className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                              包場
                            </span>
                          )}
                          {hasSpecial && (
                            <span
                              className="text-xs text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded shrink-0"
                              title={specialText}
                            >
                              特殊要求
                            </span>
                          )}
                        </div>
                        {hasSpecial && (
                          <p
                            className="mt-1.5 text-xs text-gray-500 line-clamp-2 break-words"
                            title={specialText}
                          >
                            {specialPreview}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>{b.user?.name || '—'}</div>
                        <div className="text-xs text-gray-400">{b.user?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-800">{b.suggestedPoints ?? 0}</td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void openDetail(b)}
                          className="text-sm text-gray-600 hover:text-gray-900"
                        >
                          詳情
                        </button>
                        <button
                          type="button"
                          onClick={() => openSettle(b)}
                          className="text-sm text-primary-700 hover:text-primary-800 font-medium"
                        >
                          結算
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && bookings.length > 0 && (
          <p className="px-4 py-3 text-xs text-gray-500 border-t">共 {bookings.length} 筆待結算（包場已合併為一列）</p>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">結算 Hold 場</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {formatDate(selected.date)} {selected.startTime}–{selected.endTime} · {storeName(selected)}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {(selected.bundleCount || 1) > 1
                    ? `包場：${(selected.courtNames || []).join('、')}`
                    : selected.court?.name}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-1 text-gray-500">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-1 mb-4 bg-gray-50">
              <button
                type="button"
                onClick={() => setSettleMode('points')}
                className={`flex-1 py-2 text-sm rounded-md font-medium ${
                  settleMode === 'points' ? 'bg-white shadow text-primary-700' : 'text-gray-600'
                }`}
              >
                扣積分結算
              </button>
              <button
                type="button"
                onClick={() => setSettleMode('external')}
                className={`flex-1 py-2 text-sm rounded-md font-medium ${
                  settleMode === 'external' ? 'bg-white shadow text-primary-700' : 'text-gray-600'
                }`}
              >
                現場收款
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  指派用戶 {settleMode === 'points' ? <span className="text-red-500">*</span> : null}
                  {settleMode === 'external' && (
                    <span className="text-gray-400 font-normal">（可選，留空則保持現時戶口）</span>
                  )}
                </label>
                <UserAutocomplete
                  value={settleUser?._id || ''}
                  onChange={handleSettleUserChange}
                  placeholder="搜索姓名、電郵或電話…"
                />
                {settleMode === 'points' && settleUserBalance !== null && (
                  <p className="text-xs mt-1">
                    用戶餘額：
                    <span
                      className={
                        settleUserBalance < netPayable
                          ? 'text-red-600 font-medium'
                          : 'text-green-700 font-medium'
                      }
                    >
                      {settleUserBalance}
                    </span>{' '}
                    積分
                  </p>
                )}
              </div>
              {settleMode === 'points' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      結算基數（折扣前）
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={settlePoints}
                      onChange={(e) => setSettlePoints(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      預設為 hold 時輸入金額／建議積分。兌換碼以此為基數計算。
                    </p>
                  </div>
                  <SettlePendingRedeems
                    bookingId={selected._id}
                    baseAmount={settleBase}
                    forUserId={settleUser?._id || selected.user?._id || null}
                    courtId={selected.court?._id}
                    date={selected.date}
                    startTime={selected.startTime}
                    onPreviewChange={setRedeemPreview}
                    disabled={settling}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={settleReason}
                      onChange={(e) => setSettleReason(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-amber-900 font-medium">
                    將扣除 {netPayable} 積分
                    {redeemPreview && redeemPreview.totalDiscount > 0
                      ? `（基數 ${settleBase} − 折扣 ${redeemPreview.totalDiscount}）`
                      : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSettle()}
                    disabled={settling || !settleUser || settlePoints === ''}
                    className="w-full py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {settling ? '結算中…' : '確認扣積分結算'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      付款方式 <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={externalMethod}
                      onChange={(e) => setExternalMethod(e.target.value as BookingExternalPaymentMethod)}
                    >
                      {BOOKING_EXTERNAL_PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      收款基數（HKD，折扣前）
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={externalAmount}
                      onChange={(e) => setExternalAmount(e.target.value)}
                      placeholder={`建議 $${selected.suggestedPoints ?? 0}`}
                    />
                  </div>
                  <SettlePendingRedeems
                    bookingId={selected._id}
                    baseAmount={
                      externalAmount.trim()
                        ? parseFloat(externalAmount) || 0
                        : selected.suggestedPoints || 0
                    }
                    forUserId={settleUser?._id || selected.user?._id || null}
                    onPreviewChange={setRedeemPreview}
                    disabled={settling}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      備註{externalMethod === 'other' ? <span className="text-red-500"> *</span> : null}
                    </label>
                    <input
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={externalNote}
                      onChange={(e) => setExternalNote(e.target.value)}
                      placeholder={externalMethod === 'other' ? '請說明付款方式' : '可選'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleMarkPaid()}
                    disabled={settling}
                    className="w-full py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {settling ? '處理中…' : '確認已付款'}
                  </button>
                </>
              )}

              <div className="border-t border-gray-200 pt-4 mt-2">
                {!showVoidForm ? (
                  <button
                    type="button"
                    onClick={() => setShowVoidForm(true)}
                    className="w-full py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                  >
                    Void（已他處扣數／無需結算）
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Void 備註 <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal">（寫清用途，例如活動名稱）</span>
                    </label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      rows={3}
                      value={voidRemark}
                      onChange={(e) => setVoidRemark(e.target.value)}
                      placeholder="例：活動「XXX」包場，已在活動／其他單扣數"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowVoidForm(false);
                          setVoidRemark('');
                        }}
                        className="flex-1 py-2 rounded-md border border-gray-300 text-sm text-gray-700"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleVoid(selected._id)}
                        disabled={voiding || !voidRemark.trim()}
                        className="flex-1 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                      >
                        {voiding ? '處理中…' : '確認 Void'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {detailSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">預約詳情</h3>
              <button type="button" onClick={closeDetail} className="p-1 text-gray-500">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : detailBooking ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">日期</label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {formatDate(String(detailBooking.date || detailSource.date))}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">時間</label>
                    <p className="text-sm text-gray-900 mt-0.5">
                      {String(detailBooking.startTime || detailSource.startTime)} –{' '}
                      {String(detailBooking.endTime || detailSource.endTime)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">店鋪</label>
                  <p className="text-sm text-gray-900 mt-0.5">{storeName(detailSource)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">場地</label>
                  <p className="text-sm text-gray-900 mt-0.5">
                    {detailSettleInfo?.isFullVenue &&
                    detailSettleInfo.bundleBreakdown &&
                    detailSettleInfo.bundleBreakdown.length > 1
                      ? `包場（共 ${detailSettleInfo.bundleCount} 場）：${detailSettleInfo.bundleBreakdown
                          .map((r) => r.courtName)
                          .join('、')}`
                      : (detailSource.bundleCount || 1) > 1
                        ? `包場：${(detailSource.courtNames || []).join('、')}`
                        : (detailBooking.court as { name?: string } | undefined)?.name ||
                          detailSource.court?.name ||
                          '—'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">狀態</label>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 mt-0.5">
                    待結算
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">用戶信息</label>
                  <div className="mt-1 text-sm text-gray-900">
                    <p>
                      {(detailBooking.user as { name?: string } | undefined)?.name ||
                        detailSource.user?.name ||
                        '—'}
                    </p>
                    <p className="text-gray-600">
                      {(detailBooking.user as { email?: string } | undefined)?.email ||
                        detailSource.user?.email}
                    </p>
                    {((detailBooking.user as { phone?: string } | undefined)?.phone ||
                      detailSource.user?.phone) && (
                      <p>
                        {(detailBooking.user as { phone?: string } | undefined)?.phone ||
                          detailSource.user?.phone}
                      </p>
                    )}
                  </div>
                </div>

                {Boolean(detailBooking.specialRequests) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">特殊要求</label>
                    <div className="text-sm text-gray-900 p-3 rounded-lg bg-red-50 border border-red-200 whitespace-pre-wrap">
                      {detailSettleInfo?.isFullVenue &&
                        detailSettleInfo.bundleBreakdown &&
                        detailSettleInfo.bundleBreakdown.length > 1 && (
                          <p className="font-medium mb-2 text-indigo-900">
                            🏢 包場含場地：
                            {detailSettleInfo.bundleBreakdown.map((r) => r.courtName).join('、')}
                          </p>
                        )}
                      {String(detailBooking.specialRequests)}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    管理員留言 (
                    {Array.isArray(detailBooking.adminNotes) ? detailBooking.adminNotes.length : 0})
                  </label>
                  {Array.isArray(detailBooking.adminNotes) && detailBooking.adminNotes.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {(
                        detailBooking.adminNotes as Array<{
                          _id?: string;
                          content: string;
                          createdAt?: string;
                          createdBy?: { name?: string };
                        }>
                      ).map((note, idx) => (
                        <div
                          key={note._id || idx}
                          className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm"
                        >
                          <p className="text-gray-900 whitespace-pre-wrap">{note.content}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {note.createdBy?.name || '管理員'}
                            {note.createdAt
                              ? ` · ${new Date(note.createdAt).toLocaleString('zh-HK')}`
                              : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                      暫無留言
                    </p>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-amber-900">
                    建議結算：{detailSettleInfo?.suggestedPoints ?? detailSource.suggestedPoints ?? 0}{' '}
                    積分
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      closeDetail();
                      openSettle(detailSource);
                    }}
                    className="w-full py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
                  >
                    前往結算
                  </button>

                  {!showVoidForm ? (
                    <button
                      type="button"
                      onClick={() => setShowVoidForm(true)}
                      className="w-full py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                    >
                      Void（已他處扣數／無需結算）
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Void 備註 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        rows={3}
                        value={voidRemark}
                        onChange={(e) => setVoidRemark(e.target.value)}
                        placeholder="例：活動「XXX」包場，已在活動／其他單扣數"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowVoidForm(false);
                            setVoidRemark('');
                          }}
                          className="flex-1 py-2 rounded-md border border-gray-300 text-sm text-gray-700"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleVoid(detailSource._id)}
                          disabled={voiding || !voidRemark.trim()}
                          className="flex-1 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
                        >
                          {voiding ? '處理中…' : '確認 Void'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8 text-sm">無法載入詳情</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingSettleBookings;
