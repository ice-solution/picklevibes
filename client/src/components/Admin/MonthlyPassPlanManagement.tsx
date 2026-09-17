import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { PencilIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Time24Input from '../Common/Time24Input';

type PassPlan = {
  _id: string;
  type: 'reclub_unlimited' | 'off_peak';
  name: string;
  description?: string;
  price: number;
  durationDays: number;
  offPeakStart?: string;
  offPeakEnd?: string;
  isActive: boolean;
  sortOrder: number;
};

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失敗';
}

const typeLabel = (t: string) =>
  t === 'reclub_unlimited' ? '任打 Reclub' : t === 'off_peak' ? '非繁忙時間' : t;

const MonthlyPassPlanManagement: React.FC = () => {
  const [plans, setPlans] = useState<PassPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PassPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    durationDays: '30',
    offPeakStart: '10:00',
    offPeakEnd: '16:00',
    isActive: true,
    sortOrder: '0',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/monthly-pass-plans/admin');
      setPlans(res.data.plans || []);
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (plan: PassPlan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: String(plan.price ?? 0),
      durationDays: String(plan.durationDays || 30),
      offPeakStart: plan.offPeakStart || '10:00',
      offPeakEnd: plan.offPeakEnd || '16:00',
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder ?? 0),
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.name.trim() || !form.durationDays) {
      alert('請填寫名稱與日數');
      return;
    }
    setBusy(true);
    try {
      await axios.patch(`/monthly-pass-plans/${editing._id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price) || 0,
        durationDays: Number(form.durationDays),
        offPeakStart: form.offPeakStart,
        offPeakEnd: form.offPeakEnd,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      });
      setEditing(null);
      await load();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">月卡方案</h2>
        <p className="text-sm text-gray-500 mt-1">
          兩種固定權益：任打 Reclub（活動收款免單、不限時段）、非繁忙時間（活動時段須完全落在設定窗內）。用「收款連結 →
          賣月卡」售賣。
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-10">載入中…</p>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">方案</th>
                <th className="px-4 py-2 text-left">類型</th>
                <th className="px-4 py-2 text-right">建議售價</th>
                <th className="px-4 py-2 text-right">日數</th>
                <th className="px-4 py-2 text-left">非繁忙窗</th>
                <th className="px-4 py-2 text-left">狀態</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.description ? (
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{typeLabel(p.type)}</td>
                  <td className="px-4 py-3 text-right">HK${Number(p.price).toFixed(0)}</td>
                  <td className="px-4 py-3 text-right">{p.durationDays}</td>
                  <td className="px-4 py-3">
                    {p.type === 'off_peak'
                      ? `${p.offPeakStart || '10:00'} – ${p.offPeakEnd || '16:00'}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="text-emerald-700">啟用</span>
                    ) : (
                      <span className="text-gray-400">停用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="inline-flex items-center gap-1 text-primary-600 text-sm"
                    >
                      <PencilIcon className="w-4 h-4" /> 編輯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-lg my-8 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">編輯：{typeLabel(editing.type)}</h3>
              <button type="button" onClick={() => setEditing(null)}>
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">名稱</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">說明</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">建議售價 HKD</span>
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-gray-700">有效日數</span>
                  <input
                    type="number"
                    min={1}
                    value={form.durationDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                  />
                </label>
              </div>
              {editing.type === 'off_peak' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">非繁忙開始（24小時制）</span>
                    <div className="mt-1">
                      <Time24Input
                        value={form.offPeakStart}
                        onChange={(v) => setForm((f) => ({ ...f, offPeakStart: v }))}
                        required
                      />
                    </div>
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-gray-700">非繁忙結束（24小時制）</span>
                    <div className="mt-1">
                      <Time24Input
                        value={form.offPeakEnd}
                        onChange={(v) => setForm((f) => ({ ...f, offPeakEnd: v }))}
                        required
                      />
                    </div>
                  </label>
                </div>
              )}
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                啟用
              </label>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg bg-gray-100"
              >
                取消
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                儲存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyPassPlanManagement;
