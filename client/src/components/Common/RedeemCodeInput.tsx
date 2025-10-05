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
  orderType: 'booking' | 'recharge';
  onRedeemApplied: (redeemData: RedeemData) => void;
  onRedeemRemoved: () => void;
  className?: string;
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
  className = ''
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<RedeemData | null>(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    if (!code.trim()) {
      setError('請輸入兌換碼');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post('/redeem/validate', {
        code: code.trim(),
        amount,
        orderType
      });

      if (response.data.valid) {
        setRedeemData(response.data.redeemCode);
        onRedeemApplied(response.data.redeemCode);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '兌換碼驗證失敗');
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
        <h3 className="text-lg font-semibold text-gray-900">兌換碼</h3>
      </div>

      {!redeemData ? (
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="輸入兌換碼"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={handleValidate}
              disabled={loading || !code.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-200"
            >
              {loading ? '驗證中...' : '驗證'}
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
                    ? `減 ${redeemData.value} 積分` 
                    : `${redeemData.value}折`
                  }
                </p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              移除
            </button>
          </div>
          
          <div className="mt-2 text-sm text-green-700">
            <p>原價: {amount.toFixed(0)} 積分</p>
            <p>折扣: -{redeemData.discountAmount.toFixed(0)} 積分</p>
            <p className="font-semibold">實付: {redeemData.finalAmount.toFixed(0)} 積分</p>
          </div>
        </motion.div>
      )}

      <div className="mt-3 text-xs text-gray-500">
        <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
        每個兌換碼有使用次數和期限限制
      </div>
    </div>
  );
};

export default RedeemCodeInput;
