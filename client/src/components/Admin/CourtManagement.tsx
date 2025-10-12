import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import apiConfig from '../../config/api';
import {
  MapPinIcon,
  ClockIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  PowerIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  TrashIcon,
  StarIcon
} from '@heroicons/react/24/outline';

interface CourtImage {
  _id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

interface Court {
  _id: string;
  name: string;
  number: string;
  type: string;
  description: string;
  capacity: number;
  isActive: boolean;
  maintenance: {
    isUnderMaintenance: boolean;
    maintenanceStart?: string;
    maintenanceEnd?: string;
    maintenanceReason?: string;
  };
  pricing: {
    offPeak: number;
    peakHour: number;
    owlTime: number;
  };
  amenities: string[];
  operatingHours: {
    [key: string]: string;
  };
  images: CourtImage[];
  createdAt: string;
  updatedAt: string;
}

const CourtManagement: React.FC = () => {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

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

  const toggleMaintenanceMode = async (courtId: string, currentMaintenanceStatus: boolean) => {
    try {
      setUpdating(courtId);
      setError(null);
      
      await axios.put(`/courts/${courtId}/maintenance`, {
        isUnderMaintenance: !currentMaintenanceStatus
      });
      
      // 更新本地狀態
      setCourts(prevCourts =>
        prevCourts.map(court =>
          court._id === courtId
            ? { 
                ...court, 
                maintenance: {
                  ...court.maintenance,
                  isUnderMaintenance: !currentMaintenanceStatus
                }
              }
            : court
        )
      );
    } catch (error: any) {
      console.error('更新維護狀態失敗:', error);
      setError(error.response?.data?.message || '更新維護狀態失敗');
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

  const handleImageUpload = async (courtId: string, file: File) => {
    try {
      setUploading(courtId);
      setError(null);

      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(`/courts/${courtId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // 更新本地狀態
      setCourts(prevCourts =>
        prevCourts.map(court =>
          court._id === courtId
            ? { ...court, images: [...court.images, response.data.image] }
            : court
        )
      );

      alert('圖片上傳成功！');
    } catch (error: any) {
      console.error('上傳圖片失敗:', error);
      setError(error.response?.data?.message || '上傳圖片失敗');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteImage = async (courtId: string, imageId: string) => {
    if (!window.confirm('確定要刪除這張圖片嗎？')) return;

    try {
      setError(null);
      await axios.delete(`/courts/${courtId}/images/${imageId}`);

      // 更新本地狀態
      setCourts(prevCourts =>
        prevCourts.map(court =>
          court._id === courtId
            ? { ...court, images: court.images.filter(img => img._id !== imageId) }
            : court
        )
      );

      alert('圖片刪除成功！');
    } catch (error: any) {
      console.error('刪除圖片失敗:', error);
      setError(error.response?.data?.message || '刪除圖片失敗');
    }
  };

  const handleSetPrimaryImage = async (courtId: string, imageId: string) => {
    try {
      setError(null);
      await axios.put(`/courts/${courtId}/images/${imageId}/primary`);

      // 更新本地狀態
      setCourts(prevCourts =>
        prevCourts.map(court =>
          court._id === courtId
            ? {
                ...court,
                images: court.images.map(img => ({
                  ...img,
                  isPrimary: img._id === imageId
                }))
              }
            : court
        )
      );

      alert('主圖片設置成功！');
    } catch (error: any) {
      console.error('設置主圖片失敗:', error);
      setError(error.response?.data?.message || '設置主圖片失敗');
    }
  };

  const openImageModal = (court: Court) => {
    setSelectedCourt(court);
    setShowImageModal(true);
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
                <div className="flex flex-col gap-2">
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
                  <button
                    onClick={() => toggleMaintenanceMode(court._id, court.maintenance?.isUnderMaintenance || false)}
                    disabled={updating === court._id}
                    className={`flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      court.maintenance?.isUnderMaintenance
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    } ${updating === court._id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {updating === court._id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                    ) : court.maintenance?.isUnderMaintenance ? (
                      <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                    ) : (
                      <PowerIcon className="w-3 h-3 mr-1" />
                    )}
                    {court.maintenance?.isUnderMaintenance ? '維護中' : '正常'}
                  </button>
                </div>
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
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
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
                
                <button
                  onClick={() => openImageModal(court)}
                  className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                >
                  <PhotoIcon className="w-4 h-4 mr-2" />
                  管理圖片 ({court.images?.length || 0})
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
                <li>圖片必須為 1920x1280 像素，支持 JPEG、PNG、WEBP 格式</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 圖片管理模態框 */}
      {showImageModal && selectedCourt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedCourt.name} - 圖片管理
              </h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            {/* 圖片上傳區域 */}
            <div className="mb-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageUpload(selectedCourt._id, file);
                    }
                  }}
                  disabled={uploading === selectedCourt._id}
                  className="hidden"
                  id={`upload-${selectedCourt._id}`}
                />
                <label
                  htmlFor={`upload-${selectedCourt._id}`}
                  className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 ${
                    uploading === selectedCourt._id ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {uploading === selectedCourt._id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                      上傳中...
                    </>
                  ) : (
                    <>
                      <PhotoIcon className="w-4 h-4 mr-2" />
                      上傳圖片
                    </>
                  )}
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  支持 JPEG、PNG、WEBP 格式，尺寸必須為 1920x1280 像素
                </p>
              </div>
            </div>

            {/* 現有圖片列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedCourt.images?.map((image) => (
                <div key={image._id} className="relative group">
                  <div className="relative">
                    <img
                      src={`${apiConfig.API_BASE_URL}${image.url}`}
                      alt={image.alt}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {image.isPrimary && (
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        主圖片
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 flex space-x-2">
                      {!image.isPrimary && (
                        <button
                          onClick={() => handleSetPrimaryImage(selectedCourt._id, image._id)}
                          className="p-2 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
                          title="設為主圖片"
                        >
                          <StarIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteImage(selectedCourt._id, image._id)}
                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="刪除圖片"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(!selectedCourt.images || selectedCourt.images.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                暫無圖片
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CourtManagement;
