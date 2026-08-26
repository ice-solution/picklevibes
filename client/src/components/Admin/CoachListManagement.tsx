import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import {
  AcademicCapIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';

interface CoachRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  upcomingClasses: number;
  hasPhone: boolean;
  coachHourlyRate?: number;
  coachPaymentInfo?: string;
  lastLogin?: string;
}

interface CoachListManagementProps {
  onAssignCoach?: (coach: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    coachHourlyRate?: number;
  }) => void;
}

const CoachListManagement: React.FC<CoachListManagementProps> = ({ onAssignCoach }) => {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<CoachRow | null>(null);
  const [editRate, setEditRate] = useState(0);
  const [editPayInfo, setEditPayInfo] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/coach-classes/coaches');
      setCoaches(res.data?.coaches || []);
    } catch (e) {
      console.error(e);
      setCoaches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = coaches.filter((c) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      c.name.toLowerCase().includes(needle) ||
      c.email.toLowerCase().includes(needle) ||
      String(c.phone || '').includes(needle)
    );
  });

  const missingPhone = coaches.filter((c) => !c.hasPhone).length;

  const openEdit = (row: CoachRow) => {
    setEditing(row);
    setEditRate(Number(row.coachHourlyRate) || 0);
    setEditPayInfo(row.coachPaymentInfo || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.patch(`/coach-classes/coaches/${editing._id}`, {
        coachHourlyRate: editRate,
        coachPaymentInfo: editPayInfo,
      });
      setEditing(null);
      await load();
      alert('教練資料已更新');
    } catch (err: any) {
      alert(err.response?.data?.message || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <AcademicCapIcon className="w-8 h-8 text-violet-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">教練列表</h2>
          <p className="text-sm text-gray-600">
            設定時薪與過數資料；派課時預設帶入時薪，可再調整該堂價錢
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="ml-auto text-sm text-violet-700 hover:text-violet-900"
        >
          重新整理
        </button>
      </div>

      {missingPhone > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <ExclamationTriangleIcon className="w-5 h-5 shrink-0" />
          <p>
            有 {missingPhone} 位教練未設定電話。請補上，否則無法派課與發送 WhatsApp。
          </p>
        </div>
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜尋姓名、電郵或電話"
        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          {coaches.length === 0
            ? '尚無教練帳戶。請在「用戶管理」建立角色為教練的用戶。'
            : '沒有符合搜尋的教練'}
        </p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">教練</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">電話</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">時薪</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">過數資料</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">即將課堂</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.hasPhone ? (
                      <span className="inline-flex items-center gap-1 text-gray-800">
                        <PhoneIcon className="w-4 h-4 text-gray-400" />
                        {row.phone}
                      </span>
                    ) : (
                      <span className="text-amber-700 text-xs font-medium">未設定</span>
                    )}
                  </td>
                  <td className="px-4 py-3">${Number(row.coachHourlyRate) || 0}/時</td>
                  <td className="px-4 py-3 max-w-[12rem] truncate text-gray-600">
                    {row.coachPaymentInfo || '—'}
                  </td>
                  <td className="px-4 py-3">{row.upcomingClasses}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="text-gray-700 hover:text-gray-900 inline-flex items-center gap-1"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      時薪／過數
                    </button>
                    {onAssignCoach && (
                      <button
                        type="button"
                        disabled={!row.hasPhone || row.isActive === false}
                        onClick={() =>
                          onAssignCoach({
                            _id: row._id,
                            name: row.name,
                            email: row.email,
                            phone: row.phone,
                            coachHourlyRate: row.coachHourlyRate,
                          })
                        }
                        className="text-violet-700 hover:text-violet-900 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        派課
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">編輯 {editing.name}</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">時薪（$/小時）</label>
              <input
                type="number"
                min={0}
                step={1}
                value={editRate}
                onChange={(e) => setEditRate(Number(e.target.value) || 0)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">過數資料</label>
              <textarea
                value={editPayInfo}
                onChange={(e) => setEditPayInfo(e.target.value)}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="銀行／FPS／戶口名等"
                maxLength={500}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 py-2 border rounded-md"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveEdit}
                className="flex-1 py-2 bg-violet-600 text-white rounded-md disabled:opacity-50"
              >
                {saving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachListManagement;
