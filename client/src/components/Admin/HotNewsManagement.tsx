import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { PhotoIcon } from '@heroicons/react/24/outline';

type HotNewsData = {
  enabled: boolean;
  heroBannerUrl: string;
  title: string;
  description: string;
};

const HotNewsManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<HotNewsData>({
    enabled: true,
    heroBannerUrl: '',
    title: '最新消息',
    description: '我們會在這裡發布最新活動、賽事與場地公告。'
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/config/hotnews');
      const d = res.data?.data;
      if (d) setForm(d);
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
    try {
      await axios.put('/config/hotnews', form);
      alert('已保存');
      await fetchData();
    } catch (e: any) {
      alert(e?.response?.data?.message || '保存失敗');
    }
  };

  const uploadHero = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post('/vlogs/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    const url = res.data?.data?.url;
    if (url) setForm((p) => ({ ...p, heroBannerUrl: url }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">HotNews 管理</h2>
          <p className="text-gray-600 mt-1">控制首頁第一個 component（hero banner / title / description）。</p>
        </div>
        <button type="button" onClick={save} className="btn-primary" disabled={loading}>
          保存
        </button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-3">
          <input
            id="hotnews-enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="hotnews-enabled" className="text-sm text-gray-700">
            啟用 HotNews（關閉則首頁不顯示）
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input className="input-field" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            rows={3}
            className="input-field"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hero Banner 圖片</label>
          <div className="flex items-center gap-3">
            <input
              className="input-field"
              value={form.heroBannerUrl}
              onChange={(e) => setForm((p) => ({ ...p, heroBannerUrl: e.target.value }))}
              placeholder="/uploads/vlogs/..."
            />
            <label className="btn-outline flex items-center gap-2 cursor-pointer">
              <PhotoIcon className="w-5 h-5" />
              上傳
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadHero(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
          {form.heroBannerUrl ? (
            <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
              <img src={form.heroBannerUrl} alt="" className="w-full h-44 object-cover" />
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

export default HotNewsManagement;

