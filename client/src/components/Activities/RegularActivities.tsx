import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiConfig from '../../config/api.js';
import { XMarkIcon, EyeIcon } from '@heroicons/react/24/outline';

// Instagram Icon Component
const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

interface RegularActivity {
  _id: string;
  title: string;
  description: string;
  introduction: string;
  poster?: string;
  requirements?: string;
  fee?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const RegularActivities: React.FC = () => {
  const [activities, setActivities] = useState<RegularActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<RegularActivity | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, [currentPage]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '9'
      });

      const response = await fetch(`${apiConfig.API_BASE_URL}/regular-activities?${params}`);
      const data = await response.json();
      
      setActivities(data.activities || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('獲取恆常活動列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `${apiConfig.API_BASE_URL}${imagePath}`;
  };

  const handleIGClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止觸發卡片點擊事件
    window.open('https://ig.me/m/picklevibes.hk', '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = (activity: RegularActivity) => {
    setSelectedActivity(activity);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedActivity(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入恆常活動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <InstagramIcon className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暫無恆常活動</h3>
          <p className="text-gray-600">目前沒有恆常活動，請稍後再來查看</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((activity, index) => (
            <motion.div
              key={activity._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleCardClick(activity)}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            >
              {/* Poster */}
              {activity.poster ? (
                <div className="h-48 bg-gray-200 overflow-hidden flex items-center justify-center">
                  <img
                    src={getImageUrl(activity.poster)}
                    alt={activity.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <span className="text-6xl">🏓</span>
                </div>
              )}

              <div className="p-6">
                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {activity.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {activity.description}
                </p>

                {/* Introduction Preview */}
                {activity.introduction && (
                  <div className="mb-4">
                    <p className="text-gray-700 text-sm line-clamp-2">
                      {activity.introduction}
                    </p>
                  </div>
                )}

                {/* Requirements */}
                {activity.requirements && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 mb-1">活動要求</p>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {activity.requirements}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick(activity);
                    }}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    查看詳情
                  </button>
                  <button
                    onClick={(e) => handleIGClick(e)}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors font-medium"
                  >
                    <InstagramIcon className="h-5 w-5 mr-2" />
                    IG 查詢
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-8">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一頁
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 border rounded-lg ${
                  currentPage === page
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedActivity && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
                <h2 className="text-2xl font-bold text-gray-900">活動詳情</h2>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Poster */}
                {selectedActivity.poster ? (
                  <div className="mb-6 rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(selectedActivity.poster)}
                      alt={selectedActivity.title}
                      className="w-full h-64 md:h-96 object-cover"
                    />
                  </div>
                ) : (
                  <div className="mb-6 h-64 md:h-96 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                    <span className="text-9xl">🏓</span>
                  </div>
                )}

                {/* Title */}
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  {selectedActivity.title}
                </h3>

                {/* Description */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">活動描述</h4>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selectedActivity.description}
                  </p>
                </div>

                {/* Introduction */}
                {selectedActivity.introduction && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">活動介紹</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedActivity.introduction}
                      </p>
                    </div>
                  </div>
                )}

                {/* Requirements */}
                {selectedActivity.requirements && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">活動要求</h4>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedActivity.requirements}
                      </p>
                    </div>
                  </div>
                )}

                {/* 收費 */}
                {selectedActivity.fee != null && selectedActivity.fee > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">收費</h4>
                    <p className="text-gray-700 font-medium">HK$ {selectedActivity.fee}</p>
                  </div>
                )}

                {/* IG 查詢按鈕 */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <a
                    href="https://ig.me/m/picklevibes.hk"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors font-medium text-lg"
                  >
                    <InstagramIcon className="h-6 w-6 mr-2" />
                    IG 了解詳情
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegularActivities;