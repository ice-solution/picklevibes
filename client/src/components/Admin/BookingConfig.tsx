import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDaysIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

interface MaxAdvanceDaysByRole {
  user?: number;
  coach?: number;
  admin?: number;
}

const ROLE_LABELS: Record<string, string> = {
  user: '一般用戶',
  coach: '教練',
  admin: '管理員'
};

const BookingConfig: React.FC = () => {
  const [config, setConfig] = useState<MaxAdvanceDaysByRole>({ user: 7, coach: 14, admin: 30 });
  const [formValues, setFormValues] = useState<MaxAdvanceDaysByRole>({ user: 7, coach: 14, admin: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/config/booking');
      const data = res.data?.data?.maxAdvanceDaysByRole || { user: 7, coach: 14, admin: 30 };
      setConfig(data);
      setFormValues({
        user: data.user ?? 7,
        coach: data.coach ?? 14,
        admin: data.admin ?? 30
      });
    } catch (error) {
      console.error('載入預約設定失敗:', error);
      setMessage({ type: 'error', text: '載入預約設定失敗' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (role: keyof MaxAdvanceDaysByRole, value: number) => {
    const num = Math.min(365, Math.max(1, value));
    setFormValues((prev) => ({ ...prev, [role]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      setSaving(true);
      await api.put('/config/booking', { maxAdvanceDaysByRole: formValues });
      setConfig(formValues);
      setMessage({ type: 'success', text: '預約設定已更新' });
    } catch (error: any) {
      console.error('更新預約設定失敗:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || '更新預約設定失敗'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">載入中...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Cog6ToothIcon className="w-6 h-6 text-primary-600" />
          預約設定
        </h2>
        <p className="text-gray-600 mt-1">依角色設定可預約的天數（由今天起計多少天內可預約）</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {message && (
          <div
            className={`p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          {(Object.keys(ROLE_LABELS) as Array<keyof MaxAdvanceDaysByRole>).map((role) => (
            <div key={role} className="flex items-center gap-4">
              <label className="w-28 text-sm font-medium text-gray-700">{ROLE_LABELS[role]}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={formValues[role] ?? 7}
                  onChange={(e) => handleChange(role, parseInt(e.target.value, 10) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <span className="text-gray-500">天</span>
              </div>
              <span className="text-gray-400 text-sm">
                最多可預約今天起 {formValues[role] ?? 7} 天內的場地
              </span>
            </div>
          ))}
        </div>

        <div className="pt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <CalendarDaysIcon className="w-5 h-5" />
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default BookingConfig;
