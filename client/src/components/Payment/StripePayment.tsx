import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { 
  CreditCardIcon, 
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

// 初始化 Stripe (您需要替換為您的公開金鑰)
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here');

interface PaymentFormProps {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ bookingId, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>('');

  useEffect(() => {
    // 創建支付意圖
    const createPaymentIntent = async () => {
      try {
        const response = await axios.post('/payments/create-payment-intent', {
          bookingId,
          amount
        });
        setClientSecret(response.data.clientSecret);
      } catch (error: any) {
        onError(error.response?.data?.message || '創建支付失敗');
      }
    };

    createPaymentIntent();
  }, [bookingId, amount, onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('找不到支付元素');
      setIsProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
      }
    });

    if (error) {
      onError(error.message || '支付失敗');
      setIsProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      // 確認支付
      try {
        await axios.post('/payments/confirm', {
          paymentIntentId: paymentIntent.id
        });
        onSuccess();
      } catch (confirmError: any) {
        onError(confirmError.response?.data?.message || '支付確認失敗');
      }
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCardIcon className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">支付信息</h3>
        </div>

        <div className="p-4 border border-gray-300 rounded-lg">
          <CardElement options={cardElementOptions} />
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <LockClosedIcon className="w-4 h-4" />
          <span>您的支付信息受到 SSL 加密保護</span>
        </div>
      </div>

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900">支付金額</span>
          <span className="text-2xl font-bold text-primary-600">
            HK$ {amount.toLocaleString()}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-200 ${
          isProcessing
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
            : 'bg-primary-600 hover:bg-primary-700 text-white transform hover:scale-105'
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>處理中...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <LockClosedIcon className="w-5 h-5" />
            <span>確認支付 HK$ {amount.toLocaleString()}</span>
          </div>
        )}
      </button>

      <div className="text-center text-sm text-gray-500">
        <p>點擊「確認支付」即表示您同意我們的服務條款</p>
      </div>
    </form>
  );
};

interface StripePaymentProps {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const StripePayment: React.FC<StripePaymentProps> = ({ bookingId, amount, onSuccess, onError }) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm
        bookingId={bookingId}
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};

export default StripePayment;

