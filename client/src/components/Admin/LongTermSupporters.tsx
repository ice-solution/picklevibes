import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  ArrowPathIcon,
  CheckIcon,
  GiftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type TierBrief = {
  _id: string;
  name: string;
  minAnnualSpent: number;
  color?: string;
};

type SupporterItem = {
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  createdAt: string;
  windowStart: string;
  windowEnd: string;
  yearIndex: number;
  annualSpent: number;
  reachedTiers: TierBrief[];
  unmetTiers: TierBrief[];
};

type RedeemOption = {
  _id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

type SelectionKey = string; // `${userId}:${tierId}`

function selectionKey(userId: string, tierId: string): SelectionKey {
  return `${userId}:${tierId}`;
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('zh-TW');
  } catch {
    return '—';
  }
}

function formatWindow(start?: string, end?: string) {
  return `${formatDate(start)} ～ ${formatDate(end)}`;
}

const LongTermSupporters: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SupporterItem[]>([]);
  const [tiersConfigured, setTiersConfigured] = useState(true);
  const [emptyMessage, setEmptyMessage] = useState('');
  const [selected, setSelected] = useState<Set<SelectionKey>>(new Set());
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [redeemCodes, setRedeemCodes] = useState<RedeemOption[]>([]);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemCodeId, setRedeemCodeId] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [redeemSearch, setRedeemSearch] = useState('');

  const flatRows = useMemo(() => {
    const rows: Array<{
      key: SelectionKey;
      item: SupporterItem;
      unmetTier: TierBrief;
    }> = [];
    for (const item of items) {
      for (const unmet of item.unmetTiers) {
        rows.push({
          key: selectionKey(item.user._id, unmet._id),
          item,
          unmetTier: unmet,
        });
      }
    }
    return rows;
  }, [items]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/tiers/long-term-supporters');
      const data = res.data?.data;
      const list = Array.isArray(data?.items) ? data.items : [];
      setItems(list);
      const hasTiers = Array.isArray(data?.tiers) && data.tiers.length > 0;
      setTiersConfigured(hasTiers);
      setEmptyMessage(data?.message || '');
      setSelected(new Set());
    } catch (e) {
      console.error('載入長期支持用戶失敗:', e);
      setItems([]);
      alert('載入失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const loadRedeemCodes = async (q = '') => {
    setRedeemLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        status: 'active',
        standaloneOnly: 'true',
      });
      if (q.trim()) params.set('q', q.trim());
      const res = await axios.get(`/redeem/admin/list?${params}`);
      setRedeemCodes(Array.isArray(res.data?.redeemCodes) ? res.data.redeemCodes : []);
    } catch {
      setRedeemCodes([]);
    } finally {
      setRedeemLoading(false);
    }
  };

  const openFulfill = async () => {
    if (!selected.size) {
      alert('請至少勾選一筆');
      return;
    }
    setRedeemCodeId('');
    setNote('');
    setSendEmail(true);
    setShowFulfillModal(true);
    await loadRedeemCodes(redeemSearch);
  };

  const toggleRow = (key: SelectionKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === flatRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(flatRows.map((r) => r.key)));
    }
  };

  const handleFulfill = async () => {
    if (!redeemCodeId) {
      alert('請選擇兌換碼');
      return;
    }
    const fulfillItems = Array.from(selected).map((key) => {
      const [userId, tierId] = key.split(':');
      return { userId, tierId };
    });
    if (!fulfillItems.length) return;

    setSaving(true);
    try {
      const res = await axios.post('/tiers/long-term-supporters/fulfill', {
        items: fulfillItems,
        redeemCodeId,
        sendEmail,
        note,
      });
      const msg = res.data?.message || '派發完成';
      const emailsSent = res.data?.data?.emailsSent ?? 0;
      const emailErrors = res.data?.data?.emailErrors ?? 0;
      alert(
        [
          msg,
          sendEmail ? `郵件成功 ${emailsSent}，失敗 ${emailErrors}` : '未發送郵件',
        ].join('\n')
      );
      setShowFulfillModal(false);
      await fetchList();
    } catch (err: any) {
      alert(err.response?.data?.message || '派發失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <GiftIcon className="w-6 h-6 text-primary-600" />
            長期支持用戶列表
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            依註冊周年窗口計算消費；已達檔位且尚未派發者會出現於此，處理後即從列表移除。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchList()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-4 h-4" />
            重新整理
          </button>
          <button
            type="button"
            onClick={() => void openFulfill()}
            disabled={!selected.size}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            <CheckIcon className="w-4 h-4" />
            派發獎勵（{selected.size}）
          </button>
        </div>
      </motion.div>

      {!tiersConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {emptyMessage || '請先於「Tier 管理」設定檔位門檻（minAnnualSpent），再回來處理長期支持獎勵。'}
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">載入中…</div>
        ) : !tiersConfigured ? (
          <div className="p-8 text-center text-gray-500 text-sm">尚無 Tier 設定</div>
        ) : flatRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            目前沒有待派發的長期支持用戶
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === flatRows.length}
                      onChange={toggleAll}
                      aria-label="全選"
                    />
                  </th>
                  <th className="px-3 py-3 font-medium">用戶</th>
                  <th className="px-3 py-3 font-medium">註冊日</th>
                  <th className="px-3 py-3 font-medium">本年度窗口</th>
                  <th className="px-3 py-3 font-medium text-right">本年度消費</th>
                  <th className="px-3 py-3 font-medium">已達檔位</th>
                  <th className="px-3 py-3 font-medium">未派檔位</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {flatRows.map(({ key, item, unmetTier }) => (
                  <tr key={key} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggleRow(key)}
                        aria-label={`選擇 ${item.user.name} ${unmetTier.name}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900">{item.user.name}</div>
                      <div className="text-xs text-gray-500">{item.user.email}</div>
                      {item.user.phone ? (
                        <div className="text-xs text-gray-400">{item.user.phone}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-gray-700">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-3 text-gray-700">
                      <div>{formatWindow(item.windowStart, item.windowEnd)}</div>
                      <div className="text-xs text-gray-400">第 {item.yearIndex} 年</div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-gray-900">
                      {item.annualSpent.toLocaleString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.reachedTiers.map((t) => (
                          <span
                            key={t._id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                            style={t.color ? { borderLeft: `3px solid ${t.color}` } : undefined}
                          >
                            {t.name}（{t.minAnnualSpent.toLocaleString()}）
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-800"
                        style={unmetTier.color ? { borderLeft: `3px solid ${unmetTier.color}` } : undefined}
                      >
                        {unmetTier.name}（{unmetTier.minAnnualSpent.toLocaleString()}）
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showFulfillModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">派發長期支持獎勵</h3>
                <p className="text-sm text-gray-500">
                  已選 {selected.size} 筆（用戶 × 檔位）。將放入兌換券口袋
                  {sendEmail ? '並發送感謝信' : ''}。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFulfillModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">搜尋兌換碼</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={redeemSearch}
                    onChange={(e) => setRedeemSearch(e.target.value)}
                    placeholder="名稱 / code…"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void loadRedeemCodes(redeemSearch)}
                    className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    搜尋
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">選擇兌換碼模板</label>
                {redeemLoading ? (
                  <p className="text-sm text-gray-500">載入兌換碼…</p>
                ) : redeemCodes.length === 0 ? (
                  <p className="text-sm text-amber-700">找不到可用兌換碼，請先至兌換碼管理建立。</p>
                ) : (
                  <select
                    value={redeemCodeId}
                    onChange={(e) => setRedeemCodeId(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— 請選擇 —</option>
                    {redeemCodes.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}（{c.code}）
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">備註（可選）</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="寫入口袋與派發紀錄"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                發送感謝郵件（告知優惠券已在口袋，預約時可使用）
              </label>

              <button
                type="button"
                onClick={() => void handleFulfill()}
                disabled={saving || !redeemCodeId}
                className="w-full py-2.5 bg-primary-600 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? '派發中…' : `確認派發 ${selected.size} 筆`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LongTermSupporters;
