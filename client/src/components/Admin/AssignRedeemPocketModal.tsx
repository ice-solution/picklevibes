import React, { useState } from 'react';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import UserAutocomplete from '../Common/UserAutocomplete';

interface AssignUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

interface AssignRedeemPocketModalProps {
  redeemCode: {
    _id: string;
    code: string;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

const AssignRedeemPocketModal: React.FC<AssignRedeemPocketModalProps> = ({
  redeemCode,
  isOpen,
  onClose,
}) => {
  const [selectedUsers, setSelectedUsers] = useState<AssignUser[]>([]);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [holders, setHolders] = useState<any[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        setLoadingHolders(true);
        const res = await axios.get(`/redeem/admin/${redeemCode._id}/pocket-holders`);
        setHolders(res.data.holders || []);
      } catch {
        setHolders([]);
      } finally {
        setLoadingHolders(false);
      }
    })();
  }, [isOpen, redeemCode._id]);

  if (!isOpen) return null;

  const addUser = (user: AssignUser | null) => {
    if (!user) return;
    if (selectedUsers.some((u) => u._id === user._id)) return;
    setSelectedUsers((prev) => [...prev, user]);
    setAutocompleteKey((k) => k + 1);
  };

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== id));
  };

  const handleAssign = async () => {
    if (!selectedUsers.length) {
      alert('請至少選擇一位用戶');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/redeem/admin/assign', {
        redeemCodeId: redeemCode._id,
        userIds: selectedUsers.map((u) => u._id),
        note,
      });
      const names = selectedUsers.map((u) => u.name).join('、');
      alert(
        [
          res.data.message || '派發成功',
          `已放入以下用戶的「我的兌換券」口袋：${names}`,
          '用戶可於導覽選單 → 我的兌換券 查看。',
        ].join('\n')
      );
      setSelectedUsers([]);
      setNote('');
      const holdersRes = await axios.get(`/redeem/admin/${redeemCode._id}/pocket-holders`);
      setHolders(holdersRes.data.holders || []);
    } catch (err: any) {
      alert(err.response?.data?.message || '派發失敗');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">派發到用戶口袋</h3>
            <p className="text-sm text-gray-500">
              {redeemCode.name}（{redeemCode.code}）
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3 mb-4">
          <label className="block text-sm font-medium text-gray-700">搜尋用戶加入</label>
          <UserAutocomplete
            key={autocompleteKey}
            value=""
            onChange={addUser}
            placeholder="手機 / Email / 名字…"
          />
          {selectedUsers.length > 0 && (
            <ul className="space-y-1">
              {selectedUsers.map((u) => (
                <li
                  key={u._id}
                  className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded"
                >
                  <span>
                    {u.name} · {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </span>
                  <button type="button" onClick={() => removeUser(u._id)} className="text-red-600 text-xs">
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備註（可選）"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || !selectedUsers.length}
            className="w-full py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? '派發中…' : `派發給 ${selectedUsers.length} 位用戶`}
          </button>
        </div>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">目前口袋持有者</h4>
          {loadingHolders ? (
            <p className="text-sm text-gray-500">載入中…</p>
          ) : holders.length === 0 ? (
            <p className="text-sm text-gray-500">尚無人持有</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {holders.map((h) => (
                <li key={h._id} className="flex justify-between border-b pb-1">
                  <span>
                    {h.user?.name || '—'} · {h.user?.email || ''}
                  </span>
                  <span className="text-xs text-gray-500">
                    {h.status === 'used' ? '已用' : '袋內'} ·{' '}
                    {h.source === 'admin_assign' ? '派發' : '自領'}
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

export default AssignRedeemPocketModal;
