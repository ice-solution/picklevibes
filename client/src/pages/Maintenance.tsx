import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  WrenchScrewdriverIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import apiConfig from '../config/api';

interface MaintenanceStatus {
  maintenanceMode: boolean;
  message: string;
  timestamp: string;
}

const Maintenance: React.FC = () => {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkMaintenanceStatus();
    
    // 每30秒檢查一次維護狀態
    const interval = setInterval(checkMaintenanceStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkMaintenanceStatus = async () => {
    try {
      const response = await axios.get(`${apiConfig.API_BASE_URL}/maintenance/status`);
      setStatus(response.data);
    } catch (error) {
      console.error('檢查維護狀態失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">檢查系統狀態中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* 圖標 */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <WrenchScrewdriverIcon className="w-10 h-10 text-yellow-600" />
            </div>
          </motion.div>

          {/* 標題 */}
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold text-gray-900 mb-4"
          >
            系統維護中
          </motion.h1>

          {/* 訊息 */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 mb-6 leading-relaxed"
          >
            {status?.message || '系統正在進行維護，請稍後再試。我們將盡快恢復服務。'}
          </motion.p>

          {/* 狀態信息 */}
          {status && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-50 rounded-lg p-4 mb-6"
            >
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-2">
                <ClockIcon className="w-4 h-4" />
                <span>最後更新</span>
              </div>
              <p className="text-xs text-gray-400">
                {formatTimestamp(status.timestamp)}
              </p>
            </motion.div>
          )}

          {/* 重新檢查按鈕 */}
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            onClick={checkMaintenanceStatus}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-primary-700 transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>重新檢查狀態</span>
          </motion.button>

          {/* 自動刷新提示 */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs text-gray-400 mt-4"
          >
            系統會每 30 秒自動檢查維護狀態
          </motion.p>
        </div>

        {/* 頁腳 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-gray-500">
            如有緊急問題，請聯繫我們
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © 2024 PickleVibes. All rights reserved.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Maintenance;
