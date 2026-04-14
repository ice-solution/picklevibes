import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

function padHourFromTimeInput(value: string): string {
  if (!value) return '';
  const [h, m] = value.split(':');
  return `${String(h).padStart(2, '0')}:${m || '00'}`;
}

const CoachSchoolRequest: React.FC = () => {
  const [requestDate, setRequestDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDate || !startTime || !endTime) {
      alert('請填寫日期與時間');
      return;
    }
    const st = padHourFromTimeInput(startTime);
    const et = padHourFromTimeInput(endTime);
    const ok = window.confirm(
      `確認送出要請？\n日期：${requestDate}\n時間：${st} – ${et}\n\n送出後會發電郵通知管理員，並將前往後台頁面。`
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await api.post('/coach-schedule-requests', {
        requestDate: `${requestDate}T12:00:00`,
        startTime: st,
        endTime: et,
        message: message.trim() || undefined
      });
      const url = res.data?.redirectUrl;
      alert(res.data?.message || '已送出');
      if (url) {
        window.location.assign(url);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || '送出失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <Link
          to="/coach-calendar"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          返回教練日程
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <ChatBubbleLeftRightIcon className="w-10 h-10 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">教練學校要請</h1>
          </div>
          <p className="text-gray-600 text-sm mb-6">
            填寫希望使用的日期與時段（開始–結束），確認後系統會發電郵至管理員，並可從後台批核後將時段寫入預約日曆。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
              <input
                type="date"
                required
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                <input
                  type="time"
                  step={3600}
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結束時間</label>
                <input
                  type="time"
                  step={3600}
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">時間請與場地預約一致（整點為佳）。若需跨午夜結束，請與管理員另議。</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">備註（選填）</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="例如：課程內容、人數等"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? '送出中…' : '確認並發送'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default CoachSchoolRequest;
