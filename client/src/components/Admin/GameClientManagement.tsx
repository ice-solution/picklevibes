import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

type GameClientItem = {
  _id: string;
  clientId: string;
  name?: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const GameClientManagement: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GameClientItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [form, setForm] = useState<{ clientId: string; name: string; isActive: boolean }>({
    clientId: '',
    name: '',
    isActive: true
  });

  const filtered = useMemo(() => items, [items]);

  const load = async (query?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.get('/game-clients', { params: { q: query ?? q } });
      setItems(res.data?.data?.items || []);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || '載入失敗');
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createClient = async () => {
    setBusy(true);
    setMessage(null);
    setNewSecret(null);
    try {
      const res = await api.post('/game-clients', {
        clientId: form.clientId.trim(),
        name: form.name.trim(),
        isActive: form.isActive
      });
      const secret = res.data?.data?.clientSecret || null;
      if (secret) setNewSecret(String(secret));
      setForm({ clientId: '', name: '', isActive: true });
      await load();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || '建立失敗');
    } finally {
      setBusy(false);
    }
  };

  const updateClient = async (id: string, patch: Partial<Pick<GameClientItem, 'name' | 'isActive'>>) => {
    setBusy(true);
    setMessage(null);
    try {
      await api.put(`/game-clients/${id}`, patch);
      await load();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || '更新失敗');
    } finally {
      setBusy(false);
    }
  };

  const resetSecret = async (id: string) => {
    setBusy(true);
    setMessage(null);
    setNewSecret(null);
    try {
      const res = await api.post(`/game-clients/${id}/reset-secret`);
      const secret = res.data?.data?.clientSecret || null;
      if (secret) setNewSecret(String(secret));
      await load();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || '重置失敗');
    } finally {
      setBusy(false);
    }
  };

  const deleteClient = async (id: string) => {
    // eslint-disable-next-line no-alert
    const ok = window.confirm('確定要刪除這個 Game Client？刪除後無法復原。');
    if (!ok) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.delete(`/game-clients/${id}`);
      await load();
    } catch (e: any) {
      setMessage(e?.response?.data?.message || '刪除失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Game Client 管理</h2>
          <p className="text-sm text-gray-600 mt-1">
            這裡建立的 <span className="font-mono">clientId / secret</span> 可用於 <span className="font-mono">POST /api/game-auth/login</span> 取得 GAME JWT。
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋 clientId / 名稱"
            className="input-field w-full md:w-72"
          />
          <button
            onClick={() => void load()}
            disabled={busy}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            搜尋
          </button>
        </div>
      </div>

      {!!message && (
        <div className="bg-red-50 text-red-700 border border-red-100 rounded-lg px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {!!newSecret && (
        <div className="bg-amber-50 text-amber-900 border border-amber-100 rounded-lg px-4 py-3 text-sm">
          <div className="font-semibold mb-1">一次性 Secret（請即刻複製保存）</div>
          <div className="font-mono break-all select-all">{newSecret}</div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">建立新 Game Client</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">clientId</label>
            <input
              value={form.clientId}
              onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
              className="input-field"
              placeholder="例如：tv-01 / arcade-02"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名稱（可選）</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="input-field"
              placeholder="例如：灣仔店大電視"
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              啟用
            </label>
            <button
              onClick={() => void createClient()}
              disabled={busy || !form.clientId.trim()}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              建立並產生 Secret
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">現有 Clients</h3>
          <div className="text-sm text-gray-500">
            {loaded ? `共 ${filtered.length} 個` : '載入中...'}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">clientId</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名稱</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">最後登入</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((it) => (
                <tr key={it._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{it.clientId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input
                      value={it.name || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, name: v } : x)));
                      }}
                      onBlur={(e) => void updateClient(it._id, { name: e.target.value })}
                      className="input-field"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!it.isActive}
                        onChange={(e) => void updateClient(it._id, { isActive: e.target.checked })}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      {it.isActive ? '啟用' : '停用'}
                    </label>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {it.lastLoginAt ? new Date(it.lastLoginAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => void resetSecret(it._id)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-md bg-amber-100 text-amber-900 hover:bg-amber-200 text-xs font-medium disabled:opacity-50"
                      >
                        重置 Secret
                      </button>
                      <button
                        onClick={() => void deleteClient(it._id)}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-md bg-red-100 text-red-800 hover:bg-red-200 text-xs font-medium disabled:opacity-50"
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loaded && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                    暫時未有 Game Client
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GameClientManagement;

