import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircleIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const RechargeSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      handleRechargeSuccess(sessionId);
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  const handleRechargeSuccess = async (sessionId: string) => {
    try {
      // 這裡可以根據 sessionId 獲取充值詳情
      // 暫時直接顯示成功
      setSuccess(true);
    } catch (error) {
      console.error('處理充值成功錯誤:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">處理中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4"
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          </motion.div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            充值成功！
          </h1>
          
          <p className="text-gray-600 mb-6">
            您的帳戶已成功充值，積分已到帳，現在可以用於預約場地。
          </p>
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={() => navigate('/recharge')}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200"
            >
              繼續充值
            </button>
            
            <button
              onClick={() => navigate('/booking')}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors duration-200"
            >
              立即預約
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full text-gray-600 hover:text-gray-800 py-2 px-6 rounded-lg transition-colors duration-200"
            >
              返回儀表板
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RechargeSuccess;
