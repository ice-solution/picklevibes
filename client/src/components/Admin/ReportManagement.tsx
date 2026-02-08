import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { DocumentArrowDownIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const ReportManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleExportUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/users-xlsx', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `用戶報告_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error: any) {
      console.error('導出失敗:', error);
      alert(error.response?.data?.message || '導出失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">報告生成</h2>
        <p className="text-gray-600">導出各類報表（XLSX）。更多報告類型之後可在此添加。</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserGroupIcon className="w-5 h-5 text-primary-600" />
            用戶報告
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            導出全部用戶資料、消費總額（積分）、充值總額與充值筆數
          </p>
        </div>
        <div className="p-6">
          <button
            type="button"
            onClick={handleExportUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DocumentArrowDownIcon className="w-5 h-5" />
            {loading ? '生成中...' : '下載用戶報告 (XLSX)'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ReportManagement;
