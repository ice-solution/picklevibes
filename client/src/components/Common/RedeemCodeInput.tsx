import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import {
  TicketIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface RedeemCodeInputProps {
  amount: number;
  orderType: 'booking' | 'recharge' | 'activity' | 'product' | 'eshop';
  onRedeemApplied: (redeemData: RedeemData) => void;
  onRedeemRemoved: () => void;
  className?: string;
  restrictedCode?: string;
  /**
   * undefined = 使用登入用戶自己的口袋（預約／網店）
   * null = POS 未選客戶（停用）
   * string = 代指定客戶使用口袋（POS）
   */
  forUserId?: string | null;
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

interface PocketItem {
  _id: string;
  status: string;
  redeemCode: {
    _id: string;
    code: string;
    name: string;
    type: 'fixed' | 'percentage';
    value: number;
    validUntil: string;
    applicableTypes: string[];
  } | null;
}

const RedeemCodeInput: React.FC<RedeemCodeInputProps> = ({
  amount,
  orderType,
  onRedeemApplied,
  onRedeemRemoved,
  className = '',
  restrictedCode,
  forUserId,
  bookingContext,
}) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<RedeemData | null>(null);
  const [error, setError] = useState('');
  const [pocketItems, setPocketItems] = useState<PocketItem[]>([]);
  const [selectedPocketId, setSelectedPocketId] = useState('');

  const isProxyMode = forUserId !== undefined;
  const canUsePocket = forUserId !== null;

  const loadPocket = async () => {
    if (forUserId === null) {
      setPocketItems([]);
      return;
    }
    try {
      const res = forUserId
        ? await axios.get(`/redeem/admin/user-pocket/${forUserId}?status=available`)
        : await axios.get('/redeem/my-pocket?status=available');
      const items = (res.data.items || []).filter((item: PocketItem) => {
        if (!item.redeemCode) return false;
        const types = item.redeemCode.applicableTypes || [];
        return (
          types.includes('all') ||
          types.includes(orderType) ||
          (orderType === 'product' && types.includes('eshop')) ||
          (orderType === 'eshop' && types.includes('product'))
        );
      });
      setPocketItems(items);
    } catch {
      setPocketItems([]);
    }
  };

  useEffect(() => {
    setRedeemData(null);
    setSelectedPocketId('');
    setCode('');
    setError('');
    if (isProxyMode) {
      onRedeemRemoved();
    }
    loadPocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType, forUserId]);

  const applyValidatePayload = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/redeem/validate', {
        amount,
        orderType,
        restrictedCode: restrictedCode || undefined,
        courtId: bookingContext?.courtId,
        date: bookingContext?.date,
        startTime: bookingContext?.startTime,
        pricingSlotName: bookingContext?.pricingSlotName,
        alsoClaimToPocket: true,
        ...(forUserId ? { forUserId } : {}),
        ...payload,
      });

      if (response.data.valid) {
        setRedeemData(response.data.redeemCode);
        onRedeemApplied(response.data.redeemCode);
        await loadPocket();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || t('redeem.errors.validationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!code.trim()) {
      setError(t('redeem.errors.codeRequired'));
      return;
    }
    if (forUserId === null) {
      setError('請先選擇客戶帳戶再使用兌換券');
      return;
    }
    await applyValidatePayload({ code: code.trim() });
  };

  const handleSelectPocket = async () => {
    if (!selectedPocketId) {
      setError('請選擇口袋中的兌換券');
      return;
    }
    await applyValidatePayload({ pocketItemId: selectedPocketId });
  };

  const handleClaimOnly = async () => {
    if (!code.trim()) {
      setError(t('redeem.errors.codeRequired'));
      return;
    }
    if (forUserId === null) {
      setError('請先選擇客戶帳戶');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (forUserId) {
        const res = await axios.post('/redeem/admin/claim-for-user', {
          userId: forUserId,
          code: code.trim(),
        });
        alert(res.data.message || '已放入客戶口袋');
      } else {
        const res = await axios.post('/redeem/pocket/claim', { code: code.trim() });
        alert(res.data.message || '已放入口袋');
      }
      setCode('');
      await loadPocket();
    } catch (err: any) {
      setError(err.response?.data?.message || '入袋失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setSelectedPocketId('');
    setRedeemData(null);
    setError('');
    onRedeemRemoved();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate();
    }
  };

  const formatDiscount = (item: PocketItem) => {
    const rc = item.redeemCode;
    if (!rc) return '';
    return rc.type === 'fixed' ? `HK$${rc.value}` : `${rc.value}%`;
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <TicketIcon className="w-5 h-5 text-primary-600" />
        <h3 className="text-sm font-medium text-gray-900">
          {isProxyMode ? '客戶兌換券' : t('redeem.title')}
        </h3>
      </div>

      {!canUsePocket ? (
        <p className="text-xs text-gray-500">請先選擇客戶帳戶，即可使用其口袋兌換券或輸入兌換碼。</p>
      ) : redeemData ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-3"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">{redeemData.name}</p>
                <p className="text-xs text-green-600">{redeemData.code}</p>
                <p className="text-sm text-green-700 mt-1">
                  {t('redeem.discount')}: -HK${redeemData.discountAmount.toFixed(2)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-green-600 hover:text-green-800"
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {pocketItems.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600">
                {forUserId ? '客戶口袋兌換券' : '我的兌換券口袋'}
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedPocketId}
                  onChange={(e) => setSelectedPocketId(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">選擇袋內兌換券…</option>
                  {pocketItems.map((item) => (
                    <option key={item._id} value={item._id}>
                      {item.redeemCode?.name}（{item.redeemCode?.code}）· {formatDiscount(item)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSelectPocket}
                  disabled={loading || !selectedPocketId}
                  className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  使用
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">輸入兌換碼</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder={t('redeem.placeholder')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? t('common.loading') : t('redeem.apply')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleClaimOnly}
              disabled={loading || !code.trim()}
              className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
            >
              {forUserId ? '只放入客戶口袋（稍後再用）' : '只放入口袋（稍後再用）'}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-600 text-sm"
            >
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span>{error}</span>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default RedeemCodeInput;
