import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

type Tier = {
  _id: string;
  name: string;
  minAnnualSpent: number;
  color: string;
  benefits: string[];
  sortOrder: number;
  isActive: boolean;
};

const TierManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);

  const [editing, setEditing] = useState<Tier | null>(null);
  const [form, setForm] = useState({
    name: '',
    minAnnualSpent: 0,
    color: '#2563eb',
    benefitsText: '',
    sortOrder: 0,
    isActive: true,
  });

  const benefitsPreview = useMemo(() => {
    return form.benefitsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [form.benefitsText]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/tiers/admin');
      setEnabled(!!res.data?.data?.enabled);
      setTiers(Array.isArray(res.data?.data?.tiers) ? res.data.data.tiers : []);
    } catch (e) {
      console.error('載入 Tier 管理失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: '',
      minAnnualSpent: 0,
      color: '#2563eb',
      benefitsText: '',
      sortOrder: 0,
      isActive: true,
    });
  };

  const startEdit = (t: Tier) => {
    setEditing(t);
    setForm({
      name: t.name || '',
      minAnnualSpent: t.minAnnualSpent || 0,
      color: t.color || '#2563eb',
      benefitsText: (t.benefits || []).join('\n'),
      sortOrder: t.sortOrder || 0,
      isActive: t.isActive !== false,
    });
  };

  const saveTier = async () => {
    const payload = {
      name: form.name.trim(),
      minAnnualSpent: Number(form.minAnnualSpent) || 0,
      color: form.color.trim() || '#2563eb',
      benefits: benefitsPreview,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: !!form.isActive,
    };

    if (!payload.name) {
      alert('請輸入 Tier 名字');
      return;
    }

    try {
      if (editing?._id) {
        await axios.put(`/tiers/${editing._id}`, payload);
      } else {
        await axios.post('/tiers', payload);
      }
      await fetchAll();
      resetForm();
    } catch (e: any) {
      alert(e?.response?.data?.message || '保存失敗');
    }
  };

  const deleteTier = async (id: string) => {
    if (!window.confirm('確定要刪除此 Tier？')) return;
    try {
      await axios.delete(`/tiers/${id}`);
      await fetchAll();
      if (editing?._id === id) resetForm();
    } catch (e: any) {
      alert(e?.response?.data?.message || '刪除失敗');
    }
  };

  const toggleEnabled = async () => {
    try {
      const next = !enabled;
      await axios.put('/config/tier', { enabled: next });
      setEnabled(next);
    } catch (e: any) {
      alert(e?.response?.data?.message || '更新開關失敗');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tier 功能</h2>
            <p className="text-gray-600 mt-1">以「一年內總消費額度」計算用戶 Tier 與升級進度。</p>
          </div>
          <button
            type="button"
            onClick={toggleEnabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {enabled ? '已開啟' : '已關閉'}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{editing ? '編輯 Tier' : '新增 Tier'}</h3>
          <div className="flex items-center gap-2">
            {editing && (
              <button type="button" onClick={resetForm} className="btn-secondary">
                取消編輯
              </button>
            )}
            <button type="button" onClick={saveTier} className="btn-primary flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              保存
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier 名字</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="input-field"
              placeholder="例如：銀卡 / 金卡 / 鑽石"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">一年內消費額度（積分）</label>
            <input
              type="number"
              min={0}
              value={form.minAnnualSpent}
              onChange={(e) => setForm((p) => ({ ...p, minAnnualSpent: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
            <input
              value={form.color}
              onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
              className="input-field"
              placeholder="#RRGGBB"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">排序（小的在前）</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
              className="input-field"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">福利內容（每行一條）</label>
            <textarea
              rows={4}
              value={form.benefitsText}
              onChange={(e) => setForm((p) => ({ ...p, benefitsText: e.target.value }))}
              className="input-field"
              placeholder={'例如：\n- 會員折扣\n- 優先預約'}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <input
              id="tier-active"
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="tier-active" className="text-sm text-gray-700">
              啟用此 Tier（前台只顯示啟用的 Tier）
            </label>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg"
      >
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Tier 列表</h3>
          <button type="button" onClick={fetchAll} className="btn-outline">
            重新整理
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <p className="text-gray-600">載入中...</p>
          ) : tiers.length === 0 ? (
            <p className="text-gray-600">尚未建立 Tier。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名稱</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">一年內消費門檻</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">顏色</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">啟用</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tiers.map((t) => (
                    <tr key={t._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#2563eb' }} />
                          {t.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(t.minAnnualSpent || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.color}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.isActive ? '是' : '否'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(t)}
                            className="p-2 rounded-lg hover:bg-gray-100"
                            title="編輯"
                          >
                            <PencilIcon className="w-5 h-5 text-gray-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTier(t._id)}
                            className="p-2 rounded-lg hover:bg-red-50"
                            title="刪除"
                          >
                            <TrashIcon className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TierManagement;

