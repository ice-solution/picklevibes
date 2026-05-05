import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { PlusIcon, TrashIcon, PencilIcon, PhotoIcon, EyeIcon } from '@heroicons/react/24/outline';

type Vlog = {
  _id: string;
  title: string;
  tags?: string[];
  seo?: { title?: string; description?: string; keywords?: string };
  heroBannerUrl?: string;
  contentHtml?: string;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdAt?: string;
};

function normalizeTags(text: string) {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const VlogManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [vlogs, setVlogs] = useState<Vlog[]>([]);
  const [selected, setSelected] = useState<Vlog | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState({
    title: '',
    tagsText: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    heroBannerUrl: '',
    isPublished: false,
  });

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/vlogs?q=${encodeURIComponent(q.trim())}`);
      setVlogs(res.data?.data?.vlogs || []);
    } catch (e) {
      console.error('載入 Vlog 列表失敗:', e);
      setVlogs([]);
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
    setForm({
      title: '',
      tagsText: '',
      seoTitle: '',
      seoDescription: '',
      seoKeywords: '',
      heroBannerUrl: '',
      isPublished: false,
    });
    if (editorRef.current) editorRef.current.innerHTML = '';
  };

  const startEdit = (v: Vlog) => {
    setSelected(v);
    setForm({
      title: v.title || '',
      tagsText: (v.tags || []).join(', '),
      seoTitle: v.seo?.title || '',
      seoDescription: v.seo?.description || '',
      seoKeywords: v.seo?.keywords || '',
      heroBannerUrl: v.heroBannerUrl || '',
      isPublished: !!v.isPublished,
    });
    if (editorRef.current) editorRef.current.innerHTML = v.contentHtml || '';
  };

  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const uploadImage = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post('/vlogs/upload-image', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data?.data?.url as string;
  };

  const handleInsertImage = async (file: File) => {
    try {
      const url = await uploadImage(file);
      exec('insertImage', url);
    } catch (e: any) {
      alert(e?.response?.data?.message || '上傳圖片失敗');
    }
  };

  const handleUploadHero = async (file: File) => {
    try {
      const url = await uploadImage(file);
      setForm((p) => ({ ...p, heroBannerUrl: url }));
    } catch (e: any) {
      alert(e?.response?.data?.message || '上傳 banner 失敗');
    }
  };

  const contentHtml = useMemo(() => {
    return editorRef.current?.innerHTML || '';
  }, [selected]); // 只用於 initial，保存時會直接讀 ref

  const save = async () => {
    const payload = {
      title: form.title.trim(),
      tags: normalizeTags(form.tagsText),
      seo: {
        title: form.seoTitle.trim(),
        description: form.seoDescription.trim(),
        keywords: form.seoKeywords.trim(),
      },
      heroBannerUrl: form.heroBannerUrl.trim(),
      contentHtml: editorRef.current?.innerHTML || '',
      isPublished: !!form.isPublished,
    };

    if (!payload.title) {
      alert('請輸入標題');
      return;
    }

    try {
      if (selected?._id) {
        await axios.put(`/vlogs/${selected._id}`, payload);
      } else {
        await axios.post('/vlogs', payload);
      }
      await fetchList();
      alert('已保存');
    } catch (e: any) {
      alert(e?.response?.data?.message || '保存失敗');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('確定要刪除此 Vlog？')) return;
    try {
      await axios.delete(`/vlogs/${id}`);
      if (selected?._id === id) startCreate();
      await fetchList();
    } catch (e: any) {
      alert(e?.response?.data?.message || '刪除失敗');
    }
  };

  const previewUrl = selected?._id ? `/vlog/${selected._id}` : '';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Vlog 管理</h2>
            <p className="text-gray-600 mt-1">建立/編輯 Vlog 內容、SEO 與標籤。前台用 `_id` 讀取。</p>
          </div>
          <button type="button" onClick={startCreate} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" /> 新增
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-lg">
          <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋標題 / tag / SEO..."
              className="input-field"
            />
            <button type="button" onClick={fetchList} className="btn-outline">
              搜尋
            </button>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-gray-600">載入中...</div>
            ) : vlogs.length === 0 ? (
              <div className="text-gray-600">沒有 vlog。</div>
            ) : (
              <div className="space-y-2">
                {vlogs.map((v) => (
                  <button
                    key={v._id}
                    type="button"
                    onClick={() => startEdit(v)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selected?._id === v._id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-900 truncate">{v.title}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {v.isPublished ? '已發布' : '草稿'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">{v._id}</div>
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
              <span className="font-semibold text-gray-900">{selected ? '編輯 Vlog' : '新增 Vlog'}</span>
            </div>
            <div className="flex items-center gap-2">
              {selected?._id ? (
                <>
                  <a className="btn-outline flex items-center gap-2" href={previewUrl} target="_blank" rel="noreferrer">
                    <EyeIcon className="w-5 h-5" /> 前台查看
                  </a>
                  <button type="button" onClick={() => remove(selected._id)} className="btn-secondary flex items-center gap-2">
                    <TrashIcon className="w-5 h-5" /> 刪除
                  </button>
                </>
              ) : null}
              <button type="button" onClick={save} className="btn-primary">
                保存
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標題</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">標籤（逗號分隔）</label>
                <input value={form.tagsText} onChange={(e) => setForm((p) => ({ ...p, tagsText: e.target.value }))} className="input-field" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO 標題</label>
                <input value={form.seoTitle} onChange={(e) => setForm((p) => ({ ...p, seoTitle: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Keywords</label>
                <input value={form.seoKeywords} onChange={(e) => setForm((p) => ({ ...p, seoKeywords: e.target.value }))} className="input-field" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
                <textarea
                  rows={2}
                  value={form.seoDescription}
                  onChange={(e) => setForm((p) => ({ ...p, seoDescription: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hero Banner</label>
              <div className="flex items-center gap-3">
                <input value={form.heroBannerUrl} onChange={(e) => setForm((p) => ({ ...p, heroBannerUrl: e.target.value }))} className="input-field" placeholder="/uploads/vlogs/..." />
                <label className="btn-outline flex items-center gap-2 cursor-pointer">
                  <PhotoIcon className="w-5 h-5" />
                  上傳
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadHero(f);
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

            <div className="flex items-center gap-3">
              <input
                id="vlog-published"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="vlog-published" className="text-sm text-gray-700">
                發布（前台可見）
              </label>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button type="button" onClick={() => exec('bold')} className="btn-outline">粗體</button>
                <button type="button" onClick={() => exec('italic')} className="btn-outline">斜體</button>
                <button type="button" onClick={() => exec('underline')} className="btn-outline">底線</button>
                <button type="button" onClick={() => exec('insertUnorderedList')} className="btn-outline">• 清單</button>
                <button type="button" onClick={() => exec('formatBlock', 'h2')} className="btn-outline">H2</button>
                <button type="button" onClick={() => exec('formatBlock', 'p')} className="btn-outline">P</button>
                <label className="btn-outline flex items-center gap-2 cursor-pointer">
                  <PhotoIcon className="w-5 h-5" />
                  插入圖片
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleInsertImage(f);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              <div
                ref={editorRef}
                className="min-h-[320px] border border-gray-200 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-primary-500 prose max-w-none"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="在此輸入內容..."
                onInput={() => {
                  // no-op; content read from ref on save
                }}
              />
              {/* keep reference to avoid TS unused; content is in ref */}
              <div className="hidden">{contentHtml}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VlogManagement;

