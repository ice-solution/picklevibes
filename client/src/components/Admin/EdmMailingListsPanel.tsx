import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

type ListMode = 'manual' | 'userIds' | 'roles';

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type ListRow = {
  _id: string;
  name: string;
  listMode: ListMode;
  updatedAt?: string;
};

type Props = {
  onUseInSend?: (listId: string) => void;
};

const EdmMailingListsPanel: React.FC<Props> = ({ onUseInSend }) => {
  const [items, setItems] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>('manual');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emailsText, setEmailsText] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserRow[]>([]);
  const [roleUser, setRoleUser] = useState(true);
  const [roleCoach, setRoleCoach] = useState(false);
  const [roleAdmin, setRoleAdmin] = useState(false);
  const [defaultRoleBatchOffset, setDefaultRoleBatchOffset] = useState(0);
  const [defaultRoleBatchLimit, setDefaultRoleBatchLimit] = useState(500);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/edm/mailing-lists', { params: { page: 1, limit: 100 } });
      setItems(res.data?.data?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const searchUsers = useCallback(async (q: string) => {
    const s = q.trim();
    if (!s) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get('/users', { params: { page: 1, limit: 30, search: s } });
      setSearchResults(res.data?.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listMode !== 'userIds') return;
    const t = window.setTimeout(() => {
      void searchUsers(userSearch);
    }, 350);
    return () => window.clearTimeout(t);
  }, [userSearch, listMode, searchUsers]);

  const resetNew = () => {
    setEditingId(null);
    setListMode('manual');
    setName('');
    setDescription('');
    setEmailsText('');
    setSelectedUsers([]);
    setUserSearch('');
    setRoleUser(true);
    setRoleCoach(false);
    setRoleAdmin(false);
    setDefaultRoleBatchOffset(0);
    setDefaultRoleBatchLimit(500);
    setMsg(null);
  };

  const loadOne = async (id: string) => {
    setMsg(null);
    try {
      const res = await api.get(`/edm/mailing-lists/${id}`);
      const list = res.data?.data?.list;
      const populated = res.data?.data?.populatedUsers as UserRow[] | undefined;
      if (!list) {
        setMsg('載入失敗');
        return;
      }
      setEditingId(id);
      setName(list.name || '');
      setDescription(list.description || '');
      const mode = (list.listMode || 'manual') as ListMode;
      setListMode(mode);
      if (mode === 'manual' && Array.isArray(list.emails)) {
        setEmailsText(list.emails.join('\n'));
      } else {
        setEmailsText('');
      }
      if (mode === 'userIds' && populated?.length) {
        setSelectedUsers(populated.map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role || '' })));
      } else {
        setSelectedUsers([]);
      }
      const roles: string[] = list.roles || [];
      setRoleUser(roles.includes('user'));
      setRoleCoach(roles.includes('coach'));
      setRoleAdmin(roles.includes('admin'));
      setDefaultRoleBatchOffset(list.defaultRoleBatchOffset ?? 0);
      setDefaultRoleBatchLimit(list.defaultRoleBatchLimit ?? 500);
    } catch {
      setMsg('載入失敗');
    }
  };

  const buildPayload = () => {
    const base = { name: name.trim(), description: description.trim(), listMode };
    if (listMode === 'manual') {
      return { ...base, emails: emailsText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean) };
    }
    if (listMode === 'userIds') {
      return { ...base, userIds: selectedUsers.map((u) => u._id) };
    }
    const roles: string[] = [];
    if (roleUser) roles.push('user');
    if (roleCoach) roles.push('coach');
    if (roleAdmin) roles.push('admin');
    return {
      ...base,
      roles,
      defaultRoleBatchOffset,
      defaultRoleBatchLimit: Math.min(2000, Math.max(1, defaultRoleBatchLimit))
    };
  };

  const save = async () => {
    if (!name.trim()) {
      setMsg('請填寫列表名稱');
      return;
    }
    if (listMode === 'manual' && !emailsText.trim()) {
      setMsg('請輸入至少一個電郵');
      return;
    }
    if (listMode === 'userIds' && !selectedUsers.length) {
      setMsg('請加入至少一位用戶');
      return;
    }
    if (listMode === 'roles' && !roleUser && !roleCoach && !roleAdmin) {
      setMsg('請至少勾選一個角色');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const payload = buildPayload();
      if (editingId) {
        await api.patch(`/edm/mailing-lists/${editingId}`, payload);
        setMsg('已更新');
      } else {
        await api.post('/edm/mailing-lists', payload);
        setMsg('已建立');
        resetNew();
      }
      await loadList();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMsg(err?.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('確定刪除此發送列表？')) return;
    try {
      await api.delete(`/edm/mailing-lists/${id}`);
      if (editingId === id) resetNew();
      await loadList();
    } catch {
      setMsg('刪除失敗');
    }
  };

  const addUser = (u: UserRow) => {
    setSelectedUsers((prev) => (prev.some((x) => x._id === u._id) ? prev : [...prev, u]));
  };

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((x) => x._id !== id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <span className="font-medium text-gray-900">發送列表</span>
          <button type="button" className="text-xs btn-outline py-1 px-2" disabled={loading} onClick={() => void loadList()}>
            重新整理
          </button>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[min(60vh,420px)] overflow-y-auto">
          <li>
            <button type="button" className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-primary-700" onClick={resetNew}>
              ＋ 新增列表
            </button>
          </li>
          {items.map((row) => (
            <li key={row._id} className="flex items-stretch">
              <button
                type="button"
                className={`flex-1 text-left px-4 py-3 hover:bg-gray-50 ${editingId === row._id ? 'bg-primary-50/80' : ''}`}
                onClick={() => void loadOne(row._id)}
              >
                <div className="font-medium text-gray-900 truncate">{row.name}</div>
                <div className="text-xs text-gray-500">
                  {row.listMode === 'manual' ? '手動電郵' : row.listMode === 'userIds' ? '指定用戶' : '依角色'}
                </div>
              </button>
              <div className="flex flex-col border-l border-gray-100">
                {onUseInSend ? (
                  <button
                    type="button"
                    className="px-2 py-1.5 text-xs text-primary-700 hover:bg-primary-50 shrink-0"
                    onClick={() => onUseInSend(row._id)}
                  >
                    用於發送
                  </button>
                ) : null}
                <button type="button" className="px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 shrink-0" onClick={() => void remove(row._id)}>
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">{editingId ? '編輯發送列表' : '新增發送列表'}</h3>
        <p className="text-xs text-gray-500">
          列表可重用。依角色類型在「發送」頁仍可覆寫本批 offset／limit；此處為預設值。
        </p>
        {msg ? <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-2">{msg}</p> : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">列表名稱 *</label>
          <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：VIP 手動名單" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">說明（選填）</label>
          <input className="input-field w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-2">列表類型</span>
          <div className="flex flex-wrap gap-4">
            {(['manual', 'userIds', 'roles'] as const).map((m) => (
              <label key={m} className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="edm-ml-mode"
                  checked={listMode === m}
                  onChange={() => setListMode(m)}
                  className="text-primary-600"
                />
                {m === 'manual' ? '手動電郵' : m === 'userIds' ? '指定用戶' : '依角色'}
              </label>
            ))}
          </div>
        </div>

        {listMode === 'manual' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">電郵（每行一個，最多 2000）</label>
            <textarea className="input-field w-full font-mono text-sm" rows={8} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} />
          </div>
        ) : null}

        {listMode === 'userIds' ? (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50/80">
            <label className="block text-sm font-medium text-gray-700">搜尋用戶</label>
            <input className="input-field w-full" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="姓名／電郵／電話" />
            {searchLoading ? <p className="text-xs text-gray-500">搜尋中…</p> : null}
            <ul className="max-h-36 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white text-sm">
              {searchResults.map((u) => (
                <li key={u._id} className="flex justify-between items-center px-3 py-2 gap-2">
                  <span className="truncate">{u.name}</span>
                  <button type="button" className="btn-outline text-xs py-0.5 px-2 shrink-0" onClick={() => addUser(u)}>
                    加入
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((u) => (
                <span key={u._id} className="inline-flex items-center gap-1 rounded-full bg-primary-100 text-xs pl-2 pr-1 py-0.5">
                  <span className="truncate max-w-[140px]">{u.email}</span>
                  <button type="button" className="text-gray-600" aria-label="移除" onClick={() => removeUser(u._id)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {listMode === 'roles' ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4 space-y-3">
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleUser} onChange={(e) => setRoleUser(e.target.checked)} className="rounded text-primary-600" />
                user
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleCoach} onChange={(e) => setRoleCoach(e.target.checked)} className="rounded text-primary-600" />
                coach
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={roleAdmin} onChange={(e) => setRoleAdmin(e.target.checked)} className="rounded text-primary-600" />
                admin
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">預設起始 offset</label>
                <input
                  type="number"
                  min={0}
                  className="input-field w-full"
                  value={defaultRoleBatchOffset}
                  onChange={(e) => setDefaultRoleBatchOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">預設每批上限</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  className="input-field w-full"
                  value={defaultRoleBatchLimit}
                  onChange={(e) => setDefaultRoleBatchLimit(Math.min(2000, Math.max(1, parseInt(e.target.value, 10) || 500)))}
                />
              </div>
            </div>
          </div>
        ) : null}

        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? '儲存中…' : editingId ? '更新列表' : '建立列表'}
        </button>
      </div>
    </div>
  );
};

export default EdmMailingListsPanel;
