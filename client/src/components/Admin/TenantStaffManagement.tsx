import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { PencilSquareIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  MODULE_CATALOG,
  defaultModulesForRole,
} from '../../utils/storeAdminPermissions';

interface Membership {
  _id: string;
  role: 'manager' | 'staff' | 'shareholder';
  isActive: boolean;
  modules?: string[];
  user: { _id: string; name: string; email: string; phone: string; role: string };
  store: { _id: string; name: string; slug: string };
}

interface StoreOption {
  _id: string;
  name: string;
  slug: string;
}

type AssignMode = 'create' | 'existing';
type StaffRole = 'manager' | 'staff' | 'shareholder';

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'staff', label: '店員（日曆／商店／訂單／活動／POS／收款連結）' },
  { value: 'manager', label: '店長（本店全部功能）' },
  { value: 'shareholder', label: '股東（分析／報告／會計／日曆／收款連結唯讀）' },
];

function roleLabel(role: string) {
  if (role === 'manager') return '店長';
  if (role === 'shareholder') return '股東';
  return '店員';
}

function modulesSummary(role: StaffRole, modules?: string[]) {
  if (role === 'manager') return '全部功能';
  const keys =
    Array.isArray(modules) && modules.length > 0
      ? modules
      : defaultModulesForRole(role) || [];
  const labels = MODULE_CATALOG.filter((m) => keys.includes(m.key)).map((m) => m.label);
  return labels.length ? labels.join('、') : '—';
}

function ModuleChecklist({
  role,
  selected,
  onChange,
}: {
  role: StaffRole;
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  if (role === 'manager') {
    return (
      <p className="text-sm text-gray-500 border rounded-md p-3 bg-gray-50">
        店長預設擁有本店全部功能，無需另外勾選。
      </p>
    );
  }

  const defaults = defaultModulesForRole(role) || [];
  const usingCustom =
    selected.length > 0 &&
    (selected.length !== defaults.length || selected.some((k) => !defaults.includes(k)));

  const toggle = (key: string) => {
    onChange(
      selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]
    );
  };

  const resetDefaults = () => onChange([...defaults]);

  return (
    <div className="border rounded-md p-3 space-y-2 bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-gray-800">可存取功能</div>
        <button
          type="button"
          onClick={resetDefaults}
          className="text-xs text-primary-600 hover:underline"
        >
          還原角色預設
        </button>
      </div>
      <p className="text-xs text-gray-500">
        不勾選額外覆寫時會跟角色預設；若要自訂請勾選需要的模組
        {usingCustom ? '（目前為自訂）' : '（目前為角色預設）'}。
      </p>
      <div className="grid grid-cols-2 gap-1.5 max-h-56 overflow-y-auto">
        {MODULE_CATALOG.map((m) => (
          <label key={m.key} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={selected.includes(m.key)}
              onChange={() => toggle(m.key)}
            />
            {m.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function StoreMultiSelect({
  stores,
  selectedIds,
  onChange,
}: {
  stores: StoreOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const allSelected = stores.length > 0 && selectedIds.length === stores.length;
  const toggleAll = () => {
    onChange(allSelected ? [] : stores.map((s) => s._id));
  };
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="border rounded-md p-3 space-y-2 bg-gray-50">
      <div className="text-sm font-medium text-gray-800">可使用店鋪 *</div>
      <p className="text-xs text-gray-500">可同時勾選多間店鋪，或一次選全部。</p>
      {stores.length === 0 ? (
        <p className="text-sm text-red-600">沒有可指派的店鋪</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            全部店鋪（{stores.length} 間）
          </label>
          <div className="border-t border-gray-200 pt-2 space-y-1 max-h-48 overflow-y-auto">
            {stores.map((s) => (
              <label key={s._id} className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s._id)}
                  onChange={() => toggle(s._id)}
                />
                {s.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function storeAssignPayload(selectedIds: string[], storeCount: number) {
  const all = storeCount > 0 && selectedIds.length === storeCount;
  return all ? { storeId: '__all__' } : { storeIds: selectedIds };
}

/** 與角色預設相同則送 []（清覆寫）；否則送自訂清單 */
function modulesPayload(role: StaffRole, selected: string[]) {
  if (role === 'manager') return { modules: [] as string[] };
  const defaults = defaultModulesForRole(role) || [];
  const same =
    selected.length === defaults.length && selected.every((k) => defaults.includes(k));
  return { modules: same ? [] : selected };
}

const emptyCreateForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  storeIds: [] as string[],
  role: 'staff' as StaffRole,
  modules: (defaultModulesForRole('staff') || []) as string[],
};

const emptyExistingForm = {
  email: '',
  storeIds: [] as string[],
  role: 'staff' as StaffRole,
  modules: (defaultModulesForRole('staff') || []) as string[],
};

const TenantStaffManagement: React.FC = () => {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AssignMode>('create');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [existingForm, setExistingForm] = useState(emptyExistingForm);
  const [editing, setEditing] = useState<Membership | null>(null);
  const [editRole, setEditRole] = useState<StaffRole>('staff');
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editStoreIds, setEditStoreIds] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mRes, sRes] = await Promise.all([
        axios.get('/tenant-memberships'),
        axios.get('/stores/admin/all'),
      ]);
      setMemberships(mRes.data.memberships || []);
      setStores(sRes.data.stores || []);
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

  const setCreateRole = (role: StaffRole) => {
    setCreateForm({
      ...createForm,
      role,
      modules: role === 'manager' ? [] : [...(defaultModulesForRole(role) || [])],
    });
  };

  const setExistingRole = (role: StaffRole) => {
    setExistingForm({
      ...existingForm,
      role,
      modules: role === 'manager' ? [] : [...(defaultModulesForRole(role) || [])],
    });
  };

  const openEdit = (m: Membership) => {
    setEditing(m);
    setEditRole(m.role);
    setEditName(m.user?.name || '');
    setEditPhone(m.user?.phone || '');
    setEditPassword('');
    const userId = m.user?._id;
    const storeIdsForUser = memberships
      .filter((row) => row.user?._id === userId && row.store?._id)
      .map((row) => row.store._id);
    setEditStoreIds([...new Set(storeIdsForUser.length ? storeIdsForUser : [m.store?._id].filter(Boolean))]);
    const custom = Array.isArray(m.modules) && m.modules.length > 0 ? m.modules : null;
    setEditModules(
      m.role === 'manager'
        ? []
        : custom
          ? [...custom]
          : [...(defaultModulesForRole(m.role) || [])]
    );
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password || !createForm.phone) {
      alert('請填寫所有必填欄位');
      return;
    }
    if (createForm.storeIds.length === 0) {
      alert('請選擇至少一間店鋪');
      return;
    }
    const assigningAll = createForm.storeIds.length === stores.length;
    if (assigningAll && !window.confirm(`將指派至全部 ${stores.length} 間店鋪，確定？`)) {
      return;
    }
    try {
      setSaving(true);
      const res = await axios.post('/tenant-memberships/create-account', {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        phone: createForm.phone,
        role: createForm.role,
        ...modulesPayload(createForm.role, createForm.modules),
        ...storeAssignPayload(createForm.storeIds, stores.length),
      });
      setCreateForm(emptyCreateForm);
      fetchData();
      alert(res.data?.message || '店鋪帳號已建立');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '建立失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingForm.email.trim()) {
      alert('請填寫 email');
      return;
    }
    if (existingForm.storeIds.length === 0) {
      alert('請選擇至少一間店鋪');
      return;
    }
    const assigningAll = existingForm.storeIds.length === stores.length;
    if (assigningAll && !window.confirm(`將指派至全部 ${stores.length} 間店鋪，確定？`)) {
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
      const res = await axios.post('/tenant-memberships', {
        userId: lookup.data.user._id,
        role: existingForm.role,
        ...modulesPayload(existingForm.role, existingForm.modules),
        ...storeAssignPayload(existingForm.storeIds, stores.length),
      });
      setExistingForm(emptyExistingForm);
      fetchData();
      alert(res.data?.message || '已指派至店鋪');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '指派失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      alert('請填寫姓名');
      return;
    }
    if (!editPhone.trim()) {
      alert('請填寫電話');
      return;
    }
    if (editStoreIds.length === 0) {
      alert('請選擇至少一間可使用店鋪');
      return;
    }
    const assigningAll = editStoreIds.length === stores.length;
    if (assigningAll && !window.confirm(`將可使用全部 ${stores.length} 間店鋪，確定？`)) {
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        role: editRole,
        name: editName.trim(),
        phone: editPhone.trim(),
        ...modulesPayload(editRole, editModules),
        ...storeAssignPayload(editStoreIds, stores.length),
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      const res = await axios.patch(`/tenant-memberships/${editing._id}`, payload);
      setEditing(null);
      fetchData();
      alert(res.data?.message || '已更新');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '更新失敗');
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

  const editModal =
    editing &&
    createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
        <div
          className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tenant-staff-edit-title"
        >
          <h3 id="tenant-staff-edit-title" className="font-semibold text-gray-900 text-lg">
            編輯店鋪員工
          </h3>
          <p className="text-sm text-gray-600">{editing.user?.email}</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">姓名</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">電話</label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                新密碼（留空則不更改）
              </label>
              <input
                className="w-full border rounded-md px-3 py-2 text-sm"
                type="password"
                placeholder="至少 8 字，含字母與數字"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <StoreMultiSelect
              stores={stores}
              selectedIds={editStoreIds}
              onChange={setEditStoreIds}
            />
            <p className="text-xs text-gray-500 -mt-1">
              勾選變更會同步此帳號可進入的店鋪；角色與功能會套用到所有已勾選店鋪。
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">店鋪角色</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={editRole}
                onChange={(e) => {
                  const role = e.target.value as StaffRole;
                  setEditRole(role);
                  setEditModules(
                    role === 'manager' ? [] : [...(defaultModulesForRole(role) || [])]
                  );
                }}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <ModuleChecklist role={editRole} selected={editModules} onChange={setEditModules} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              onClick={handleSaveEdit}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">店鋪員工指派</h2>
        <p className="text-gray-600 mt-1">
          店長／店員／股東請在此建立、編輯或指派。平台超級管理員請到「用戶管理」設定{' '}
          <code className="text-sm">admin</code>，無需指派店鋪。
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
          <StoreMultiSelect
            stores={stores}
            selectedIds={createForm.storeIds}
            onChange={(storeIds) => setCreateForm({ ...createForm, storeIds })}
          />
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={createForm.role}
            onChange={(e) => setCreateRole(e.target.value as StaffRole)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ModuleChecklist
            role={createForm.role}
            selected={createForm.modules}
            onChange={(modules) => setCreateForm({ ...createForm, modules })}
          />
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
          <p className="text-sm text-gray-500">
            只適用於已註冊的一般球友（用同一個帳號打波兼管店）。
            平台管理員已有全部後台權限，唔好指派；教練請改用「建立店鋪帳號」。
          </p>
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="球友 email *"
            value={existingForm.email}
            onChange={(e) => setExistingForm({ ...existingForm, email: e.target.value })}
          />
          <StoreMultiSelect
            stores={stores}
            selectedIds={existingForm.storeIds}
            onChange={(storeIds) => setExistingForm({ ...existingForm, storeIds })}
          />
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={existingForm.role}
            onChange={(e) => setExistingRole(e.target.value as StaffRole)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ModuleChecklist
            role={existingForm.role}
            selected={existingForm.modules}
            onChange={(modules) => setExistingForm({ ...existingForm, modules })}
          />
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

      {editModal}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳號</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色／功能</th>
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
                    {m.user?.phone ? (
                      <div className="text-gray-400 text-xs">{m.user.phone}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{m.store?.name}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                      {roleLabel(m.role)}
                    </span>
                    <div className="text-xs text-gray-500 mt-1 max-w-xs">
                      {modulesSummary(m.role, m.modules)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mr-3"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(m._id)}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                    >
                      <TrashIcon className="w-4 h-4" />
                      移除
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
