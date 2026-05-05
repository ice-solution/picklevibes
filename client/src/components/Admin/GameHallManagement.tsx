import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

type GameHall = {
  _id: string;
  name: string;
  description?: string;
  seasonKey?: string;
  isActive: boolean;
  createdAt?: string;
};

const GameHallManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<GameHall[]>([]);
  const [selected, setSelected] = useState<GameHall | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    seasonKey: 'season-1',
    isActive: true
  });

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/game-halls?q=${encodeURIComponent(q.trim())}`);
      setItems(res.data?.data?.items || []);
    } catch (e) {
      console.error('載入 GameHall 失敗:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setSelected(null);
    setForm({ name: '', description: '', seasonKey: 'season-1', isActive: true });
  };

  const startEdit = (it: GameHall) => {
    setSelected(it);
    setForm({
      name: it.name || '',
      description: it.description || '',
      seasonKey: it.seasonKey || 'season-1',
      isActive: it.isActive !== false
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      alert('請輸入名稱');
      return;
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      seasonKey: form.seasonKey.trim(),
      isActive: !!form.isActive
    };

    try {
      if (selected?._id) {
        await axios.put(`/game-halls/${selected._id}`, payload);
      } else {
        await axios.post('/game-halls', payload);
      }
      await fetchList();
      alert('已保存');
    } catch (e: any) {
      alert(e?.response?.data?.message || '保存失敗');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('確定要刪除此 GameHall？')) return;
    try {
      await axios.delete(`/game-halls/${id}`);
      if (selected?._id === id) startCreate();
      await fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || '刪除失敗');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">GameHall 管理</h2>
            <p className="text-gray-600 mt-1">建立並派發給 game client 端使用的遊戲廳（Mongo _id）。</p>
          </div>
          <button type="button" onClick={startCreate} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" /> 新增
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input-field" placeholder="搜尋 name/description/season..." />
            <button type="button" className="btn-outline" onClick={fetchList}>搜尋</button>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-gray-600">載入中...</div>
            ) : items.length === 0 ? (
              <div className="text-gray-600">沒有 GameHall。</div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <button
                    key={it._id}
                    type="button"
                    onClick={() => startEdit(it)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected?._id === it._id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900 truncate">{it.name}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${it.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {it.isActive ? '啟用' : '停用'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{it._id}</div>
                    <div className="text-xs text-gray-500 mt-1 truncate">season: {it.seasonKey || 'season-1'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PencilIcon className="w-5 h-5 text-gray-500" />
              <span className="font-semibold text-gray-900">{selected ? '編輯 GameHall' : '新增 GameHall'}</span>
            </div>
            <div className="flex items-center gap-2">
              {selected?._id ? (
                <button type="button" onClick={() => remove(selected._id)} className="btn-secondary flex items-center gap-2">
                  <TrashIcon className="w-5 h-5" /> 刪除
                </button>
              ) : null}
              <button type="button" onClick={save} className="btn-primary">保存</button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {selected?._id ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-sm text-gray-600">GameHall ID（派發給遊戲端）</div>
                <div className="text-sm font-mono text-gray-900 break-all mt-1">{selected._id}</div>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名稱</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
              <textarea rows={3} className="input-field" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Season Key（一期）</label>
                <input className="input-field" value={form.seasonKey} onChange={(e) => setForm((p) => ({ ...p, seasonKey: e.target.value }))} />
                <div className="text-xs text-gray-500 mt-1">重置排行榜可改 seasonKey，例如 season-2</div>
              </div>
              <div className="flex items-center gap-3 mt-6 md:mt-0">
                <input
                  id="gh-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="gh-active" className="text-sm text-gray-700">啟用</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHallManagement;

