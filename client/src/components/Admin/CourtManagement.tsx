import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  MapPinIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  PowerIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface Court {
  _id: string;
  name: string;
  number: string;
  type: string;
  description: string;
  capacity: number;
  isActive: boolean;
  pricing: {
    offPeak: number;
    peakHour: number;
    owlTime: number;
  };
  amenities: string[];
  operatingHours: {
    [key: string]: string;
  };
  createdAt: string;
  updatedAt: string;
}

const CourtManagement: React.FC = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchCourts();
  }, []);

  const fetchCourts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/courts?all=true');
      setCourts(response.data.courts);
    } catch (error: any) {
      console.error('獲取場地列表失敗:', error);
      setError(error.response?.data?.message || '獲取場地列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const toggleCourtStatus = async (courtId: string, currentStatus: boolean) => {
    try {
      setUpdating(courtId);
      setError(null);
      
      await axios.put(`/courts/${courtId}/status`, {
        isActive: !currentStatus
      });
      
      // 更新本地狀態
      setCourts(prevCourts =>
        prevCourts.map(court =>
          court._id === courtId
            ? { ...court, isActive: !currentStatus }
            : court
        )
      );
    } catch (error: any) {
      console.error('更新場地狀態失敗:', error);
      setError(error.response?.data?.message || '更新場地狀態失敗');
    } finally {
      setUpdating(null);
    }
  };

  const getCourtTypeInfo = (type: string) => {
    switch (type) {
      case 'competition':
        return {
          name: '比賽場',
          icon: '🏆',
          color: 'blue'
        };
      case 'training':
        return {
          name: '訓練場',
          icon: '🏃',
          color: 'green'
        };
      case 'solo':
        return {
          name: '單人場',
          icon: '🎯',
          color: 'purple'
        };
      case 'dink':
        return {
          name: '練習場',
          icon: '🏓',
          color: 'amber'
        };
      default:
        return {
          name: '場地',
          icon: '🏟️',
          color: 'gray'
        };
    }
  };

  const getOperatingHoursText = (court: Court) => {
    if (court.type === 'competition' || court.type === 'training') {
      return '24小時';
    } else if (court.type === 'solo') {
      return '08:00-23:00';
    }
    return '營業時間';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 錯誤信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <XCircleIcon className="w-5 h-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 場地統計 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MapPinIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">總場地</p>
              <p className="text-2xl font-bold text-gray-900">{courts.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">啟用中</p>
              <p className="text-2xl font-bold text-gray-900">
                {courts.filter(court => court.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">已停用</p>
              <p className="text-2xl font-bold text-gray-900">
                {courts.filter(court => !court.isActive).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserGroupIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">總容量</p>
              <p className="text-2xl font-bold text-gray-900">
                {courts.reduce((sum, court) => sum + court.capacity, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 場地列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courts.map((court, index) => {
          const typeInfo = getCourtTypeInfo(court.type);
          
          return (
            <motion.div
              key={court._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`border rounded-lg p-6 transition-all duration-200 ${
                court.isActive
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}
            >
              {/* 場地標題和狀態 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <span className="text-2xl mr-2">{typeInfo.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{court.name}</h3>
                    <p className="text-sm text-gray-500">{court.number}號場</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleCourtStatus(court._id, court.isActive)}
                  disabled={updating === court._id}
                  className={`flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    court.isActive
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  } ${updating === court._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {updating === court._id ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                  ) : court.isActive ? (
                    <CheckCircleIcon className="w-3 h-3 mr-1" />
                  ) : (
                    <XCircleIcon className="w-3 h-3 mr-1" />
                  )}
                  {court.isActive ? '啟用中' : '已停用'}
                </button>
              </div>

              {/* 場地信息 */}
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <UserGroupIcon className="w-4 h-4 mr-2" />
                  <span>容量: {court.capacity} 人</span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <ClockIcon className="w-4 h-4 mr-2" />
                  <span>營業時間: {getOperatingHoursText(court)}</span>
                </div>

                <div className="flex items-center text-sm text-gray-600">
                  <CurrencyDollarIcon className="w-4 h-4 mr-2" />
                  <span>
                    價格: {court.pricing?.offPeak || 0} - {court.pricing?.peakHour || 0} 積分/小時
                  </span>
                </div>

                {court.description && (
                  <p className="text-sm text-gray-500 mt-2">{court.description}</p>
                )}

                {/* 設施 */}
                {court.amenities && court.amenities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">設施:</p>
                    <div className="flex flex-wrap gap-1">
                      {court.amenities.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 操作按鈕 */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => toggleCourtStatus(court._id, court.isActive)}
                  disabled={updating === court._id}
                  className={`w-full flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    court.isActive
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  } ${updating === court._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {updating === court._id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                      處理中...
                    </>
                  ) : court.isActive ? (
                    <>
                      <XCircleIcon className="w-4 h-4 mr-2" />
                      停用場地
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                      啟用場地
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 操作說明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="w-5 h-5 text-blue-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">操作說明</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>點擊場地卡片上的狀態按鈕或底部的操作按鈕來切換場地狀態</li>
                <li>停用的場地將不會出現在預約選項中</li>
                <li>已確認的預約不會因場地停用而自動取消</li>
                <li>場地狀態變更會立即生效</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtManagement;
