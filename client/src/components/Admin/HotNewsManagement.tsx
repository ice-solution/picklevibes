import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { PhotoIcon, PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

type HotNewsItem = {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  heroBannerUrl: string;
  sortOrder: number;
  visible: boolean;
};

type FormState = {
  enabled: boolean;
  items: HotNewsItem[];
};

function newItem(): HotNewsItem {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `hn-${Date.now()}`,
    title: '',
    shortDescription: '',
    description: '',
    heroBannerUrl: '',
    sortOrder: 0,
    visible: true
  };
}

const HotNewsManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    enabled: true,
    items: [newItem()]
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/config/hotnews/admin');
      const d = res.data?.data as FormState | undefined;
      if (d) {
        setForm({
          enabled: d.enabled !== false,
          items: Array.isArray(d.items) && d.items.length
            ? d.items.map((it, i) => ({
                ...it,
                sortOrder: i,
                visible: it.visible !== false
              }))
            : [newItem()]
        });
      }
    } catch (e) {
      console.error('載入 HotNews 失敗:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const save = async () => {
    const valid = form.items.filter((it) => String(it.title || '').trim());
    if (!valid.length) {
      alert('請至少保留一則有標題的 Hot News');
      return;
    }
    try {
      await axios.put('/config/hotnews', {
        enabled: form.enabled,
        items: valid.map((it, i) => ({
          ...it,
          sortOrder: i,
          visible: it.visible !== false
        }))
      });
      alert('已保存');
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || '保存失敗');
    }
  };

  const uploadHero = async (index: number, file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post('/vlogs/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const url = res.data?.data?.url;
    if (url) {
      setForm((p) => ({
        ...p,
        items: p.items.map((it, i) => (i === index ? { ...it, heroBannerUrl: url } : it))
      }));
    }
  };

  const addRow = () => {
    setForm((p) => ({ ...p, items: [...p.items, newItem()] }));
  };

  const removeRow = (index: number) => {
    setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== index) }));
  };

  const move = (index: number, dir: -1 | 1) => {
    setForm((p) => {
      const next = [...p.items];
      const j = index + dir;
      if (j < 0 || j >= next.length) return p;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...p, items: next };
    });
  };

  const patchItem = (index: number, patch: Partial<HotNewsItem>) => {
    setForm((p) => ({
      ...p,
      items: p.items.map((it, i) => (i === index ? { ...it, ...patch } : it))
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">HotNews 管理</h2>
          <p className="text-gray-600 mt-1 text-sm">
            可新增多則，用上下箭頭調整順序；每則可獨立「顯示／隱藏」。首頁 banner 顯示<strong>短描述</strong>；點擊後以彈層顯示完整內容。
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={addRow} className="btn-outline inline-flex items-center gap-1" disabled={loading}>
            <PlusIcon className="w-5 h-5" />
            新增一則
          </button>
          <button type="button" onClick={save} className="btn-primary" disabled={loading}>
            保存
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          id="hotnews-enabled"
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="hotnews-enabled" className="text-sm text-gray-700">
          啟用 HotNews 區塊（關閉則首頁不顯示）
        </label>
      </div>

      <div className="mt-8 space-y-8">
        {form.items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-gray-200 p-4 sm:p-5 bg-gray-50/80">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">第 {index + 1} 則</span>
                {!item.visible ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                    已隱藏
                  </span>
                ) : null}
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={(e) => patchItem(index, { visible: e.target.checked })}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  顯示於首頁
                </label>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="上移"
                >
                  <ChevronUpIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                  disabled={index === form.items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="下移"
                >
                  <ChevronDownIcon className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 ml-1"
                  onClick={() => removeRow(index)}
                  aria-label="刪除此則"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">標題 *</label>
                  <input
                    className="input-field"
                    value={item.title}
                    onChange={(e) => patchItem(index, { title: e.target.value })}
                    placeholder="例如：新春開放日"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">短描述（顯示於 banner）</label>
                  <textarea
                    rows={2}
                    className="input-field"
                    value={item.shortDescription}
                    onChange={(e) => patchItem(index, { shortDescription: e.target.value })}
                    placeholder="一兩句話，顯示在首頁卡片上"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">完整內容（彈層內）</label>
                  <textarea
                    rows={5}
                    className="input-field"
                    value={item.description}
                    onChange={(e) => patchItem(index, { description: e.target.value })}
                    placeholder={'支援 HTML，例如：\n<p>歡迎參加！</p>\n<p><a href="https://picklevibes.hk/activities">按此報名</a></p>'}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner 圖片</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input-field flex-1 min-w-[200px]"
                    value={item.heroBannerUrl}
                    onChange={(e) => patchItem(index, { heroBannerUrl: e.target.value })}
                    placeholder="/uploads/vlogs/..."
                  />
                  <label className="btn-outline flex items-center gap-2 cursor-pointer shrink-0">
                    <PhotoIcon className="w-5 h-5" />
                    上傳
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void uploadHero(index, f);
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                {item.heroBannerUrl ? (
                  <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 max-h-48">
                    <img src={item.heroBannerUrl} alt="" className="w-full h-40 object-cover" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default HotNewsManagement;
