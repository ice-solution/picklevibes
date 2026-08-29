import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

type StoreOption = { _id: string; name: string; slug: string };

type PaymentLinkDoc = {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  pointsAmount?: number | null;
  code: string;
  isActive: boolean;
  expiresAt?: string | null;
  store: StoreOption | string;
  createdBy?: { name?: string; email?: string };
  stats?: { paidCount?: number; paidAmountTotal?: number };
  createdAt?: string;
};

type PaymentRow = {
  _id: string;
  amount: number;
  method: string;
  status: string;
  contactEmail?: string;
  contactPhone?: string;
  payerNote?: string;
  user?: { name?: string; email?: string; phone?: string } | null;
  payment?: { paidAt?: string; transactionId?: string };
  refundedAt?: string | null;
  wonderRefundVerified?: boolean;
  wonderRefundLastError?: string;
  createdAt: string;
};

function errMsg(e: unknown) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失敗';
}

function publicPayUrl(code: string) {
  if (typeof window === 'undefined') return `/pay/${code}`;
  return `${window.location.origin}/pay/${code}`;
}

function toDatetimeLocalValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PaymentLinkManagement: React.FC = () => {
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [filterStore, setFilterStore] = useState('');
  const [links, setLinks] = useState<PaymentLinkDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentLinkDoc | null>(null);
  const [form, setForm] = useState({
    store: '',
    title: '',
    description: '',
    amount: '',
    pointsAmount: '',
    expiresAt: '',
    isActive: true,
  });

  const [paymentsLink, setPaymentsLink] = useState<PaymentLinkDoc | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    const res = await axios.get('/stores/admin/all');
    setStores(res.data.stores || []);
  }, []);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterStore ? `?store=${filterStore}` : '';
      const res = await axios.get(`/payment-links${params}`);
      setLinks(res.data.links || []);
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filterStore]);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      store: filterStore || stores[0]?._id || '',
      title: '',
      description: '',
      amount: '',
      pointsAmount: '',
      expiresAt: '',
      isActive: true,
    });
    setEditorOpen(true);
  };

  const openEdit = (link: PaymentLinkDoc) => {
    setEditing(link);
    setForm({
      store: typeof link.store === 'string' ? link.store : link.store._id,
      title: link.title,
      description: link.description || '',
      amount: String(link.amount),
      pointsAmount: String(
        link.pointsAmount != null && link.pointsAmount > 0
          ? link.pointsAmount
          : link.amount
      ),
      expiresAt: toDatetimeLocalValue(link.expiresAt),
      isActive: link.isActive,
    });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.store || !form.title.trim() || !form.amount || !form.pointsAmount) {
      alert('請填寫店鋪、標題、正價與積分價');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        store: form.store,
        title: form.title.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
        pointsAmount: Number(form.pointsAmount),
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        isActive: form.isActive,
      };
      if (editing) {
        await axios.patch(`/payment-links/${editing._id}`, payload);
      } else {
        await axios.post('/payment-links', payload);
      }
      setEditorOpen(false);
      await loadLinks();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (link: PaymentLinkDoc) => {
    try {
      await axios.patch(`/payment-links/${link._id}/toggle`, { isActive: !link.isActive });
      await loadLinks();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const copyUrl = async (code: string) => {
    const url = publicPayUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      alert('已複製連結');
    } catch {
      prompt('複製此連結：', url);
    }
  };

  const openPayments = async (link: PaymentLinkDoc) => {
    setPaymentsLink(link);
    setPaymentsLoading(true);
    try {
      const res = await axios.get(`/payment-links/${link._id}/payments?limit=100`);
      setPayments(res.data.payments || []);
    } catch (e) {
      alert(errMsg(e));
      setPaymentsLink(null);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const refreshPayments = async () => {
    if (!paymentsLink) return;
    const res = await axios.get(`/payment-links/${paymentsLink._id}/payments?limit=100`);
    setPayments(res.data.payments || []);
  };

  const handleRefundPayment = async (payment: PaymentRow) => {
    if (!paymentsLink) return;
    if (payment.status !== 'completed') return;
    const reason = window.prompt('退款原因（可選）：') ?? '';
    const refundHint =
      payment.method === 'wonder'
        ? '此操作會呼叫 Wonder 退款並沖銷會計收入。'
        : payment.method === 'stripe'
          ? '此操作會呼叫 Stripe 退款。'
          : '此操作會退回積分。';
    if (!window.confirm(`確定退款 HK$${Number(payment.amount).toFixed(2)}？${refundHint}`)) {
      return;
    }
    setRefundingId(payment._id);
    try {
      await axios.post(`/payment-links/${paymentsLink._id}/payments/${payment._id}/refund`, {
        reason,
      });
      alert('退款成功');
      await refreshPayments();
      await loadLinks();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setRefundingId(null);
    }
  };

  const handleRetryWonderRefund = async (payment: PaymentRow) => {
    if (!paymentsLink) return;
    if (
      !window.confirm(
        `此筆已標記退款，但 Wonder 可能未完成。確定重試 Wonder 退款 HK$${Number(payment.amount).toFixed(2)}？`
      )
    ) {
      return;
    }
    setRefundingId(payment._id);
    try {
      await axios.post(
        `/payment-links/${paymentsLink._id}/payments/${payment._id}/retry-wonder-refund`,
        {}
      );
      alert('Wonder 退款已確認');
      await refreshPayments();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setRefundingId(null);
    }
  };

  const methodLabel = (m: string) => {
    if (m === 'points') return '積分';
    if (m === 'wonder') return 'Wonder 線上';
    if (m === 'stripe') return 'Stripe 線上';
    return m;
  };

  const statusLabel = (p: PaymentRow) => {
    if (p.refundedAt || p.status === 'cancelled') {
      if (p.method === 'wonder' && p.wonderRefundVerified !== true) {
        return '已退款（Wonder 未確認）';
      }
      return '已退款';
    }
    if (p.status === 'completed') return '已完成';
    if (p.status === 'pending') return '待付款';
    if (p.status === 'failed') return '失敗';
    return p.status;
  };

  const canRefundPayment = (p: PaymentRow) =>
    p.status === 'completed' && !p.refundedAt && ['wonder', 'stripe', 'points'].includes(p.method);

  const canRetryWonderRefund = (p: PaymentRow) =>
    p.method === 'wonder' &&
    (p.refundedAt || p.status === 'cancelled') &&
    p.wonderRefundVerified !== true;

  const storeName = useMemo(() => {
    const map = new Map(stores.map((s) => [s._id, s.name]));
    return (store: PaymentLinkDoc['store']) => {
      if (typeof store === 'object' && store?.name) return store.name;
      return map.get(String(store)) || '—';
    };
  }, [stores]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">收款連結</h2>
          <p className="text-sm text-gray-500 mt-1">
            建立可分享 URL；訪客可線上付款（入收支登記），會員可改用積分
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm"
        >
          <PlusIcon className="w-4 h-4" /> 建立連結
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm text-gray-600">店鋪</label>
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">全部</option>
          {stores.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 py-10 text-center">載入中…</p>
      ) : links.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border rounded-xl">尚未有收款連結</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">標題</th>
                <th className="px-4 py-2 text-left">店鋪</th>
                <th className="px-4 py-2 text-right">正價</th>
                <th className="px-4 py-2 text-right">積分價</th>
                <th className="px-4 py-2 text-left">狀態</th>
                <th className="px-4 py-2 text-right">已收</th>
                <th className="px-4 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map((link) => {
                const expired =
                  !!link.expiresAt && new Date(link.expiresAt) <= new Date();
                return (
                  <tr key={link._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{link.title}</p>
                      <p className="text-xs text-gray-400 font-mono">/pay/{link.code}</p>
                      {link.expiresAt && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          過期：{new Date(link.expiresAt).toLocaleString('zh-HK', { hour12: false })}
                          {expired ? '（已過期）' : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">{storeName(link.store)}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      HK${Number(link.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Number(
                        link.pointsAmount != null && link.pointsAmount > 0
                          ? link.pointsAmount
                          : link.amount
                      )}{' '}
                      分
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          link.isActive && !expired
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {link.isActive && !expired ? '開放' : '關閉'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {link.stats?.paidCount || 0} 次
                      <br />
                      <span className="text-xs">
                        HK${Number(link.stats?.paidAmountTotal || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          title="複製連結"
                          onClick={() => void copyUrl(link.code)}
                          className="p-1.5 rounded border hover:bg-gray-50"
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                        <a
                          href={publicPayUrl(link.code)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded border hover:bg-gray-50"
                          title="開啟"
                        >
                          <LinkIcon className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          title="付款記錄"
                          onClick={() => void openPayments(link)}
                          className="p-1.5 rounded border hover:bg-gray-50"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="編輯"
                          onClick={() => openEdit(link)}
                          className="p-1.5 rounded border hover:bg-gray-50"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggle(link)}
                          className="px-2 py-1 text-xs rounded border hover:bg-gray-50"
                        >
                          {link.isActive ? '關閉' : '開啟'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-lg my-8 shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold">{editing ? '編輯收款連結' : '建立收款連結'}</h3>
              <button type="button" onClick={() => setEditorOpen(false)}>
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-gray-700">店鋪</span>
                <select
                  value={form.store}
                  disabled={!!editing}
                  onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
                >
                  <option value="">請選擇</option>
                  {stores.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">標題</span>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="例如：週六場費 AA"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">說明</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">正價（線上付款 HKD）</span>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">積分價（積分付款）</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.pointsAmount}
                  onChange={(e) => setForm((f) => ({ ...f, pointsAmount: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-gray-700">過期時間（可留空）</span>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                開放中
              </label>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100"
              >
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
      )}

      {paymentsLink && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl my-8 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h3 className="font-semibold">付款記錄 · {paymentsLink.title}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {publicPayUrl(paymentsLink.code)}
                </p>
              </div>
              <button type="button" onClick={() => setPaymentsLink(null)}>
                <XMarkIcon className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              {paymentsLoading ? (
                <p className="text-center text-gray-500 py-8">載入中…</p>
              ) : payments.length === 0 ? (
                <p className="text-center text-gray-500 py-8">尚無付款</p>
              ) : (
                <table className="min-w-full text-sm divide-y">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">時間</th>
                      <th className="px-3 py-2 text-left">方式</th>
                      <th className="px-3 py-2 text-left">狀態</th>
                      <th className="px-3 py-2 text-right">金額</th>
                      <th className="px-3 py-2 text-left">付款人</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payments.map((p) => (
                      <tr key={p._id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(p.payment?.paidAt || p.createdAt).toLocaleString('zh-HK', {
                            hour12: false,
                          })}
                        </td>
                        <td className="px-3 py-2">{methodLabel(p.method)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              p.refundedAt || p.status === 'cancelled'
                                ? 'text-red-600'
                                : p.status === 'completed'
                                  ? 'text-green-700'
                                  : 'text-gray-700'
                            }
                          >
                            {statusLabel(p)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">HK${Number(p.amount).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          {p.user?.name || p.contactEmail || p.contactPhone || '訪客'}
                          {p.payerNote ? (
                            <span className="block text-xs text-gray-500">{p.payerNote}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canRefundPayment(p) ? (
                            <button
                              type="button"
                              disabled={refundingId === p._id}
                              onClick={() => void handleRefundPayment(p)}
                              className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {refundingId === p._id ? '退款中…' : '退款'}
                            </button>
                          ) : canRetryWonderRefund(p) ? (
                            <button
                              type="button"
                              disabled={refundingId === p._id}
                              onClick={() => void handleRetryWonderRefund(p)}
                              className="text-sm text-amber-700 hover:text-amber-900 disabled:opacity-50"
                              title={p.wonderRefundLastError || 'Wonder 尚未確認退款'}
                            >
                              {refundingId === p._id ? '重試中…' : '重試 Wonder'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentLinkManagement;
