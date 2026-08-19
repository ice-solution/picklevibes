import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  TicketIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface RedeemCodeInputProps {
  amount: number;
  orderType: 'booking' | 'recharge' | 'activity' | 'product' | 'eshop';
  onRedeemApplied: (redeemData: RedeemData) => void;
  onRedeemRemoved: () => void;
  className?: string;
  restrictedCode?: string; // 專用代碼，用於限制使用場景
  bookingContext?: {
    courtId?: string;
    date?: string;
    startTime?: string;
    pricingSlotName?: string;
  };
}

interface RedeemData {
  id: string;
  code: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  discountAmount: number;
  finalAmount: number;
}

const RedeemCodeInput: React.FC<RedeemCodeInputProps> = ({
  amount,
  orderType,
  onRedeemApplied,
  onRedeemRemoved,
  className = '',
  restrictedCode,
  bookingContext,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<RedeemData | null>(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!code.trim()) {
      setError(t('redeem.errors.codeRequired'));
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post('/redeem/validate', {
        code: code.trim(),
        amount,
        orderType,
        restrictedCode: restrictedCode || undefined,
        courtId: bookingContext?.courtId,
        date: bookingContext?.date,
        startTime: bookingContext?.startTime,
        pricingSlotName: bookingContext?.pricingSlotName,
      });

      if (response.data.valid) {
        setRedeemData(response.data.redeemCode);
        onRedeemApplied(response.data.redeemCode);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || t('redeem.errors.validationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setRedeemData(null);
    setError('');
    onRedeemRemoved();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <TicketIcon className="w-5 h-5 text-primary-600" />
        <h3 className="text-lg font-semibold text-gray-900">{t('redeem.title')}</h3>
      </div>

      {!redeemData ? (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder={t('redeem.placeholder')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={handleValidate}
              disabled={loading || !code.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
            >
              {loading ? t('redeem.validating') : t('redeem.validate')}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-600"
            >
              <XCircleIcon className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-md p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  {redeemData.name} ({redeemData.code})
                </p>
                <p className="text-xs text-green-600">
                  {redeemData.type === 'fixed' 
                    ? t('redeem.fixed', { value: redeemData.value })
                    : t('redeem.percentage', { value: redeemData.value })
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              {t('redeem.remove')}
            </button>
          </div>
          
          <div className="mt-2 text-sm text-green-700">
            <p>
              {t('redeem.labels.original')}: {amount.toFixed(0)} {t('common.currency')}
            </p>
            <p>
              {t('redeem.labels.discount')}: -{redeemData.discountAmount.toFixed(0)} {t('common.currency')}
            </p>
            <p className="font-semibold">
              {t('redeem.labels.payable')}: {redeemData.finalAmount.toFixed(0)} {t('common.currency')}
            </p>
          </div>
        </motion.div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
        {t('redeem.limitNote')}
      </div>
    </div>
  );
};

export default RedeemCodeInput;
