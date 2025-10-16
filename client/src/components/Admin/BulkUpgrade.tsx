import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  UserGroupIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface UserStats {
  totalUsers: number;
  basicUsers: number;
  vipUsers: number;
  adminUsers: number;
}

interface SoonExpiredVip {
  name: string;
  email: string;
  expiryDate: string;
  daysLeft: number;
}

interface UpgradeResult {
  message: string;
  upgraded: number;
  errors: number;
  vipExpiryDate: string;
  errorDetails: Array<{
    userId: string;
    email: string;
    error: string;
  }>;
}

const BulkUpgrade: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [soonExpiredVips, setSoonExpiredVips] = useState<SoonExpiredVip[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  const [vipDays, setVipDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  // 獲取用戶統計
  const fetchStats = async () => {
    try {
      const response = await api.get('/bulk-upgrade/status');
      setStats(response.data.statistics);
      setSoonExpiredVips(response.data.soonExpiredVips);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取統計數據失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 批量升級用戶
  const handleBulkUpgrade = async () => {
    if (!window.confirm(`確定要將所有普通用戶升級為 VIP 會員嗎？\nVIP 期限：${vipDays} 天`)) {
      return;
    }

    setUpgrading(true);
    setError(null);
    setUpgradeResult(null);

    try {
      const response = await api.post('/bulk-upgrade/vip', {
        days: vipDays
      });
      
      setUpgradeResult(response.data);
      
      // 重新獲取統計數據
      await fetchStats();
      
    } catch (err: any) {
      setError(err.response?.data?.message || '批量升級失敗');
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-2">載入中...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">批量用戶升級</h2>
        <p className="text-gray-600">管理用戶會員等級的批量操作</p>
      </div>

      {/* 用戶統計 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">總用戶數</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-gray-400 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">B</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">普通會員</p>
                <p className="text-2xl font-bold text-gray-900">{stats.basicUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">V</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">VIP 會員</p>
                <p className="text-2xl font-bold text-gray-900">{stats.vipUsers}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">A</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">管理員</p>
                <p className="text-2xl font-bold text-gray-900">{stats.adminUsers}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量升級操作 */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">批量升級操作</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              VIP 會員期限（天數）
            </label>
            <select
              value={vipDays}
              onChange={(e) => setVipDays(Number(e.target.value))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value={7}>7 天</option>
              <option value={15}>15 天</option>
              <option value={30}>30 天</option>
              <option value={60}>60 天</option>
              <option value={90}>90 天</option>
              <option value={180}>180 天</option>
            </select>
          </div>

          <button
            onClick={handleBulkUpgrade}
            disabled={upgrading || !stats || stats.basicUsers === 0}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-75 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {upgrading ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                升級中...
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                升級所有普通用戶為 VIP ({stats?.basicUsers || 0} 人)
              </>
            )}
          </button>

          {stats && stats.basicUsers === 0 && (
            <p className="text-sm text-gray-500">沒有需要升級的普通用戶</p>
          )}
        </div>
      </div>

      {/* 升級結果 */}
      {upgradeResult && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">升級結果</h3>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                <span className="text-green-600 font-medium">成功升級: {upgradeResult.upgraded} 人</span>
              </div>
              {upgradeResult.errors > 0 && (
                <div className="flex items-center">
                  <XCircleIcon className="h-6 w-6 text-red-600 mr-2" />
                  <span className="text-red-600 font-medium">失敗: {upgradeResult.errors} 人</span>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">
              <p>VIP 到期日期: {new Date(upgradeResult.vipExpiryDate).toLocaleDateString('zh-TW')}</p>
            </div>

            {upgradeResult.errorDetails.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">錯誤詳情:</h4>
                <div className="space-y-2">
                  {upgradeResult.errorDetails.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error.email}: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 即將過期的 VIP 會員 */}
      {soonExpiredVips.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500 mr-2" />
            即將過期的 VIP 會員
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    姓名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    郵箱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    到期日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    剩餘天數
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {soonExpiredVips.map((vip, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {vip.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vip.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(vip.expiryDate).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vip.daysLeft <= 3 
                          ? 'bg-red-100 text-red-800' 
                          : vip.daysLeft <= 7 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                      }`}>
                        {vip.daysLeft} 天
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <XCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkUpgrade;
