import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useLockedStoreId, useOptionalStoreAdmin } from '../../contexts/StoreAdminContext';

interface StoreMember {
  _id: string;
  name: string;
  email: string;
  phone: string;
  membershipLevel: 'basic' | 'vip';
  isActive: boolean;
  createdAt: string;
  balance: number;
  platformBalance?: number;
  availableForBooking?: number;
  totalRecharged: number;
  totalSpent: number;
}

interface RechargeRecord {
  _id: string;
  points: number;
  amount: number;
  status: string;
  pointsAdded?: boolean;
  pointsDeducted?: boolean;
  description?: string;
  createdAt: string;
  store?: { name?: string; slug?: string } | null;
  payment?: { method?: string; status?: string; paidAt?: string };
}

const StoreMemberManagement: React.FC = () => {
  const storeAdmin = useOptionalStoreAdmin();
  const lockedStoreId = useLockedStoreId();
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [pageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'email' | 'phone'>('name');

  const [selectedMember, setSelectedMember] = useState<StoreMember | null>(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (storeAdmin && !lockedStoreId) return;
    void fetchMembers();
  }, [currentPage, debouncedSearch, searchType, lockedStoreId, storeAdmin?.storeSlug]);

  const fetchMembers = async () => {
    if (!lockedStoreId) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        store: lockedStoreId,
      });
      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim());
        params.append('searchType', searchType);
      }
      const res = await axios.get(`/users?${params.toString()}`);
      setMembers(res.data.users || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalMembers(res.data.pagination?.total || 0);
    } catch (error) {
      console.error('獲取會員列表失敗:', error);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRechargeRecords = async (member: StoreMember) => {
    if (!lockedStoreId) return;
    try {
      setRecordsLoading(true);
      const res = await axios.get(`/users/${member._id}/recharge-records`, {
        params: { store: lockedStoreId, limit: 50 },
      });
      setRechargeRecords(res.data.rechargeRecords || []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '無法載入充值記錄');
      setRechargeRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleRecharge = async () => {
    if (!selectedMember || !lockedStoreId) return;
    const pts = parseInt(points, 10);
    if (!pts || pts < 1 || !reason.trim()) {
      alert('請填寫有效的積分與原因');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`/users/${selectedMember._id}/manual-recharge`, {
        points: pts,
        reason: reason.trim(),
        storeId: lockedStoreId,
      });
      setShowRechargeModal(false);
      setPoints('');
      setReason('');
      await fetchMembers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '充值失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeduct = async () => {
    if (!selectedMember || !lockedStoreId) return;
    const pts = parseInt(points, 10);
    if (!pts || pts < 1 || !reason.trim()) {
      alert('請填寫有效的積分與原因');
      return;
    }
    try {
      setSubmitting(true);
      await axios.post(`/users/${selectedMember._id}/manual-deduct`, {
        points: pts,
        reason: reason.trim(),
        storeId: lockedStoreId,
      });
      setShowDeductModal(false);
      setPoints('');
      setReason('');
      await fetchMembers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '扣除失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const openRecharge = (member: StoreMember) => {
    setSelectedMember(member);
    setPoints('');
    setReason('');
    setShowRechargeModal(true);
  };

  const openDeduct = (member: StoreMember) => {
    setSelectedMember(member);
    setPoints('');
    setReason('');
    setShowDeductModal(true);
  };

  const openRecords = async (member: StoreMember) => {
    setSelectedMember(member);
    setShowRecordsModal(true);
    await fetchRechargeRecords(member);
  };

  const storeName = storeAdmin?.store?.branding?.displayName || storeAdmin?.store?.name || '本店';

  const methodLabel = (method?: string) => {
    if (method === 'wonder') return 'Wonder';
    if (method === 'stripe') return 'Stripe';
    if (method === 'manual') return '手動';
    return method || '—';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-6 h-6" />
            店鋪會員
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            僅顯示曾在 {storeName} 預約的會員 · 共 {totalMembers} 人
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="搜索會員..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={searchType}
          onChange={(e) => {
            setSearchType(e.target.value as 'name' | 'email' | 'phone');
            setCurrentPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="name">姓名</option>
          <option value="email">電郵</option>
          <option value="phone">電話</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border">
          暫無符合條件的會員（需曾於本店預約）
        </div>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">會員</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">聯絡</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">本店餘額</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">累計充值</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => (
                  <tr key={member._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-xs text-gray-500">
                        {member.membershipLevel === 'vip' ? 'VIP' : '一般'} ·{' '}
                        {member.isActive ? '啟用' : '停用'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{member.email}</div>
                      <div>{member.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold text-gray-900">{member.balance} 分</div>
                      {typeof member.platformBalance === 'number' && (
                        <div className="text-xs text-gray-400">平台 {member.platformBalance}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{member.totalRecharged} 分</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => void openRecords(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-pickcourt-navy bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                          <ClipboardDocumentListIcon className="w-4 h-4" />
                          記錄
                        </button>
                        <button
                          type="button"
                          onClick={() => openRecharge(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100"
                        >
                          <PlusIcon className="w-4 h-4" />
                          充值
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeduct(member)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
                        >
                          <MinusIcon className="w-4 h-4" />
                          扣除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-sm text-gray-600">
                第 {currentPage} / {totalPages} 頁
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-2 rounded-lg border disabled:opacity-40"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-2 rounded-lg border disabled:opacity-40"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(showRechargeModal || showDeductModal) && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {showRechargeModal ? '手動充值' : '手動扣除'} · {selectedMember.name}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowRechargeModal(false);
                  setShowDeductModal(false);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              本店餘額：{selectedMember.balance} 分
              {typeof selectedMember.platformBalance === 'number' && (
                <> · 平台：{selectedMember.platformBalance} 分</>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">積分</label>
                <input
                  type="number"
                  min={1}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">原因</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="請填寫操作原因"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRechargeModal(false);
                    setShowDeductModal(false);
                  }}
                  className="flex-1 py-2 border rounded-lg"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={showRechargeModal ? handleRecharge : handleDeduct}
                  className={`flex-1 py-2 rounded-lg text-white font-medium disabled:opacity-50 ${
                    showRechargeModal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {submitting ? '處理中...' : '確認'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showRecordsModal && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedMember.name} 的充值記錄</h3>
                <p className="text-sm text-gray-500 mt-0.5">本店充值 + PickCourt 平台充值</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordsModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto p-4 flex-1">
              {recordsLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
                </div>
              ) : rechargeRecords.length === 0 ? (
                <p className="text-center text-gray-500 py-12">暫無充值記錄</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">時間</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">類型</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">積分</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">金額</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">狀態</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">支付</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">說明</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rechargeRecords.map((record) => (
                      <tr key={record._id}>
                        <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(record.createdAt).toLocaleString('zh-TW')}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {record.store?.name ? (
                            <span className="text-gray-800">{record.store.name}</span>
                          ) : (
                            <span className="text-pickcourt-navy font-medium">PickCourt 平台</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-sm text-right font-semibold ${
                            record.pointsDeducted ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {record.pointsDeducted ? '-' : '+'}
                          {record.points}
                        </td>
                        <td className="px-3 py-2 text-sm text-right">HK${record.amount}</td>
                        <td className="px-3 py-2 text-sm">
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                              record.status === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : record.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : record.status === 'failed'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {record.status === 'completed'
                              ? '已完成'
                              : record.status === 'pending'
                                ? '待處理'
                                : record.status === 'failed'
                                  ? '失敗'
                                  : '已取消'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600">
                          {methodLabel(record.payment?.method)}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500 max-w-[12rem] truncate">
                          {record.description || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StoreMemberManagement;
