import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { useBooking } from '../../contexts/BookingContext';
import { ChatBubbleLeftRightIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface CoachInfo {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface RequestRow {
  _id: string;
  coach: CoachInfo;
  requestDate: string;
  startTime: string;
  endTime: string;
  message?: string;
  status: 'pending' | 'approved' | 'rejected';
  court?: { _id: string; name: string; number?: number } | null;
  booking?: { _id: string } | null;
  rejectionReason?: string;
  createdAt: string;
}

const CoachScheduleRequestManagement: React.FC = () => {
  const { courts, fetchCourts } = useBooking();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending');
  const [approveId, setApproveId] = useState<string | null>(null);
  const [courtPick, setCourtPick] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter ? { status: filter } : {};
      const res = await api.get('/coach-schedule-requests', { params });
      setRequests(res.data?.requests || []);
    } catch (e) {
      console.error(e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (d: string) => {
    const x = new Date(d);
    return Number.isNaN(x.getTime())
      ? d
      : x.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const handleApprove = async () => {
    if (!approveId || !courtPick) return;
    setSubmitting(true);
    try {
      await api.post(`/coach-schedule-requests/${approveId}/approve`, { court: courtPick });
      setApproveId(null);
      setCourtPick('');
      await load();
      alert('已批核並已建立預約');
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || '批核失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setSubmitting(true);
    try {
      await api.post(`/coach-schedule-requests/${rejectId}/reject`, {
        reason: rejectReason || undefined
      });
      setRejectId(null);
      setRejectReason('');
      await load();
    } catch (err: any) {
      alert(err.response?.data?.message || '操作失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCourts = (courts || []).filter((c: { isActive?: boolean }) => c.isActive !== false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary-600" />
        <h2 className="text-xl font-semibold text-gray-900">教練學校要請</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">全部狀態</option>
          <option value="pending">待處理</option>
          <option value="approved">已批核</option>
          <option value="rejected">已拒絕</option>
        </select>
      </div>
      <p className="text-sm text-gray-600">
        教練提交要請後會發電郵至管理員信箱；批核時請選擇場地，系統會以該教練帳戶建立預約並顯示於預約日曆。
      </p>

      {loading ? (
        <p className="text-gray-500">載入中…</p>
      ) : requests.length === 0 ? (
        <p className="text-gray-500">暫無紀錄</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">教練</th>
                <th className="px-3 py-2 text-left">日期</th>
                <th className="px-3 py-2 text-left">時間</th>
                <th className="px-3 py-2 text-left">備註</th>
                <th className="px-3 py-2 text-left">狀態</th>
                <th className="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {requests.map((r) => (
                <tr key={r._id}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{r.coach?.name || '—'}</div>
                    <div className="text-xs text-gray-500">{r.coach?.email}</div>
                  </td>
                  <td className="px-3 py-2">{formatDate(r.requestDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.startTime} – {r.endTime}
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate" title={r.message}>
                    {r.message || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'pending' && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">待處理</span>
                    )}
                    {r.status === 'approved' && (
                      <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded">
                        已批核 {r.court?.name ? `· ${r.court.name}` : ''}
                      </span>
                    )}
                    {r.status === 'rejected' && (
                      <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">已拒絕</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setApproveId(r._id);
                            setCourtPick(activeCourts[0]?._id || '');
                          }}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800"
                        >
                          <CheckCircleIcon className="w-5 h-5" />
                          批核
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectId(r._id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                        >
                          <XCircleIcon className="w-5 h-5" />
                          拒絕
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">批核要請</h3>
            <p className="text-sm text-gray-600">選擇要佔用之場地後確認，將以教練帳戶建立預約（不扣積分）。</p>
            <label className="block text-sm font-medium text-gray-700">場地</label>
            <select
              value={courtPick}
              onChange={(e) => setCourtPick(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">請選擇</option>
              {activeCourts.map((c: { _id: string; name: string }) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 border rounded-lg"
                onClick={() => {
                  setApproveId(null);
                  setCourtPick('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting || !courtPick}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50"
                onClick={handleApprove}
              >
                {submitting ? '處理中…' : '確認批核'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">拒絕要請</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="原因（選填）"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-gray-700 border rounded-lg"
                onClick={() => {
                  setRejectId(null);
                  setRejectReason('');
                }}
              >
                取消
              </button>
              <button
                type="button"
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg"
                onClick={handleReject}
              >
                確認拒絕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachScheduleRequestManagement;
