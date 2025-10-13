import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMaintenance } from '../../hooks/useMaintenance';
import { 
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const MaintenanceControl: React.FC = () => {
  const { status, loading, error, toggleMaintenance, setMessage } = useMaintenance();
  const [customMessage, setCustomMessage] = useState('');
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleToggleMaintenance = async () => {
    try {
      setActionLoading(true);
      const message = customMessage.trim() || undefined;
      await toggleMaintenance(message);
      setCustomMessage('');
    } catch (error) {
      console.error('切換維護模式失敗:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetMessage = async () => {
    if (!customMessage.trim()) return;
    
    try {
      setActionLoading(true);
      await setMessage(customMessage.trim());
      setIsEditingMessage(false);
      setCustomMessage('');
    } catch (error) {
      console.error('設置維護訊息失敗:', error);
    } finally {
      setActionLoading(false);
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

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
          <WrenchScrewdriverIcon className="w-6 h-6 text-yellow-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">系統維護控制</h2>
          <p className="text-sm text-gray-500">管理系統維護模式和維護訊息</p>
        </div>
      </div>

      {/* 當前狀態 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">當前狀態</h3>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            status?.maintenanceMode 
              ? 'bg-red-100 text-red-800' 
              : 'bg-green-100 text-green-800'
          }`}>
            {status?.maintenanceMode ? (
              <>
                <ExclamationTriangleIcon className="w-4 h-4 mr-1" />
                維護中
              </>
            ) : (
              <>
                <CheckCircleIcon className="w-4 h-4 mr-1" />
                正常運行
              </>
            )}
          </div>
        </div>

        {/* 維護訊息 */}
        {status?.maintenanceMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-800">維護訊息</p>
                <p className="text-sm text-yellow-700 mt-1">
                  {status.message || '系統維護中，請稍後再試。'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 時間戳 */}
        {status?.timestamp && (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <ClockIcon className="w-4 h-4" />
            <span>最後更新: {formatTimestamp(status.timestamp)}</span>
          </div>
        )}

        {/* 錯誤訊息 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* 維護訊息設置 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">維護訊息設置</h3>
        
        {!isEditingMessage ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              當前訊息: <span className="font-medium">{status?.message || '系統維護中，請稍後再試。'}</span>
            </p>
            <button
              onClick={() => setIsEditingMessage(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              編輯訊息
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="customMessage" className="block text-sm font-medium text-gray-700 mb-2">
                維護訊息
              </label>
              <textarea
                id="customMessage"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="輸入維護訊息..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {customMessage.length}/200 字符
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleSetMessage}
                disabled={!customMessage.trim() || actionLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? '保存中...' : '保存訊息'}
              </button>
              
              <button
                onClick={() => {
                  setIsEditingMessage(false);
                  setCustomMessage('');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 維護模式控制 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">維護模式控制</h3>
        
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">
              {status?.maintenanceMode ? '關閉維護模式' : '開啟維護模式'}
            </h4>
            <p className="text-sm text-gray-600 mb-4">
              {status?.maintenanceMode 
                ? '關閉維護模式後，網站將恢復正常訪問。'
                : '開啟維護模式後，所有用戶將被重定向到維護頁面。'
              }
            </p>
            
            {!status?.maintenanceMode && (
              <div className="mb-4">
                <label htmlFor="toggleMessage" className="block text-sm font-medium text-gray-700 mb-2">
                  自定義維護訊息（可選）
                </label>
                <input
                  id="toggleMessage"
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="輸入維護訊息..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  maxLength={200}
                />
              </div>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleToggleMaintenance}
              disabled={loading || actionLoading}
              className={`w-full inline-flex items-center justify-center px-4 py-3 border border-transparent rounded-md text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                status?.maintenanceMode 
                  ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
              }`}
            >
              {loading || actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  處理中...
                </>
              ) : (
                <>
                  {status?.maintenanceMode ? (
                    <>
                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                      關閉維護模式
                    </>
                  ) : (
                    <>
                      <ExclamationTriangleIcon className="w-4 h-4 mr-2" />
                      開啟維護模式
                    </>
                  )}
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceControl;
