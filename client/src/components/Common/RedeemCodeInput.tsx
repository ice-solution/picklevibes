import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [pocketLoading, setPocketLoading] = useState(false);
  const [redeemData, setRedeemData] = useState<RedeemData | null>(null);
  const [error, setError] = useState('');
  const [pocketItems, setPocketItems] = useState<PocketItem[]>([]);
  const [applyingPocketId, setApplyingPocketId] = useState<string | null>(null);

  const isProxyMode = forUserId !== undefined;
  const canUsePocket = forUserId !== null;

  const loadPocket = async () => {
    if (forUserId === null) {
      setPocketItems([]);
      return;
    }
    setPocketLoading(true);
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
    } finally {
      setPocketLoading(false);
    }
  };

  useEffect(() => {
    setRedeemData(null);
    setCode('');
    setError('');
    setApplyingPocketId(null);
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
      setApplyingPocketId(null);
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

  /** 點擊口袋兌換券即套用 */
  const handleUsePocketItem = async (pocketItemId: string) => {
    if (loading) return;
    setApplyingPocketId(pocketItemId);
    await applyValidatePayload({ pocketItemId });
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
    setRedeemData(null);
    setError('');
    setApplyingPocketId(null);
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

  const formatValidUntil = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
              aria-label={t('redeem.remove')}
            >
              <XCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {/* 口袋可使用兌換券：點擊即用 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-gray-600">
                {forUserId ? '客戶口袋兌換券' : t('redeem.pocketTitle')}
              </label>
              {!forUserId && (
                <Link
                  to="/my-redeem"
                  className="text-xs text-primary-600 hover:text-primary-800 shrink-0"
                >
                  {t('redeem.pocketViewAll')}
                </Link>
              )}
            </div>

            {pocketLoading ? (
              <p className="text-xs text-gray-500 py-2">{t('common.loading')}</p>
            ) : pocketItems.length > 0 ? (
              <ul className="space-y-2 max-h-48 overflow-y-auto overscroll-contain">
                {pocketItems.map((item) => {
                  const rc = item.redeemCode;
                  const busy = applyingPocketId === item._id;
                  return (
                    <li key={item._id}>
                      <button
                        type="button"
                        onClick={() => handleUsePocketItem(item._id)}
                        disabled={loading}
                        className="w-full text-left rounded-lg border border-primary-200 bg-white px-3 py-2.5 hover:border-primary-400 hover:bg-primary-50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {rc?.name || '兌換券'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {rc?.code}
                              {rc?.validUntil
                                ? ` · 有效至 ${formatValidUntil(rc.validUntil)}`
                                : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-primary-700">
                              {formatDiscount(item)}
                            </p>
                            <p className="text-[11px] text-primary-600 mt-0.5">
                              {busy ? t('common.loading') : t('redeem.use')}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 bg-white border border-dashed border-gray-200 rounded-lg px-3 py-2">
                {t('redeem.pocketEmpty')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              {t('redeem.inputLabel')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder={t('redeem.placeholder')}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={loading || !code.trim()}
                className="shrink-0 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium min-h-[40px]"
              >
                {loading && !applyingPocketId ? t('common.loading') : t('redeem.apply')}
              </button>
            </div>
            <button
              type="button"
              onClick={handleClaimOnly}
              disabled={loading || !code.trim()}
              className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
            >
              {forUserId ? '只放入客戶口袋（稍後再用）' : t('redeem.claimOnly')}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-600 text-sm"
            >
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default RedeemCodeInput;
