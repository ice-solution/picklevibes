import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AssignUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface RedeemCodeOption {
  _id: string;
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  isActive: boolean;
}

interface PocketItem {
  _id: string;
  status: string;
  source?: string;
  assignedAt?: string;
  redeemCode?: {
    code?: string;
    name?: string;
    type?: 'fixed' | 'percentage';
    value?: number;
  } | null;
}

interface AssignRedeemToUserModalProps {
  user: AssignUser;
  isOpen: boolean;
  onClose: () => void;
}

function formatDiscount(type?: string, value?: number) {
  if (type === 'fixed') return `HK$${value ?? 0}`;
  if (type === 'percentage') return `${value ?? 0}%`;
  return '';
}

const AssignRedeemToUserModal: React.FC<AssignRedeemToUserModalProps> = ({
  user,
  isOpen,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [loadingPocket, setLoadingPocket] = useState(false);
  const [codeOptions, setCodeOptions] = useState<RedeemCodeOption[]>([]);
  const [selectedCodeId, setSelectedCodeId] = useState('');
  const [pocketItems, setPocketItems] = useState<PocketItem[]>([]);

  const loadPocket = async () => {
    try {
      setLoadingPocket(true);
      const res = await axios.get(`/redeem/admin/user-pocket/${user._id}?status=available`);
      setPocketItems(res.data.items || []);
    } catch {
      setPocketItems([]);
    } finally {
      setLoadingPocket(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setCodeInput('');
    setNote('');
    setSelectedCodeId('');
    void loadPocket();
  }, [isOpen, user._id]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(async () => {
      try {
        setLoadingCodes(true);
        const params = new URLSearchParams({
          status: 'active',
          limit: '20',
          page: '1',
        });
        if (search.trim()) params.set('q', search.trim());
        const res = await axios.get(`/redeem/admin/list?${params.toString()}`);
        setCodeOptions(res.data.redeemCodes || []);
      } catch {
        setCodeOptions([]);
      } finally {
        setLoadingCodes(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isOpen, search]);

  if (!isOpen) return null;

  const handleAssignSelected = async () => {
    if (!selectedCodeId) {
      alert('請先選擇要派發的兌換碼');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/redeem/admin/assign', {
        redeemCodeId: selectedCodeId,
        userIds: [user._id],
        note,
      });
      alert(res.data.message || '派發成功');
      setNote('');
      setSelectedCodeId('');
      await loadPocket();
    } catch (err: any) {
      alert(err.response?.data?.message || '派發失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleClaimByCode = async () => {
    const code = codeInput.trim();
    if (!code) {
      alert('請輸入兌換碼');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/redeem/admin/claim-for-user', {
        userId: user._id,
        code,
      });
      alert(res.data.message || '已放入用戶口袋');
      setCodeInput('');
      await loadPocket();
    } catch (err: any) {
      alert(err.response?.data?.message || '入袋失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">派發兌換券</h3>
            <p className="text-sm text-gray-500">
              {user.name} · {user.email}
              {user.phone ? ` · ${user.phone}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜尋兌換碼</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="名稱 / 代碼…"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
              {loadingCodes ? (
                <p className="text-sm text-gray-500 p-3">搜尋中…</p>
              ) : codeOptions.length === 0 ? (
                <p className="text-sm text-gray-500 p-3">找不到有效兌換碼</p>
              ) : (
                codeOptions.map((code) => (
                  <button
                    key={code._id}
                    type="button"
                    onClick={() => setSelectedCodeId(code._id)}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50 ${
                      selectedCodeId === code._id ? 'bg-amber-50 text-amber-900' : ''
                    }`}
                  >
                    <div className="font-medium">{code.name}</div>
                    <div className="text-xs text-gray-500">
                      {code.code} · {formatDiscount(code.type, code.value)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（可選）"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={handleAssignSelected}
            disabled={saving || !selectedCodeId}
            className="w-full py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? '派發中…' : '派發所選兌換碼到用戶口袋'}
          </button>

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">或直接輸入兌換碼</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="例如 PROMO2026"
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleClaimByCode}
                disabled={saving || !codeInput.trim()}
                className="px-3 py-2 text-sm border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 disabled:opacity-50"
              >
                入袋
              </button>
            </div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">用戶口袋（可用）</h4>
          {loadingPocket ? (
            <p className="text-sm text-gray-500">載入中…</p>
          ) : pocketItems.length === 0 ? (
            <p className="text-sm text-gray-500">暫無可用兌換券</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {pocketItems.map((item) => (
                <li key={item._id} className="flex justify-between border-b pb-1">
                  <span>
                    {item.redeemCode?.name || '—'} · {item.redeemCode?.code || ''}
                  </span>
                  <span className="text-xs text-gray-500">
                    {item.source === 'admin_assign' ? '後台派發' : '自領'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignRedeemToUserModal;
