import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCardIcon, 
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import apiConfig from '../../config/api';

interface PaymentFormProps {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ bookingId, amount, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string>('');

  useEffect(() => {
    // 創建 Stripe Checkout Session
    const createCheckoutSession = async () => {
      try {
        const response = await axios.post(`${apiConfig.API_BASE_URL}/payments/create-checkout-session`, {
          bookingId,
          amount
        });
        
        if (response.data.url) {
          setCheckoutUrl(response.data.url);
        } else {
          onError('無法創建支付會話');
        }
      } catch (error: any) {
        console.error('創建支付會話失敗:', error);
        onError(error.response?.data?.message || '無法初始化支付');
      }
    };

    createCheckoutSession();
  }, [bookingId, amount, onError]);

  const handleRedirectToStripe = () => {
    if (checkoutUrl) {
      // 跳轉到 Stripe Checkout
      window.location.href = checkoutUrl;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCardIcon className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">支付信息</h3>
        </div>

        <div className="text-center py-8">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <CreditCardIcon className="w-8 h-8 text-primary-600" />
            </div>
            <h4 className="text-xl font-semibold text-gray-900 mb-2">
              安全支付
            </h4>
            <p className="text-gray-600 mb-4">
              您將被重定向到 Stripe 安全支付頁面，支持多種支付方式
            </p>
            <div className="text-sm text-gray-500 mb-6">
              支持信用卡、Apple Pay、Google Pay、銀行轉帳等
            </div>
          </div>

          <button
            onClick={handleRedirectToStripe}
            disabled={!checkoutUrl || isProcessing}
            className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-semibold text-white transition-all duration-200 ${
              !checkoutUrl || isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 hover:shadow-lg'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                準備中...
              </>
            ) : (
              <>
                前往支付頁面
                <ArrowRightIcon className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <LockClosedIcon className="w-4 h-4" />
            <span>您的支付信息受到 SSL 加密保護</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const StripePayment: React.FC<PaymentFormProps> = (props) => {
  return <PaymentForm {...props} />;
};

export default StripePayment;