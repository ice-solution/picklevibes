import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useBooking } from '../../contexts/BookingContext';
import CoachAutocomplete from '../Common/CoachAutocomplete';
import { AcademicCapIcon, PlusIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface CoachInfo {
  _id: string;
  name: string;
  email?: string;
}

interface CourtInfo {
  _id: string;
  name: string;
  number?: number;
  store?: { name?: string } | string;
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

interface CoachClassRow {
  _id: string;
  title: string;
  coach: CoachInfo;
  court?: CourtInfo | null;
  locationType?: 'court' | 'custom';
  customLocation?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  notes?: string;
  status: 'scheduled' | 'cancelled';
  createdAt: string;
}

function rowLocationLabel(row: CoachClassRow): string {
  if (row.locationType === 'custom' && row.customLocation) {
    return row.customLocation;
  }
  if (row.court) {
    return `${courtStoreLabel(row.court.store)}${row.court.name}`;
  }
  return '—';
}

const emptyForm = {
  title: '教練課堂',
  coachId: '',
  locationType: 'court' as 'court' | 'custom',
  courtId: '',
  customLocation: '',
  sessionDate: '',
  startTime: '',
  endTime: '',
  notes: '',
};

const CoachClassManagement: React.FC = () => {
  const { courts, fetchCourts } = useBooking();
  const [classes, setClasses] = useState<CoachClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedCoach, setSelectedCoach] = useState<CoachInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('scheduled');

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
  }, [fetchCourts]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCourts = (courts || []).filter((c: { isActive?: boolean }) => c.isActive !== false);

  const formatDate = (d: string) => {
    const x = new Date(d);
    return Number.isNaN(x.getTime())
      ? d
      : x.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.coachId || !form.sessionDate) {
      alert('請填寫教練與日期');
      return;
    }
    if (form.locationType === 'court' && !form.courtId) {
      alert('請選擇場地');
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
      const res = await api.post('/coach-classes', {
        coach: form.coachId,
        locationType: form.locationType,
        court: form.locationType === 'court' ? form.courtId : undefined,
        customLocation:
          form.locationType === 'custom' ? form.customLocation.trim() : undefined,
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        endTime: form.endTime,
        title: form.title || '教練課堂',
        notes: form.notes || undefined,
      });
      setShowForm(false);
      setForm(emptyForm);
      setSelectedCoach(null);
      await load();
      alert(res.data?.message || '教練課堂已建立');
    } catch (err: any) {
      alert(err.response?.data?.message || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (row: CoachClassRow) => {
    const hasBooking = row.locationType !== 'custom' && row.court;
    const msg = hasBooking
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AcademicCapIcon className="w-8 h-8 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">教練課堂</h2>
          <p className="text-sm text-gray-600">指派教練與時間；可選店內場地或其他地點</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">日期</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">時間</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">教練</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">地點</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">標題</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">狀態</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classes.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.sessionDate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.startTime} – {row.endTime}
                  </td>
                  <td className="px-4 py-3">{row.coach?.name || '—'}</td>
                  <td className="px-4 py-3">{rowLocationLabel(row)}</td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === 'scheduled'
                          ? 'text-emerald-600'
                          : 'text-gray-400'
                      }
                    >
                      {row.status === 'scheduled' ? '已排程' : '已取消'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(row)}
                        className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        取消
                      </button>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">新增教練課堂</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">教練 *</label>
                <CoachAutocomplete
                  value={form.coachId}
                  onChange={(coach) => {
                    setSelectedCoach(coach);
                    setForm((f) => ({ ...f, coachId: coach?._id || '' }));
                  }}
                  placeholder="搜尋教練姓名或電郵"
                />
                {selectedCoach && (
                  <p className="text-xs text-gray-500 mt-1">已選：{selectedCoach.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">地點 *</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="locationType"
                      checked={form.locationType === 'court'}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          locationType: 'court',
                          customLocation: '',
                        }))
                      }
                    />
                    店內場地
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="locationType"
                      checked={form.locationType === 'custom'}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          locationType: 'custom',
                          courtId: '',
                        }))
                      }
                    />
                    其他地點
                  </label>
                </div>
                {form.locationType === 'court' ? (
                  <select
                    required
                    value={form.courtId}
                    onChange={(e) => setForm({ ...form, courtId: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">請選擇場地</option>
                    {activeCourts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {courtStoreLabel(c.store)}
                        {c.name}
                        {c.number != null ? ` (#${c.number})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={form.customLocation}
                    onChange={(e) => setForm({ ...form, customLocation: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    placeholder="例如：XX 學校體育館、戶外球場"
                    maxLength={200}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
                <input
                  type="date"
                  required
                  value={form.sessionDate}
                  min={new Date().toISOString().split('T')[0]}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始時間 *</label>
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
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">請選擇開始時間</option>
                    {generateHourlyTimeOptions().map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束時間 *</label>
                  <select
                    required
                    value={form.endTime}
                    disabled={!form.sessionDate || !form.startTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border rounded-md px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">請選擇結束時間</option>
                    {getEndTimeOptionsAfter(form.startTime).map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                請先選日期，再選開始時間；結束時間只可選開始之後的整點（與預約場地相同）。
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  placeholder="教練課堂"
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
              <p className="text-xs text-gray-500">
                選擇店內場地時會自動以教練帳戶預約場地（免扣積分）；其他地點僅排入教練課表，不建立場地預約。
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm(emptyForm);
                    setSelectedCoach(null);
                  }}
                  className="flex-1 py-2 border rounded-md"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-violet-600 text-white rounded-md disabled:opacity-50"
                >
                  {saving ? '建立中…' : '建立'}
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
