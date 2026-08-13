import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CalendarDaysIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import UserAutocomplete from '../Common/UserAutocomplete';
import { useLockedStoreId } from '../../contexts/StoreAdminContext';

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
    const points = parseInt(settlePoints, 10);
    if (points <= 0) {
      alert('扣款積分必須大於 0');
      return;
    }
    if (settleUserBalance !== null && settleUserBalance < points) {
      alert(`用戶餘額不足！當前：${settleUserBalance}，需要：${points}`);
      return;
    }
    const isBundle = (selected.bundleCount || 1) > 1;
    const courtLabel = isBundle
      ? `包場（${selected.bundleCount} 個場地）`
      : selected.court?.name || '場地';
    if (
      !window.confirm(
        `確認將${isBundle ? '包場' : '此預約'}指派予 ${settleUser.name} 並扣除 ${points} 積分？\n${formatDate(selected.date)} ${selected.startTime}–${selected.endTime} ${courtLabel}`
      )
    ) {
      return;
    }
    try {
      setSettling(true);
      const response = await axios.post(`/bookings/${selected._id}/settle`, {
        userId: settleUser._id,
        points,
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <CalendarDaysIcon className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900">待結算 Hold 場</h3>
            <p className="text-sm text-gray-600 mt-1">
              列出日期範圍內已預先佔場、尚未扣積分結算的預約（不含活動佔場）。結算後會從列表移除。
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
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void fetchList()}
              className="w-full md:w-auto px-4 py-2 rounded-md bg-primary-600 text-white text-sm hover:bg-primary-700"
            >
              重新整理
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">預設：過去 14 日至未來 30 日（香港日期）。今天是 {today}。</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">場地</th>
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
                  return (
                    <tr key={b._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{formatDate(b.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {b.startTime}–{b.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{storeName(b)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {courts}
                        {isBundle && (
                          <span className="ml-2 text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">包場</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div>{b.user?.name || '—'}</div>
                        <div className="text-xs text-gray-400">{b.user?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-800">{b.suggestedPoints ?? 0}</td>
                      <td className="px-4 py-3 text-right">
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
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">指派用戶並結算</h3>
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
            <div className="space-y-4">
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
                  <p className="text-xs mt-1">
                    用戶餘額：
                    <span
                      className={
                        settleUserBalance < parseInt(settlePoints || '0', 10)
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">扣款積分</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={settlePoints}
                  onChange={(e) => setSettlePoints(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                <input
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={settleReason}
                  onChange={(e) => setSettleReason(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSettle()}
                disabled={settling || !settleUser || !settlePoints}
                className="w-full py-2 rounded-md bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {settling ? '結算中…' : '確認結算'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingSettleBookings;
