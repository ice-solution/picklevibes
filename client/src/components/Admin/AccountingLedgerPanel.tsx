import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import apiConfig from '../../config/api';

interface StoreOption {
  _id: string;
  name: string;
  isActive?: boolean;
}

interface LedgerUser {
  _id: string;
  name?: string;
  email?: string;
}

interface LedgerItem {
  _id: string;
  store: StoreOption | string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  category: string;
  note: string;
  imagePath: string;
  createdBy: LedgerUser | string;
  createdAt: string;
}

interface LedgerTotals {
  income: number;
  expense: number;
  net: number;
}

const emptyForm = {
  store: '',
  type: 'expense' as 'income' | 'expense',
  amount: '',
  date: '',
  category: '',
  note: '',
};

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('zh-HK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function ymdToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function toInputDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function receiptUrl(imagePath: string) {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  const base = (apiConfig.API_BASE_URL || '').replace(/\/api\/?$/, '');
  return `${base}${imagePath}`;
}

const AccountingLedgerPanel: React.FC = () => {
  const today = ymdToday();
  const yearStart = `${today.slice(0, 4)}-01-01`;

  const [stores, setStores] = useState<StoreOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [totals, setTotals] = useState<LedgerTotals>({ income: 0, expense: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [fromYmd, setFromYmd] = useState(yearStart);
  const [toYmd, setToYmd] = useState(today);
  const [storeId, setStoreId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const LEDGER_PAGE_SIZE = 50;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LedgerItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const listParams = useMemo(
    () => ({
      from: fromYmd,
      to: toYmd,
      page,
      limit: LEDGER_PAGE_SIZE,
      ...(storeId ? { store: storeId } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(categoryFilter ? { category: categoryFilter } : {}),
    }),
    [fromYmd, toYmd, storeId, typeFilter, categoryFilter, page]
  );

  const loadMeta = useCallback(async () => {
    const [storesRes, catRes] = await Promise.all([
      api.get('/stores/admin/all'),
      api.get('/accounting/ledger/categories'),
    ]);
    setStores(storesRes.data.stores || []);
    setCategories(catRes.data.categories || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/accounting/ledger', { params: listParams });
      setItems(res.data.items || []);
      setTotals(res.data.totals || { income: 0, expense: 0, net: 0 });
      setPagination(
        res.data.pagination || {
          page: 1,
          limit: LEDGER_PAGE_SIZE,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '載入收支失敗');
    } finally {
      setLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    loadMeta().catch(() => {});
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [fromYmd, toYmd, storeId, typeFilter, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      date: today,
      store: storeId || stores[0]?._id || '',
      category: categories[0] || '',
    });
    setReceiptFile(null);
    setShowModal(true);
  };

  const openEdit = (item: LedgerItem) => {
    const sid = typeof item.store === 'object' ? item.store._id : String(item.store);
    setEditing(item);
    setForm({
      store: sid,
      type: item.type,
      amount: String(item.amount),
      date: toInputDate(item.date),
      category: item.category,
      note: item.note || '',
    });
    setReceiptFile(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store || !form.amount || !form.date || !form.category) {
      alert('請填寫必填欄位');
      return;
    }

    const fd = new FormData();
    fd.append('store', form.store);
    fd.append('type', form.type);
    fd.append('amount', form.amount);
    fd.append('date', form.date);
    fd.append('category', form.category);
    fd.append('note', form.note);
    if (receiptFile) fd.append('receipt', receiptFile);

    try {
      setSaving(true);
      if (editing) {
        await api.put(`/accounting/ledger/${editing._id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/accounting/ledger', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: LedgerItem) => {
    if (!window.confirm('確定刪除此收支紀錄？')) return;
    try {
      await api.delete(`/accounting/ledger/${item._id}`);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message || '刪除失敗');
    }
  };

  const storeName = (item: LedgerItem) =>
    typeof item.store === 'object' ? item.store.name : '—';

  const creatorName = (item: LedgerItem) =>
    typeof item.createdBy === 'object' ? item.createdBy.name || item.createdBy.email : '—';

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <strong>收支登記</strong>：手動登記場租、薪資、課程收入等，可上傳單據。
        與上方「系統認列收入」分開；系統收入來自預約／網店，此處為實際收支補充。
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">期間收入</p>
          <p className="text-2xl font-bold text-green-700">HK$ {fmt(totals.income)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">期間支出</p>
          <p className="text-2xl font-bold text-red-600">HK$ {fmt(totals.expense)}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">期間淨額</p>
          <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            HK$ {fmt(totals.net)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">店鋪</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="min-w-[180px] px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部店鋪</option>
            {stores.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部</option>
            <option value="income">收入</option>
            <option value="expense">支出</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">類別</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="">全部</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始</label>
          <input type="date" value={fromYmd} onChange={(e) => setFromYmd(e.target.value)} className="px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">結束</label>
          <input type="date" value={toYmd} onChange={(e) => setToYmd(e.target.value)} className="px-3 py-2 border rounded-lg" />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          重新整理
        </button>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 ml-auto"
        >
          <PlusIcon className="w-4 h-4" />
          新增收支
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店鋪</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">類別</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">備註</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">單據</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">登記人</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    {loading ? '載入中…' : '尚無收支紀錄'}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{toInputDate(item.date)}</td>
                    <td className="px-4 py-3">{storeName(item)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.type === 'income' ? '收入' : '支出'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.category}</td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      item.type === 'income' ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {item.type === 'expense' ? '-' : ''}HK$ {fmt(item.amount)}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-gray-600">{item.note || '—'}</td>
                    <td className="px-4 py-3">
                      {item.imagePath ? (
                        <a
                          href={receiptUrl(item.imagePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline inline-flex items-center gap-1"
                        >
                          <DocumentTextIcon className="w-4 h-4" />
                          查看
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{creatorName(item)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEdit(item)} className="text-primary-600">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(item)} className="text-red-600">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-gray-600">
              第 {pagination.page} / {pagination.totalPages} 頁，共 {pagination.total} 筆
              <span className="text-gray-400 ml-2">（期間合計仍含全部篩選結果）</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border rounded-lg hover:bg-white disabled:opacity-40"
              >
                上一頁
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border rounded-lg hover:bg-white disabled:opacity-40"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">{editing ? '編輯收支' : '新增收支'}</h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-gray-400">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">店鋪 *</label>
                  <select
                    required
                    value={form.store}
                    onChange={(e) => setForm({ ...form, store: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">請選擇</option>
                    {stores.map((s) => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">類型 *</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="income">收入</option>
                    <option value="expense">支出</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">金額 (HK$) *</label>
                  <input
                    required
                    type="text"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">日期 *</label>
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">類別 *</label>
                  <select
                    required
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">備註</label>
                  <textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">單據圖片</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {editing?.imagePath && !receiptFile && (
                    <p className="text-xs text-gray-500 mt-1">
                      現有單據：
                      <a href={receiptUrl(editing.imagePath)} target="_blank" rel="noopener noreferrer" className="text-primary-600 ml-1">
                        查看
                      </a>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg">
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountingLedgerPanel;
