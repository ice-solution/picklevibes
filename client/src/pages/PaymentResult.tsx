import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  XCircleIcon,
  CalendarDaysIcon,
  HomeIcon
} from '@heroicons/react/24/outline';

const PaymentResult: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const paymentMessage = searchParams.get('message');

    if (paymentStatus === 'success') {
      setStatus('success');
      setMessage(paymentMessage || '支付成功！您的預約已確認。');
    } else if (paymentStatus === 'error') {
      setStatus('error');
      setMessage(paymentMessage || '支付失敗，請稍後再試。');
    } else {
      setStatus('error');
      setMessage('無效的支付狀態');
    }
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">處理支付結果中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-xl shadow-lg p-8 text-center"
        >
          {status === 'success' ? (
            <div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircleIcon className="w-12 h-12 text-green-600" />
              </motion.div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                支付成功！
              </h1>
              
              <p className="text-lg text-gray-600 mb-8">
                {message}
              </p>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  我們已經發送確認郵件到您的信箱，請查收。
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/dashboard"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <CalendarDaysIcon className="w-5 h-5" />
                    查看我的預約
                  </Link>
                  
                  <Link
                    to="/"
                    className="btn-outline inline-flex items-center gap-2"
                  >
                    <HomeIcon className="w-5 h-5" />
                    返回首頁
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <XCircleIcon className="w-12 h-12 text-red-600" />
              </motion.div>
              
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                支付失敗
              </h1>
              
              <p className="text-lg text-gray-600 mb-8">
                {message}
              </p>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  請檢查您的支付信息或稍後再試。如有問題，請聯繫客服。
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/booking"
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <CalendarDaysIcon className="w-5 h-5" />
                    重新預約
                  </Link>
                  
                  <Link
                    to="/"
                    className="btn-outline inline-flex items-center gap-2"
                  >
                    <HomeIcon className="w-5 h-5" />
                    返回首頁
                  </Link>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentResult;

