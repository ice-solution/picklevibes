import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentTextIcon,
  EyeIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

type StoreOption = { _id: string; name: string; slug: string };

type FormField = {
  fieldName: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  order?: number;
};

type ApplicationFormDoc = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  isActive: boolean;
  closedMessage?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  agreement?: { enabled: boolean; label?: string; content?: string };
  fields: FormField[];
  store: StoreOption | string;
  createdAt?: string;
};

type Submission = {
  _id: string;
  data: Record<string, string>;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
};

const emptyField = (): FormField => ({
  fieldName: '',
  label: '',
  type: 'text',
  required: false,
  placeholder: '',
  options: [],
  order: 0,
});

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失敗';
}

function publicUrl(slug: string) {
  if (typeof window === 'undefined') return `/${slug}`;
  return `${window.location.origin}/${slug}`;
}

function mediaUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  return `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

const ApplicationFormManagement: React.FC = () => {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterStore, setFilterStore] = useState('');
  const [forms, setForms] = useState<ApplicationFormDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApplicationFormDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [submissionsForm, setSubmissionsForm] = useState<ApplicationFormDoc | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsPagination, setSubmissionsPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);

  const [formState, setFormState] = useState({
    store: '',
    title: '',
    slug: '',
    description: '',
    bannerUrl: '',
    isActive: true,
    closedMessage: '此申請表目前已關閉，請稍後再試。',
    thankYouTitle: '提交成功',
    thankYouMessage: '感謝您的申請，我們會盡快與您聯絡。',
    agreementEnabled: false,
    agreementLabel: '我已閱讀並同意相關條款',
    agreementContent: '',
    fields: [emptyField()] as FormField[],
  });
  const [bannerUploading, setBannerUploading] = useState(false);

  const loadStores = useCallback(async () => {
    try {
      const res = await axios.get('/stores/admin/all');
      setStores(res.data.stores || []);
    } catch {
      setStores([]);
    }
  }, []);

  const loadForms = useCallback(async () => {
    try {
      setLoading(true);
      const params = filterStore ? `?store=${filterStore}` : '';
      const res = await axios.get(`/application-forms${params}`);
      setForms(res.data.forms || []);
    } catch (e) {
      console.error(e);
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [filterStore]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormState({
      store: filterStore || stores[0]?._id || '',
      title: '',
      slug: '',
      description: '',
      bannerUrl: '',
      isActive: true,
      closedMessage: '此申請表目前已關閉，請稍後再試。',
      thankYouTitle: '提交成功',
      thankYouMessage: '感謝您的申請，我們會盡快與您聯絡。',
      agreementEnabled: false,
      agreementLabel: '我已閱讀並同意相關條款',
      agreementContent: '',
      fields: [
        { fieldName: 'name', label: '姓名', type: 'text', required: true, placeholder: '', options: [], order: 0 },
        { fieldName: 'phone', label: '電話', type: 'tel', required: true, placeholder: '', options: [], order: 1 },
        { fieldName: 'email', label: '電郵', type: 'email', required: false, placeholder: '', options: [], order: 2 },
      ],
    });
  };

  const openEdit = (form: ApplicationFormDoc) => {
    setCreating(false);
    setEditing(form);
    const storeId = typeof form.store === 'string' ? form.store : form.store?._id;
    setFormState({
      store: storeId || '',
      title: form.title,
      slug: form.slug,
      description: form.description || '',
      bannerUrl: form.bannerUrl || '',
      isActive: form.isActive,
      closedMessage: form.closedMessage || '',
      thankYouTitle: form.thankYouTitle || '提交成功',
      thankYouMessage: form.thankYouMessage || '',
      agreementEnabled: !!form.agreement?.enabled,
      agreementLabel: form.agreement?.label || '我已閱讀並同意相關條款',
      agreementContent: form.agreement?.content || '',
      fields: (form.fields || []).length
        ? form.fields.map((f, i) => ({
            fieldName: f.fieldName,
            label: f.label,
            type: f.type,
            required: !!f.required,
            placeholder: f.placeholder || '',
            options: f.options || [],
            order: f.order ?? i,
          }))
        : [emptyField()],
    });
  };

  const closeEditor = () => {
    setCreating(false);
    setEditing(null);
  };

  const updateField = (idx: number, patch: Partial<FormField>) => {
    setFormState((s) => {
      const fields = [...s.fields];
      fields[idx] = { ...fields[idx], ...patch };
      if (patch.label && !fields[idx].fieldName) {
        fields[idx].fieldName = patch.label
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_\u4e00-\u9fff]/g, '');
      }
      return { ...s, fields };
    });
  };

  const save = async () => {
    if (!formState.store || !formState.title.trim()) {
      alert('請選擇店鋪並輸入標題');
      return;
    }
    const fields = formState.fields
      .filter((f) => f.label.trim())
      .map((f, i) => {
        const options =
          f.type === 'select'
            ? (f.options || [])
                .map((o) => {
                  const label = (o.label || o.value || '').trim();
                  return label ? { value: label, label } : null;
                })
                .filter((o): o is { value: string; label: string } => o !== null)
            : [];
        return {
          ...f,
          fieldName: f.fieldName || `field_${i + 1}`,
          order: i,
          options,
        };
      });
    if (!fields.length) {
      alert('請至少加一個欄位');
      return;
    }
    const emptySelect = fields.find((f) => f.type === 'select' && f.options.length === 0);
    if (emptySelect) {
      alert(`下拉欄位「${emptySelect.label}」請至少加一個選項`);
      return;
    }

    const payload = {
      store: formState.store,
      title: formState.title.trim(),
      slug: formState.slug.trim() || undefined,
      description: formState.description,
      bannerUrl: formState.bannerUrl,
      isActive: formState.isActive,
      closedMessage: formState.closedMessage,
      thankYouTitle: formState.thankYouTitle,
      thankYouMessage: formState.thankYouMessage,
      agreement: {
        enabled: formState.agreementEnabled,
        label: formState.agreementLabel,
        content: formState.agreementContent,
      },
      fields,
    };

    try {
      setBusy(true);
      if (editing) {
        await axios.put(`/application-forms/${editing._id}`, payload);
      } else {
        await axios.post('/application-forms', payload);
      }
      closeEditor();
      await loadForms();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (form: ApplicationFormDoc) => {
    try {
      await axios.patch(`/application-forms/${form._id}/toggle`, { isActive: !form.isActive });
      await loadForms();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const remove = async (form: ApplicationFormDoc) => {
    if (!window.confirm(`刪除申請表「${form.title}」及所有提交記錄？`)) return;
    try {
      await axios.delete(`/application-forms/${form._id}`);
      await loadForms();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const loadSubmissions = async (form: ApplicationFormDoc, page = 1) => {
    try {
      setSubmissionsLoading(true);
      setSubmissionsForm(form);
      setSubmissionsPage(page);
      const res = await axios.get(
        `/application-forms/${form._id}/submissions?page=${page}&limit=50`
      );
      setSubmissions(res.data.submissions || []);
      setSubmissionsPagination(
        res.data.pagination || { page, limit: 50, total: 0, pages: 1 }
      );
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const openSubmissions = async (form: ApplicationFormDoc) => {
    await loadSubmissions(form, 1);
  };

  const closeSubmissions = () => {
    setSubmissionsForm(null);
    setSubmissions([]);
    setSubmissionsPage(1);
    setSubmissionsPagination({ page: 1, limit: 50, total: 0, pages: 1 });
  };

  const submissionColumns = useMemo(() => {
    if (!submissionsForm) return [];
    return (submissionsForm.fields || [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((f) => ({
        fieldName: f.fieldName,
        label: f.label || f.fieldName,
      }));
  }, [submissionsForm]);

  const exportSubmissionsXlsx = async () => {
    if (!submissionsForm) return;
    try {
      setExporting(true);
      const res = await axios.get(
        `/application-forms/${submissionsForm._id}/submissions/export`,
        { responseType: 'blob' }
      );
      const disposition = res.headers['content-disposition'] as string | undefined;
      let filename = `申請表_${submissionsForm.slug || 'export'}.xlsx`;
      const match = disposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      if (match) {
        filename = decodeURIComponent(match[1] || match[2]);
      }
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(errMsg(e) || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  const storeName = (form: ApplicationFormDoc) =>
    typeof form.store === 'object' ? form.store?.name : '—';

  const showEditor = creating || !!editing;

  const addField = () => {
    setFormState((s) => ({ ...s, fields: [...s.fields, emptyField()] }));
    requestAnimationFrame(() => {
      document
        .getElementById('application-form-fields-end')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const uploadBanner = async (file: File) => {
    try {
      setBannerUploading(true);
      const fd = new FormData();
      fd.append('banner', file);
      const res = await axios.post('/application-forms/upload-banner', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.url as string;
      if (!url) throw new Error('no url');
      setFormState((s) => ({ ...s, bannerUrl: url }));
    } catch (e) {
      alert(errMsg(e) || '上傳 banner 失敗');
    } finally {
      setBannerUploading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <DocumentTextIcon className="w-7 h-7 text-primary-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">申請表管理</h2>
            <p className="text-sm text-gray-500">一店多表 · 公開網址 /:slug · 可開關</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm"
        >
          <PlusIcon className="w-4 h-4" /> 建立申請表
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-sm text-gray-600">店鋪篩選</label>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
        >
          <option value="">全部店鋪</option>
          {stores.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">載入中…</div>
      ) : forms.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border rounded-xl">尚未有申請表</div>
      ) : (
        <ul className="space-y-2">
          {forms.map((form) => (
            <li
              key={form._id}
              className="bg-white border rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium text-gray-900 truncate">{form.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {storeName(form)} · /{form.slug}
                  <span
                    className={`ml-2 inline-flex px-2 py-0.5 rounded-full ${
                      form.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {form.isActive ? '開啟' : '關閉'}
                  </span>
                </div>
                <a
                  href={publicUrl(form.slug)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary-600 hover:underline break-all"
                >
                  {publicUrl(form.slug)}
                </a>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void toggle(form)}
                  className="px-3 py-1.5 text-xs rounded-lg border"
                >
                  {form.isActive ? '關閉' : '開啟'}
                </button>
                <button
                  type="button"
                  onClick={() => void openSubmissions(form)}
                  className="px-3 py-1.5 text-xs rounded-lg border inline-flex items-center gap-1"
                >
                  <EyeIcon className="w-3.5 h-3.5" /> 提交
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(form)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void remove(form)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <h3 className="font-semibold text-lg">{editing ? '編輯申請表' : '建立申請表'}</h3>
              <button type="button" onClick={closeEditor}>
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="text-sm font-medium text-gray-700">店鋪 *</label>
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={formState.store}
                  onChange={(e) => setFormState((s) => ({ ...s, store: e.target.value }))}
                >
                  <option value="">請選擇</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">標題 *</label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={formState.title}
                  onChange={(e) => setFormState((s) => ({ ...s, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Slug（公開網址）</label>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm"
                  placeholder="留空則由標題自動產生"
                  value={formState.slug}
                  onChange={(e) => setFormState((s) => ({ ...s, slug: e.target.value }))}
                />
                <p className="text-xs text-gray-500 mt-1">公開頁：/{formState.slug || 'your-slug'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">說明</label>
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={formState.description}
                  onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Banner</label>
                <div className="mt-1 space-y-2">
                  {formState.bannerUrl ? (
                    <div className="relative rounded-lg overflow-hidden border bg-gray-50">
                      <img
                        src={mediaUrl(formState.bannerUrl)}
                        alt="Banner"
                        className="w-full max-h-48 object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 px-2 py-1 text-xs rounded bg-white/90 text-red-600 border"
                        onClick={() => setFormState((s) => ({ ...s, bannerUrl: '' }))}
                      >
                        移除
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                      尚未上傳 banner
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer hover:bg-gray-50">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={bannerUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void uploadBanner(file);
                      }}
                    />
                    {bannerUploading ? '上傳中…' : formState.bannerUrl ? '更換圖片' : '上傳圖片'}
                  </label>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(e) => setFormState((s) => ({ ...s, isActive: e.target.checked }))}
                />
                開啟申請表（On）
              </label>
              <div>
                <label className="text-sm font-medium text-gray-700">關閉時訊息</label>
                <textarea
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={formState.closedMessage}
                  onChange={(e) => setFormState((s) => ({ ...s, closedMessage: e.target.value }))}
                />
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium">欄位</h4>
                {formState.fields.map((field, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        className="border rounded px-2 py-1.5 text-sm"
                        placeholder="標籤（顯示名）"
                        value={field.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                      />
                      <input
                        className="border rounded px-2 py-1.5 text-sm font-mono"
                        placeholder="fieldName"
                        value={field.fieldName}
                        onChange={(e) => updateField(idx, { fieldName: e.target.value })}
                      />
                      <select
                        className="border rounded px-2 py-1.5 text-sm"
                        value={field.type}
                        onChange={(e) => {
                          const type = e.target.value as FormField['type'];
                          const patch: Partial<FormField> = { type };
                          if (type === 'select' && !(field.options && field.options.length)) {
                            patch.options = [{ value: '', label: '' }];
                          }
                          updateField(idx, patch);
                        }}
                      >
                        <option value="text">文字</option>
                        <option value="email">電郵</option>
                        <option value="tel">電話</option>
                        <option value="textarea">多行文字</option>
                        <option value="select">下拉</option>
                      </select>
                      <input
                        className="border rounded px-2 py-1.5 text-sm"
                        placeholder="placeholder"
                        value={field.placeholder || ''}
                        onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                      />
                    </div>
                    {field.type === 'select' && (
                      <div className="space-y-2 rounded border border-dashed border-gray-300 bg-white p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">下拉選項</span>
                          <button
                            type="button"
                            className="text-xs text-primary-600"
                            onClick={() => {
                              const options = [...(field.options || []), { value: '', label: '' }];
                              updateField(idx, { options });
                            }}
                          >
                            + 加選項
                          </button>
                        </div>
                        {(field.options || []).length === 0 && (
                          <p className="text-xs text-gray-400">尚未新增選項，請按「加選項」</p>
                        )}
                        {(field.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              className="flex-1 border rounded px-2 py-1.5 text-sm"
                              placeholder={`選項 ${optIdx + 1}`}
                              value={opt.label}
                              onChange={(e) => {
                                const label = e.target.value;
                                const options = (field.options || []).map((o, i) =>
                                  i === optIdx ? { value: label, label } : o
                                );
                                updateField(idx, { options });
                              }}
                            />
                            <button
                              type="button"
                              className="shrink-0 text-xs text-red-500 px-1"
                              onClick={() => {
                                const options = (field.options || []).filter((_, i) => i !== optIdx);
                                updateField(idx, { options });
                              }}
                            >
                              刪除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="text-xs inline-flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                        />
                        必填
                      </label>
                      <button
                        type="button"
                        className="text-xs text-red-500"
                        onClick={() =>
                          setFormState((s) => ({
                            ...s,
                            fields: s.fields.filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        刪除欄位
                      </button>
                    </div>
                  </div>
                ))}
                <div id="application-form-fields-end" />
                <button
                  type="button"
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-primary-400 text-primary-600 text-sm font-medium hover:bg-primary-50"
                  onClick={addField}
                >
                  + 加欄位
                </button>
              </div>

              <div className="border-t pt-4 space-y-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formState.agreementEnabled}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, agreementEnabled: e.target.checked }))
                    }
                  />
                  需要同意條款
                </label>
                {formState.agreementEnabled && (
                  <>
                    <input
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={formState.agreementLabel}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, agreementLabel: e.target.value }))
                      }
                      placeholder="同意勾選文字"
                    />
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      rows={3}
                      value={formState.agreementContent}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, agreementContent: e.target.value }))
                      }
                      placeholder="條款內容（可選）"
                    />
                  </>
                )}
              </div>

              <div className="border-t pt-4 grid grid-cols-1 gap-2">
                <input
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={formState.thankYouTitle}
                  onChange={(e) => setFormState((s) => ({ ...s, thankYouTitle: e.target.value }))}
                  placeholder="成功頁標題"
                />
                <textarea
                  className="border rounded-lg px-3 py-2 text-sm"
                  rows={2}
                  value={formState.thankYouMessage}
                  onChange={(e) => setFormState((s) => ({ ...s, thankYouMessage: e.target.value }))}
                  placeholder="成功頁訊息"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t flex items-center justify-between gap-2 shrink-0 bg-white rounded-b-xl">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-primary-600 text-primary-600 text-sm font-medium hover:bg-primary-50"
                onClick={addField}
              >
                + 加欄位
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={closeEditor} className="px-4 py-2 rounded-lg bg-gray-100">
                  取消
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
                >
                  儲存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submissionsForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl my-8 shadow-xl flex flex-col max-h-[calc(100vh-2rem)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-semibold">提交記錄 · {submissionsForm.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  共 {submissionsPagination.total} 筆
                  {submissionsPagination.pages > 1
                    ? ` · 第 ${submissionsPagination.page} / ${submissionsPagination.pages} 頁`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={exporting || submissionsPagination.total === 0}
                  onClick={() => void exportSubmissionsXlsx()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-primary-600 text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  {exporting ? '匯出中…' : '匯出 XLSX'}
                </button>
                <button type="button" onClick={closeSubmissions}>
                  <XMarkIcon className="w-6 h-6 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-auto flex-1 min-h-0">
              {submissionsLoading ? (
                <p className="text-center text-gray-500 py-10">載入中…</p>
              ) : submissions.length === 0 ? (
                <p className="text-center text-gray-500 py-10">尚無提交</p>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap">
                          提交時間
                        </th>
                        {submissionColumns.map((col) => (
                          <th
                            key={col.fieldName}
                            className="px-3 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {submissions.map((s) => (
                        <tr key={s._id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap align-top">
                            {new Date(s.createdAt).toLocaleString('zh-HK', { hour12: false })}
                          </td>
                          {submissionColumns.map((col) => (
                            <td
                              key={col.fieldName}
                              className="px-3 py-2 text-gray-900 whitespace-pre-wrap max-w-xs align-top"
                            >
                              {s.data?.[col.fieldName] != null && s.data[col.fieldName] !== ''
                                ? String(s.data[col.fieldName])
                                : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {submissionsPagination.pages > 1 && (
              <div className="px-5 py-3 border-t flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  disabled={submissionsLoading || submissionsPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                  onClick={() => void loadSubmissions(submissionsForm, submissionsPage - 1)}
                >
                  <ChevronLeftIcon className="w-4 h-4" /> 上一頁
                </button>
                <span className="text-sm text-gray-600">
                  {submissionsPage} / {submissionsPagination.pages}
                </span>
                <button
                  type="button"
                  disabled={
                    submissionsLoading || submissionsPage >= submissionsPagination.pages
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
                  onClick={() => void loadSubmissions(submissionsForm, submissionsPage + 1)}
                >
                  下一頁 <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationFormManagement;
