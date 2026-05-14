import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

const defaultBodyHtml = `<p style="margin:0 0 12px;">您好，</p>
<p style="margin:0 0 12px;">感謝一直支持 <strong>PickleVibes</strong>！</p>
<p style="margin:0;">祝運動愉快！</p>`;

type TemplateRow = {
  _id: string;
  name: string;
  subject: string;
  updatedAt?: string;
};

type Props = {
  onUseInSend?: (templateId: string) => void;
};

const EdmTemplatesPanel: React.FC<Props> = ({ onUseInSend }) => {
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [headline, setHeadline] = useState('');
  const [preheader, setPreheader] = useState('');
  const [bodyHtml, setBodyHtml] = useState(defaultBodyHtml);
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [footerNote, setFooterNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/edm/templates', { params: { page: 1, limit: 100 } });
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

  const resetNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSubject('PickleVibes 最新消息');
    setHeadline('最新活動與場地資訊');
    setPreheader('立即查看 PickleVibes 更新');
    setBodyHtml(defaultBodyHtml);
    setCtaUrl('');
    setCtaLabel('前往官網');
    setFooterNote('你收到此郵件是因為曾於 PickleVibes 註冊或預約。');
    setMsg(null);
  };

  const loadOne = async (id: string) => {
    setMsg(null);
    try {
      const res = await api.get(`/edm/templates/${id}`);
      const t = res.data?.data?.template;
      if (!t) {
        setMsg('載入失敗');
        return;
      }
      setEditingId(id);
      setName(t.name || '');
      setDescription(t.description || '');
      setSubject(t.subject || '');
      setHeadline(t.headline || '');
      setPreheader(t.preheader || '');
      setBodyHtml(t.bodyHtml || defaultBodyHtml);
      setCtaUrl(t.ctaUrl || '');
      setCtaLabel(t.ctaLabel || '');
      setFooterNote(t.footerNote || '');
    } catch {
      setMsg('載入失敗');
    }
  };

  const save = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      setMsg('請填寫範本名稱、主旨與 HTML 內文');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      if (editingId) {
        await api.patch(`/edm/templates/${editingId}`, {
          name: name.trim(),
          description: description.trim(),
          subject: subject.trim(),
          headline: headline.trim(),
          preheader: preheader.trim(),
          bodyHtml: bodyHtml.trim(),
          ctaUrl: ctaUrl.trim(),
          ctaLabel: ctaLabel.trim(),
          footerNote: footerNote.trim()
        });
        setMsg('已更新');
      } else {
        await api.post('/edm/templates', {
          name: name.trim(),
          description: description.trim(),
          subject: subject.trim(),
          headline: headline.trim(),
          preheader: preheader.trim(),
          bodyHtml: bodyHtml.trim(),
          ctaUrl: ctaUrl.trim(),
          ctaLabel: ctaLabel.trim(),
          footerNote: footerNote.trim()
        });
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
    if (!window.confirm('確定刪除此範本？')) return;
    try {
      await api.delete(`/edm/templates/${id}`);
      if (editingId === id) resetNew();
      await loadList();
    } catch {
      setMsg('刪除失敗');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <span className="font-medium text-gray-900">範本列表</span>
          <button type="button" className="text-xs btn-outline py-1 px-2" disabled={loading} onClick={() => void loadList()}>
            重新整理
          </button>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[min(60vh,420px)] overflow-y-auto">
          <li>
            <button type="button" className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm text-primary-700" onClick={resetNew}>
              ＋ 新增範本
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
                <div className="text-xs text-gray-500 truncate">{row.subject}</div>
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
        <h3 className="text-lg font-semibold text-gray-900">{editingId ? '編輯範本' : '新增範本'}</h3>
        {msg ? <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded px-3 py-2">{msg}</p> : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">範本名稱 *</label>
          <input className="input-field w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：每月通訊" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">說明（選填）</label>
          <input className="input-field w-full" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">郵件主旨 *</label>
            <input className="input-field w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">內文大標題</label>
            <input className="input-field w-full" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">預覽摘要</label>
          <input className="input-field w-full" value={preheader} onChange={(e) => setPreheader(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">正文 HTML *</label>
          <textarea className="input-field w-full font-mono text-xs" rows={10} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按鈕連結</label>
            <input className="input-field w-full" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按鈕文字</label>
            <input className="input-field w-full" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">頁尾說明</label>
          <input className="input-field w-full" value={footerNote} onChange={(e) => setFooterNote(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? '儲存中…' : editingId ? '更新範本' : '建立範本'}
        </button>
      </div>
    </div>
  );
};

export default EdmTemplatesPanel;
