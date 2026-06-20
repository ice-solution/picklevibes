import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Membership {
  _id: string;
  role: 'manager' | 'staff';
  isActive: boolean;
  user: { _id: string; name: string; email: string; phone: string; role: string };
  store: { _id: string; name: string; slug: string };
}

interface StoreOption {
  _id: string;
  name: string;
  slug: string;
}

type AssignMode = 'create' | 'existing';

const emptyCreateForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  storeId: '',
  role: 'staff' as 'manager' | 'staff',
};

const emptyExistingForm = {
  email: '',
  storeId: '',
  role: 'staff' as 'manager' | 'staff',
};

const TenantStaffManagement: React.FC = () => {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AssignMode>('create');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [existingForm, setExistingForm] = useState(emptyExistingForm);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mRes, sRes] = await Promise.all([
        axios.get('/tenant-memberships'),
        axios.get('/stores/admin/all'),
      ]);
      setMemberships(mRes.data.memberships || []);
      setStores((sRes.data.stores || []).filter((s: StoreOption & { allianceEnabled?: boolean }) => s.allianceEnabled));
    } catch (e) {
      console.error(e);
      alert('載入店鋪員工失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password || !createForm.phone || !createForm.storeId) {
      alert('請填寫所有必填欄位');
      return;
    }
    try {
      setSaving(true);
      await axios.post('/tenant-memberships/create-account', createForm);
      setCreateForm(emptyCreateForm);
      fetchData();
      alert('店鋪帳號已建立');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingForm.email.trim() || !existingForm.storeId) {
      alert('請填寫 email 並選擇店鋪');
      return;
    }
    try {
      setSaving(true);
      const lookup = await axios.get('/tenant-memberships/lookup-user', {
        params: { email: existingForm.email.trim() },
      });
      if (!lookup.data.found || !lookup.data.user?._id) {
        alert('找不到此 email 的球友帳號，請先請對方註冊或使用「建立店鋪帳號」');
        return;
      }
      await axios.post('/tenant-memberships', {
        userId: lookup.data.user._id,
        storeId: existingForm.storeId,
        role: existingForm.role,
      });
      setExistingForm(emptyExistingForm);
      fetchData();
      alert('已指派至店鋪');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '指派失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('確定移除此店鋪員工指派？若為其唯一店鋪，帳號將還原為一般球友。')) return;
    try {
      await axios.delete(`/tenant-memberships/${id}`);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '移除失敗');
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900">店鋪員工指派</h2>
        <p className="text-gray-600 mt-1">
          <strong>新店鋪 admin／staff 請在此建立或指派</strong>，與「用戶管理」的球友列表分開。
          平台超級管理員（舊版）仍在用戶管理設定 <code className="text-sm">admin</code> 角色。
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'create' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          建立店鋪帳號（建議）
        </button>
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${mode === 'existing' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
        >
          指派現有球友
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreateAccount} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl">
          <h3 className="font-semibold text-gray-900">建立新店鋪員工帳號</h3>
          <p className="text-sm text-gray-500">專用後台登入帳號，不會出現在球友用戶列表。</p>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="姓名 *"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Email *"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="密碼 *（至少 8 字，含字母與數字）"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="電話 *"
            value={createForm.phone}
            onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
          />
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={createForm.storeId}
            onChange={(e) => setCreateForm({ ...createForm, storeId: e.target.value })}
          >
            <option value="">選擇店鋪 *</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'manager' | 'staff' })}
          >
            <option value="staff">店員 (staff)</option>
            <option value="manager">店長 (manager)</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <PlusIcon className="w-5 h-5" />
            {saving ? '建立中…' : '建立並指派'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleAssignExisting} className="bg-white rounded-lg shadow p-6 space-y-4 max-w-xl">
          <h3 className="font-semibold text-gray-900">指派現有球友為店鋪員工</h3>
          <p className="text-sm text-gray-500">僅限已註冊的一般球友（role=user）。教練與平台管理員不可指派。</p>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="球友 email *"
            value={existingForm.email}
            onChange={(e) => setExistingForm({ ...existingForm, email: e.target.value })}
          />
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={existingForm.storeId}
            onChange={(e) => setExistingForm({ ...existingForm, storeId: e.target.value })}
          >
            <option value="">選擇店鋪 *</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={existingForm.role}
            onChange={(e) => setExistingForm({ ...existingForm, role: e.target.value as 'manager' | 'staff' })}
          >
            <option value="staff">店員 (staff)</option>
            <option value="manager">店長 (manager)</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            <PlusIcon className="w-5 h-5" />
            {saving ? '指派中…' : '指派'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳號</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪角色</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {memberships.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">
                  尚未指派任何店鋪員工
                </td>
              </tr>
            ) : (
              memberships.map((m) => (
                <tr key={m._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{m.user?.name}</div>
                    <div className="text-gray-500">{m.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{m.store?.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                      {m.role === 'manager' ? '店長' : '店員'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(m._id)}
                      className="text-red-600 hover:text-red-800"
                      title="移除"
                    >
                      <TrashIcon className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TenantStaffManagement;
