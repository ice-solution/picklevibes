import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon, PencilIcon } from '@heroicons/react/24/outline';

interface Store {
  _id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  sortOrder: number;
  isActive: boolean;
  enableHikAccess: boolean;
  hikKey?: string;
  hikSecret?: string;
  hikAccessLevelId?: string;
}

const emptyForm = {
  name: '',
  slug: '',
  address: '',
  phone: '',
  sortOrder: 0,
  isActive: true,
  enableHikAccess: false,
  hikKey: '',
  hikSecret: '',
  hikAccessLevelId: '',
};

const StoreManagement: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchStores = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/stores/admin/all');
      setStores(res.data.stores || []);
    } catch (e) {
      console.error(e);
      alert('載入店鋪失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s: Store) => {
    setEditing(s);
    setForm({
      name: s.name,
      slug: s.slug,
      address: s.address,
      phone: s.phone || '',
      sortOrder: s.sortOrder ?? 0,
      isActive: s.isActive,
      enableHikAccess: s.enableHikAccess,
      hikKey: s.hikKey || '',
      hikSecret: s.hikSecret || '',
      hikAccessLevelId: s.hikAccessLevelId || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        hikKey: form.hikKey || null,
        hikSecret: form.hikSecret || null,
        hikAccessLevelId: form.hikAccessLevelId || null,
      };
      if (editing) {
        await axios.put(`/stores/${editing._id}`, payload);
      } else {
        await axios.post('/stores', payload);
      }
      setShowForm(false);
      fetchStores();
    } catch (err: any) {
      alert(err.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">店鋪管理</h2>
          <p className="text-gray-600">管理分店資料與門禁（HIK）設定</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
        >
          <PlusIcon className="w-5 h-5" />
          新增店鋪
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">名稱</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">門禁</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {stores.map((s) => (
              <tr key={s._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.address}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={s.isActive ? 'text-green-600' : 'text-gray-500'}>
                    {s.isActive ? '上線' : '停用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{s.enableHikAccess ? 'HIK' : '僅確認信'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800">
                    <PencilIcon className="w-5 h-5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">{editing ? '編輯店鋪' : '新增店鋪'}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input className="w-full border rounded-md px-3 py-2" placeholder="名稱 *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="slug *" required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="地址 *" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input className="w-full border rounded-md px-3 py-2" placeholder="電話" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                上線（用戶可見）
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.enableHikAccess} onChange={(e) => setForm({ ...form, enableHikAccess: e.target.checked })} />
                啟用 HIK 門禁
              </label>
              {form.enableHikAccess && (
                <>
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK App Key（留空用全域 .env）" value={form.hikKey} onChange={(e) => setForm({ ...form, hikKey: e.target.value })} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK Secret" value={form.hikSecret} onChange={(e) => setForm({ ...form, hikSecret: e.target.value })} />
                  <input className="w-full border rounded-md px-3 py-2 text-sm" placeholder="HIK Access Level ID" value={form.hikAccessLevelId} onChange={(e) => setForm({ ...form, hikAccessLevelId: e.target.value })} />
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-md">取消</button>
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50">
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreManagement;
