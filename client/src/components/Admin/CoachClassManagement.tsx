import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { useBooking } from '../../contexts/BookingContext';
import {
  AcademicCapIcon,
  BanknotesIcon,
  PencilSquareIcon,
  PlusIcon,
  SpeakerWaveIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import {
  coachClassAdminStatusBadgeClass,
  coachClassAdminStatusLabel,
} from '../../utils/coachEventFormat';

interface CoachInfo {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  coachHourlyRate?: number;
}

interface CourtInfo {
  _id: string;
  name: string;
  number?: number;
  store?: { _id?: string; name?: string } | string;
  isActive?: boolean;
}

interface StoreInfo {
  _id: string;
  name: string;
  slug?: string;
}

interface LinkActivity {
  _id: string;
  title: string;
  startDate?: string;
  store?: string;
}

interface LinkRegular {
  _id: string;
  title: string;
}

interface CoachPaymentForm {
  coachId: string;
  name: string;
  hourlyRate: number;
  amount: number;
}

interface CoachClassRow {
  _id: string;
  title: string;
  coaches?: CoachInfo[];
  coach?: CoachInfo;
  courts?: CourtInfo[];
  court?: CourtInfo | null;
  store?: StoreInfo | string;
  locationType?: 'court' | 'custom';
  customLocation?: string;
  locationLabel?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'scheduled' | 'cancelled';
  paymentStatus?: 'unpaid' | 'paid';
  totalPay?: number;
  coachPayments?: { coach: string | CoachInfo; hourlyRate: number; amount: number }[];
  activity?: { _id: string; title: string } | null;
  regularActivity?: { _id: string; title: string } | null;
  createdAt: string;
}

function courtStoreId(store: CourtInfo['store']): string {
  if (!store) return '';
  if (typeof store === 'string') return store;
  return store._id || '';
}

function courtStoreLabel(store: CourtInfo['store']): string {
  if (!store || typeof store === 'string') return '';
  return store.name ? `${store.name} · ` : '';
}

function generateHourlyTimeOptions(): string[] {
  const times: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    times.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return times;
}

function getEndTimeOptionsAfter(startTime: string): string[] {
  if (!startTime) return [];
  const startHour = parseInt(startTime.split(':')[0], 10);
  const endTimes: string[] = [];
  for (let hour = startHour + 1; hour <= 24; hour += 1) {
    endTimes.push(`${String(hour).padStart(2, '0')}:00`);
  }
  return endTimes;
}

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

function sessionHours(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    if (t === '24:00') return 24 * 60;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let mins = toMin(endTime) - toMin(startTime);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

function rowLocationLabel(row: CoachClassRow): string {
  if (row.locationLabel) return row.locationLabel;
  if (row.locationType === 'custom' && row.customLocation) return row.customLocation;
  const courts = row.courts?.length ? row.courts : row.court ? [row.court] : [];
  if (!courts.length) return '—';
  return courts.map((c) => `${courtStoreLabel(c.store)}${c.name}`).join('、');
}

function rowCoachNames(row: CoachClassRow): string {
  if (row.coaches?.length) return row.coaches.map((c) => c.name).join('、');
  return row.coach?.name || '—';
}

const emptyForm = {
  title: '教練課堂',
  storeId: '',
  coachIds: [] as string[],
  locationType: 'court' as 'court' | 'custom',
  courtIds: [] as string[],
  customLocation: '',
  sessionDate: '',
  startTime: '',
  endTime: '',
  notes: '',
  activityId: '',
  regularActivityId: '',
};

interface CoachClassManagementProps {
  preselectedCoach?: CoachInfo | null;
  autoOpenForm?: boolean;
  onConsumedPrefill?: () => void;
}

const CoachClassManagement: React.FC<CoachClassManagementProps> = ({
  preselectedCoach = null,
  autoOpenForm = false,
  onConsumedPrefill,
}) => {
  const { courts, fetchCourts } = useBooking();
  const [classes, setClasses] = useState<CoachClassRow[]>([]);
  const [coachOptions, setCoachOptions] = useState<CoachInfo[]>([]);
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [activities, setActivities] = useState<LinkActivity[]>([]);
  const [regulars, setRegulars] = useState<LinkRegular[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [payments, setPayments] = useState<CoachPaymentForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('scheduled');
  const [resendingId, setResendingId] = useState<string | null>(null);
  /** 開啟編輯時略過一次自動重算，保留已存堂費 */
  const skipPaymentRebuildRef = useRef(false);

  const hours = useMemo(
    () =>
      form.startTime && form.endTime ? sessionHours(form.startTime, form.endTime) : 0,
    [form.startTime, form.endTime]
  );

  const storeCourts = useMemo(() => {
    return (courts || []).filter((c: CourtInfo) => {
      if (c.isActive === false) return false;
      if (!form.storeId) return true;
      return courtStoreId(c.store) === form.storeId;
    });
  }, [courts, form.storeId]);

  const allCourtsSelected =
    storeCourts.length > 0 && storeCourts.every((c) => form.courtIds.includes(c._id));

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setPayments([]);
  };

  useEffect(() => {
    if (!preselectedCoach) return;
    setEditingId(null);
    const ids = [preselectedCoach._id];
    setForm((f) => ({ ...emptyForm, ...f, coachIds: ids }));
    setPayments([
      {
        coachId: preselectedCoach._id,
        name: preselectedCoach.name,
        hourlyRate: Number(preselectedCoach.coachHourlyRate) || 0,
        amount: 0,
      },
    ]);
    if (autoOpenForm) setShowForm(true);
    onConsumedPrefill?.();
  }, [preselectedCoach, autoOpenForm, onConsumedPrefill]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const res = await api.get('/coach-classes', { params });
      setClasses(res.data?.classes || []);
    } catch (e) {
      console.error(e);
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCourts();
    api
      .get('/stores/admin/all')
      .then((r) => setStores(r.data.stores || []))
      .catch(() => setStores([]));
    api
      .get('/coach-classes/coaches')
      .then((r) => setCoachOptions(r.data?.coaches || []))
      .catch(() => setCoachOptions([]));
    api
      .get('/coach-classes/link-options')
      .then((r) => {
        setActivities(r.data?.activities || []);
        setRegulars(r.data?.regularActivities || []);
      })
      .catch(() => {
        setActivities([]);
        setRegulars([]);
      });
  }, [fetchCourts]);

  useEffect(() => {
    load();
  }, [load]);

  // 教練或時數變更：以時薪 × 時數重算本堂價（保留已選教練的時薪）
  useEffect(() => {
    if (!showForm) return;
    if (skipPaymentRebuildRef.current) {
      skipPaymentRebuildRef.current = false;
      return;
    }
    setPayments((prev) => {
      const prevMap = new Map(prev.map((p) => [p.coachId, p]));
      return form.coachIds.map((id) => {
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
    });
    // 刻意不依賴 coachOptions／rebuild callback，避免晚載入覆寫編輯中的堂費
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only coachIds / hours / showForm
  }, [form.coachIds.join(','), hours, showForm]);

  const formatDate = (d: string) => {
    const x = new Date(d);
    return Number.isNaN(x.getTime())
      ? d
      : x.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPayments([]);
    setShowForm(true);
  };

  const openEdit = (row: CoachClassRow) => {
    const coachIds =
      row.coaches?.map((c) => c._id) ||
      (row.coach?._id ? [row.coach._id] : []);
    const courtIds =
      row.courts?.map((c) => c._id) ||
      (row.court?._id ? [row.court._id] : []);
    const storeId =
      typeof row.store === 'object' && row.store?._id
        ? row.store._id
        : typeof row.store === 'string'
          ? row.store
          : '';

    setEditingId(row._id);
    setForm({
      title: row.title || '教練課堂',
      storeId,
      coachIds,
      locationType: row.locationType === 'custom' ? 'custom' : 'court',
      courtIds,
      customLocation: row.customLocation || '',
      sessionDate: toDateInputValue(row.sessionDate),
      startTime: row.startTime || '',
      endTime: row.endTime || '',
      notes: row.notes || '',
      activityId: row.activity?._id || '',
      regularActivityId: row.regularActivity?._id || '',
    });

    const h = sessionHours(row.startTime, row.endTime);
    const payForms: CoachPaymentForm[] = coachIds.map((id) => {
      const fromRow = (row.coachPayments || []).find(
        (p) => String(typeof p.coach === 'object' ? p.coach._id : p.coach) === id
      );
      const coach = coachOptions.find((c) => c._id === id) || row.coaches?.find((c) => c._id === id);
      const hourlyRate = fromRow?.hourlyRate ?? Number(coach?.coachHourlyRate) ?? 0;
      const amount = fromRow?.amount ?? Math.round(hourlyRate * h * 100) / 100;
      return {
        coachId: id,
        name: coach?.name || id,
        hourlyRate,
        amount,
      };
    });
    skipPaymentRebuildRef.current = true;
    setPayments(payForms);
    setShowForm(true);
  };

  const toggleCoach = (id: string) => {
    setForm((f) => {
      const next = f.coachIds.includes(id)
        ? f.coachIds.filter((x) => x !== id)
        : [...f.coachIds, id];
      return { ...f, coachIds: next };
    });
  };

  const toggleCourt = (id: string) => {
    setForm((f) => ({
      ...f,
      courtIds: f.courtIds.includes(id)
        ? f.courtIds.filter((x) => x !== id)
        : [...f.courtIds, id],
    }));
  };

  const toggleAllCourts = () => {
    setForm((f) => ({
      ...f,
      courtIds: allCourtsSelected ? [] : storeCourts.map((c) => c._id),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeId) {
      alert('請選擇店鋪');
      return;
    }
    if (!form.coachIds.length || !form.sessionDate) {
      alert('請選擇教練與日期');
      return;
    }
    if (form.locationType === 'court' && !form.courtIds.length) {
      alert('請至少勾選一個場地');
      return;
    }
    if (form.locationType === 'custom' && !form.customLocation.trim()) {
      alert('請填寫地點');
      return;
    }
    if (!form.startTime || !form.endTime) {
      alert('請選擇開始與結束時間');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        store: form.storeId,
        coachIds: form.coachIds,
        locationType: form.locationType,
        courtIds: form.locationType === 'court' ? form.courtIds : [],
        customLocation:
          form.locationType === 'custom' ? form.customLocation.trim() : undefined,
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        endTime: form.endTime,
        title: form.title || '教練課堂',
        notes: form.notes || undefined,
        activityId: form.activityId || null,
        regularActivityId: form.regularActivityId || null,
        coachPayments: payments.map((p) => ({
          coach: p.coachId,
          hourlyRate: p.hourlyRate,
          amount: p.amount,
        })),
      };
      if (editingId) {
        const res = await api.put(`/coach-classes/${editingId}`, payload);
        closeForm();
        await load();
        alert(res.data?.message || '教練課堂已更新');
      } else {
        const res = await api.post('/coach-classes', payload);
        closeForm();
        await load();
        alert(res.data?.message || '教練課堂已建立');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || (editingId ? '更新失敗' : '建立失敗'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (row: CoachClassRow) => {
    if (row.paymentStatus === 'paid') {
      alert('已付款課堂不可取消');
      return;
    }
    const msg =
      row.locationType !== 'custom'
        ? '確定取消此教練課堂？相關場地預約亦會一併取消。'
        : '確定取消此教練課堂？';
    if (!window.confirm(msg)) return;
    try {
      await api.post(`/coach-classes/${row._id}/cancel`);
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || '取消失敗');
    }
  };

  const handleMarkPaid = async (row: CoachClassRow) => {
    const total = row.totalPay ?? 0;
    if (
      !window.confirm(
        `確認標記「${row.title}」為已付款？\n將寫入會計支出（薪資）共 $${total}，店鋪：${typeof row.store === 'object' ? row.store?.name : ''}`
      )
    ) {
      return;
    }
    try {
      const res = await api.post(`/coach-classes/${row._id}/mark-paid`);
      await load();
      alert(res.data?.message || '已標記付款');
    } catch (err: any) {
      alert(err.response?.data?.message || '標記付款失敗');
    }
  };

  const handleResendNotify = async (row: CoachClassRow) => {
    if (
      !window.confirm(
        `重發 OpenWA 通知給「${rowCoachNames(row)}」？\n（會再發一次，與是否已提醒無關）`
      )
    ) {
      return;
    }
    setResendingId(row._id);
    try {
      const res = await api.post(`/coach-classes/${row._id}/resend-notify`);
      alert(res.data?.message || '已重發通知');
    } catch (err: any) {
      alert(err.response?.data?.message || '重發通知失敗');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AcademicCapIcon className="w-8 h-8 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">教練課堂</h2>
          <p className="text-sm text-gray-600">
            多教練／多場 hold（恆常班除外）、連結活動／恆常班、計糧與已付款入會計
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700"
        >
          <PlusIcon className="w-5 h-5" />
          新增課堂
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="scheduled">進行中</option>
          <option value="cancelled">已取消</option>
          <option value="">全部</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : classes.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">尚無教練課堂</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">日期／時間</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">店鋪</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">教練</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">地點</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">薪資</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">狀態</th>
                <th className="px-3 py-3 text-left font-medium text-gray-500 w-[7.5rem]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classes.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>{formatDate(row.sessionDate)}</div>
                    <div className="text-xs text-gray-500">
                      {row.startTime} – {row.endTime}
                    </div>
                    <div className="text-xs text-gray-700 mt-0.5">{row.title}</div>
                    {(row.activity || row.regularActivity) && (
                      <div className="text-[11px] text-violet-700 mt-0.5">
                        {row.activity ? `活動：${row.activity.title}` : ''}
                        {row.activity && row.regularActivity ? ' · ' : ''}
                        {row.regularActivity ? `恆常：${row.regularActivity.title}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {typeof row.store === 'object' ? row.store?.name : '—'}
                  </td>
                  <td className="px-4 py-3">{rowCoachNames(row)}</td>
                  <td className="px-4 py-3">{rowLocationLabel(row)}</td>
                  <td className="px-4 py-3">
                    <div>${row.totalPay ?? 0}</div>
                    <div className="text-xs text-gray-500">
                      {row.paymentStatus === 'paid' ? '已付款' : '未付款'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${coachClassAdminStatusBadgeClass(row.status)}`}
                    >
                      {coachClassAdminStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    {row.status === 'scheduled' && (
                      <div className="flex flex-col items-stretch gap-1 min-w-[6.75rem]">
                        <button
                          type="button"
                          onClick={() => handleResendNotify(row)}
                          disabled={resendingId === row._id}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                          title="重發 OpenWA 通知給本堂所有教練"
                        >
                          <SpeakerWaveIcon className="h-3.5 w-3.5 shrink-0" />
                          {resendingId === row._id ? '發送中…' : '重發通知'}
                        </button>
                        {row.paymentStatus !== 'paid' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800 hover:bg-violet-100"
                            >
                              <PencilSquareIcon className="h-3.5 w-3.5 shrink-0" />
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(row)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                            >
                              <BanknotesIcon className="h-3.5 w-3.5 shrink-0" />
                              已付款
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(row)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
                              取消
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingId ? '編輯教練課堂' : '新增教練課堂'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">店鋪 *</label>
                <select
                  required
                  value={form.storeId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      storeId: e.target.value,
                      courtIds: [],
                    }))
                  }
                  className="w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">請選擇店鋪</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">多場必須同一店；自訂地點亦要指定店鋪（計糧入會計用）</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">教練 *（可多選）</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {coachOptions.map((c) => (
                    <label key={c._id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.coachIds.includes(c._id)}
                        onChange={() => toggleCoach(c._id)}
                      />
                      <span>
                        {c.name}
                        <span className="text-xs text-gray-500 ml-1">
                          ${Number(c.coachHourlyRate) || 0}/時
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">地點 *</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.locationType === 'court'}
                      onChange={() =>
                        setForm((f) => ({ ...f, locationType: 'court', customLocation: '' }))
                      }
                    />
                    店內場地（可多選 hold）
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={form.locationType === 'custom'}
                      onChange={() =>
                        setForm((f) => ({ ...f, locationType: 'custom', courtIds: [] }))
                      }
                    />
                    其他地點
                  </label>
                </div>
                {form.locationType === 'court' ? (
                  <div className="rounded-md border border-violet-200 bg-violet-50/50 p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-violet-800">
                        已選 {form.courtIds.length}/{storeCourts.length}
                      </span>
                      <label className="text-sm inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allCourtsSelected}
                          onChange={toggleAllCourts}
                          disabled={!form.storeId || !storeCourts.length}
                        />
                        全選
                      </label>
                    </div>
                    {!form.storeId ? (
                      <p className="text-xs text-amber-700">請先選店鋪</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {storeCourts.map((c) => (
                          <label key={c._id} className="flex items-center gap-2 text-sm bg-white rounded px-2 py-1.5 border">
                            <input
                              type="checkbox"
                              checked={form.courtIds.includes(c._id)}
                              onChange={() => toggleCourt(c._id)}
                            />
                            {c.name}
                            {c.number != null ? `（#${c.number}）` : ''}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    required
                    value={form.customLocation}
                    onChange={(e) => setForm({ ...form, customLocation: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="例如：XX 學校體育館"
                    maxLength={200}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">日期 *</label>
                  <input
                    type="date"
                    required
                    value={form.sessionDate}
                    min={editingId ? undefined : new Date().toISOString().split('T')[0]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sessionDate: e.target.value,
                        startTime: '',
                        endTime: '',
                      }))
                    }
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始 *</label>
                  <select
                    required
                    value={form.startTime}
                    disabled={!form.sessionDate}
                    onChange={(e) => {
                      const startTime = e.target.value;
                      const validEnds = getEndTimeOptionsAfter(startTime);
                      setForm((f) => ({
                        ...f,
                        startTime,
                        endTime: validEnds.includes(f.endTime) ? f.endTime : '',
                      }));
                    }}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">開始時間</option>
                    {generateHourlyTimeOptions().map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束 *</label>
                  <select
                    required
                    value={form.endTime}
                    disabled={!form.startTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">結束時間</option>
                    {getEndTimeOptionsAfter(form.startTime).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {hours > 0 && (
                <p className="text-xs text-gray-600">課堂時數：{hours} 小時</p>
              )}

              {payments.length > 0 && (
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-sm font-medium text-gray-800">本堂薪資（可調整）</p>
                  {payments.map((p, idx) => (
                    <div key={p.coachId} className="grid grid-cols-3 gap-2 items-center text-sm">
                      <span className="truncate">{p.name}</span>
                      <input
                        type="number"
                        min={0}
                        value={p.hourlyRate}
                        onChange={(e) => {
                          const hourlyRate = Number(e.target.value) || 0;
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    hourlyRate,
                                    amount: Math.round(hourlyRate * hours * 100) / 100,
                                  }
                                : x
                            )
                          );
                        }}
                        className="border rounded px-2 py-1"
                        placeholder="時薪"
                      />
                      <input
                        type="number"
                        min={0}
                        value={p.amount}
                        onChange={(e) => {
                          const amount = Number(e.target.value) || 0;
                          setPayments((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, amount } : x))
                          );
                        }}
                        className="border rounded px-2 py-1"
                        placeholder="本堂價"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">
                    中欄＝時薪，右欄＝本堂應付（預設時薪×時數）。總計 $
                    {payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">連結活動中心</label>
                  <select
                    value={form.activityId}
                    onChange={(e) => setForm({ ...form, activityId: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">不連結</option>
                    {activities.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">連結恆常班</label>
                  <select
                    value={form.regularActivityId}
                    onChange={(e) => setForm({ ...form, regularActivityId: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">不連結</option>
                    {regulars.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">連結恆常班時不會自動 hold 場地</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 py-2 border rounded-md">
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-violet-600 text-white rounded-md disabled:opacity-50"
                >
                  {saving ? (editingId ? '更新中…' : '建立中…') : editingId ? '儲存' : '建立'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachClassManagement;
