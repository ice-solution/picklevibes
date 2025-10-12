import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import RedeemCodeInput from '../components/Common/RedeemCodeInput';
import { 
  CreditCardIcon, 
  CurrencyDollarIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

interface RechargeOption {
  points: number;
  amount: number;
  label: string;
}

interface UserBalance {
  balance: number;
  totalRecharged: number;
  totalSpent: number;
  transactions: Array<{
    type: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

const Recharge: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [options, setOptions] = useState<RechargeOption[]>([]);
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<RechargeOption | null>(null);
  const [redeemData, setRedeemData] = useState<any>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [offersRes, balanceRes] = await Promise.all([
        axios.get('/recharge-offers'),
        axios.get('/recharge/balance')
      ]);
      
      // 將 API 返回的優惠轉換為 RechargeOption 格式
      const offers = offersRes.data.offers.map((offer: any) => ({
        points: offer.points,
        amount: offer.amount,
        label: `${offer.points}分 (HK$${offer.amount})`
      }));
      
      setOptions(offers);
      setBalance(balanceRes.data);
    } catch (error) {
      console.error('獲取數據失敗:', error);
      // 如果新的 API 失敗，使用備用選項
      const fallbackOptions = [
        { points: 500, amount: 500, label: '500分 (HK$500)' },
        { points: 1000, amount: 1000, label: '1000分 (HK$1000)' },
        { points: 1200, amount: 1200, label: '1200分 (HK$1200)' },
        { points: 2000, amount: 2000, label: '2000分 (HK$2000)' }
      ];
      setOptions(fallbackOptions);
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async (option: RechargeOption) => {
    try {
      setProcessing(true);
      setSelectedOption(option);

      const response = await axios.post('/recharge/create-checkout-session', {
        points: option.points,
        amount: redeemData ? redeemData.finalAmount : option.amount,
        redeemCodeId: redeemData?.id
      });

      // 重定向到 Stripe Checkout
      window.location.href = response.data.url;
    } catch (error: any) {
      console.error('充值失敗:', error);
      alert(error.response?.data?.message || '充值失敗，請稍後再試');
    } finally {
      setProcessing(false);
      setSelectedOption(null);
    }
  };

  const handleRedeemApplied = (redeem: any) => {
    setRedeemData(redeem);
  };

  const handleRedeemRemoved = () => {
    setRedeemData(null);
  };

  const handleCustomRecharge = async () => {
    const amount = parseFloat(customAmount);
    const points = Math.floor(amount); // 1分 = 1元
    
    if (amount < 100) {
      alert('充值金額最少需要HK$100');
      return;
    }
    
    if (points < 100) {
      alert('充值積分最少需要100分');
      return;
    }

    try {
      setProcessing(true);
      const customOption = { points, amount, label: `${points}分 (HK$${amount})` };
      setSelectedOption(customOption);

      const response = await axios.post('/recharge/create-checkout-session', {
        points: points,
        amount: redeemData ? redeemData.finalAmount : amount,
        redeemCodeId: redeemData?.id
      });

      // 重定向到 Stripe Checkout
      window.location.href = response.data.url;
    } catch (error: any) {
      console.error('充值失敗:', error);
      alert(error.response?.data?.message || '充值失敗，請稍後再試');
    } finally {
      setProcessing(false);
      setSelectedOption(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 頁面標題 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            帳戶充值
          </h1>
          <p className="text-gray-600">
            為您的帳戶充值積分，用於預約場地
          </p>
        </motion.div>

        {/* 當前餘額 */}
        {balance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-lg shadow-md p-6 mb-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CurrencyDollarIcon className="w-8 h-8 text-primary-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">當前餘額</h3>
                  <p className="text-2xl font-bold text-primary-600">
                    {balance.balance} 分
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">累計充值</p>
                <p className="text-lg font-semibold text-green-600">
                  {balance.totalRecharged} 分
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 兌換碼輸入 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-8"
        >
          <RedeemCodeInput
            amount={0} // 將在選擇充值選項後更新
            orderType="recharge"
            onRedeemApplied={handleRedeemApplied}
            onRedeemRemoved={handleRedeemRemoved}
          />
        </motion.div>

        {/* 充值選項 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {options.map((option, index) => (
            <motion.div
              key={option.points}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCardIcon className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {option.label}
                </h3>
                <p className="text-gray-600 mb-6">
                  1分 = 1元，充值後立即可用
                </p>
                <button
                  onClick={() => handleRecharge(option)}
                  disabled={processing}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors duration-200 ${
                    processing && selectedOption?.points === option.points
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {processing && selectedOption?.points === option.points ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>處理中...</span>
                    </div>
                  ) : (
                    '立即充值'
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* 自定義充值金額 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-lg shadow-md p-6 mb-8"
        >
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              自定義充值金額
            </h3>
            <p className="text-gray-600">
              最少充值HK$100，1分 = 1元
            </p>
          </div>

          {!showCustomForm ? (
            <div className="text-center">
              <button
                onClick={() => setShowCustomForm(true)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
              >
                輸入自定義金額
              </button>
            </div>
          ) : (
            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  充值金額 (HK$)
                </label>
                <input
                  type="number"
                  min="100"
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="請輸入充值金額，最少HK$100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  將獲得 {Math.floor(parseFloat(customAmount) || 0)} 積分
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowCustomForm(false);
                    setCustomAmount('');
                  }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  onClick={handleCustomRecharge}
                  disabled={processing || !customAmount || parseFloat(customAmount) < 100}
                  className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors duration-200 ${
                    processing || !customAmount || parseFloat(customAmount) < 100
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  {processing ? '處理中...' : '立即充值'}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* 最近交易記錄 */}
        {balance && balance.transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              最近交易記錄
            </h3>
            <div className="space-y-3">
              {balance.transactions.map((transaction, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    {transaction.type === 'recharge' ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-blue-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {transaction.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${
                    transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount} 分
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Recharge;
