import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CreditCardIcon, BuildingStorefrontIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';
import { Link, useSearchParams } from 'react-router-dom';

type RechargeOption = {
  _id?: string;
  name: string;
  points: number;
  amount: number;
  description: string;
};

type AllianceStore = {
  id: string;
  name: string;
  slug: string;
  displayName?: string;
  enableRecharge?: boolean;
};

const AccountRecharge: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const storeSlug = searchParams.get('store') || '';
  const isStoreMode = Boolean(storeSlug);
  const fromBooking = searchParams.get('from') === 'booking';
  const insufficientBalance = searchParams.get('reason') === 'insufficient_balance';
  const [options, setOptions] = useState<RechargeOption[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [platformBalance, setPlatformBalance] = useState<number | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ name: string; slug: string; enableRecharge?: boolean } | null>(null);
  const [allianceStores, setAllianceStores] = useState<AllianceStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [storeRechargeDisabled, setStoreRechargeDisabled] = useState(false);

  const rechargeableStores = useMemo(
    () => allianceStores.filter((s) => s.enableRecharge !== false),
    [allianceStores]
  );

  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await axios.get('/platform/alliance/stores');
        setAllianceStores(res.data.stores || []);
      } catch {
        setAllianceStores([]);
      }
    };
    void loadStores();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const offersUrl = isStoreMode
          ? `/recharge-offers?store=${encodeURIComponent(storeSlug)}`
          : '/recharge-offers';
        const balanceUrl = isStoreMode
          ? `/recharge/balance?store=${encodeURIComponent(storeSlug)}`
          : '/recharge/balance';

        const [offersRes, balanceRes] = await Promise.all([
          axios.get(offersUrl),
          axios.get(balanceUrl),
        ]);

        setOptions(
          (offersRes.data.offers || []).map((o: RechargeOption) => ({
            _id: o._id,
            name: o.name,
            points: o.points,
            amount: o.amount,
            description: o.description,
          }))
        );
        setBalance(balanceRes.data?.balance ?? null);
        setPlatformBalance(
          isStoreMode ? balanceRes.data?.platformBalance ?? null : balanceRes.data?.balance ?? null
        );
        setStoreInfo(offersRes.data.store || balanceRes.data.store || null);
        const disabled = Boolean(offersRes.data.rechargeDisabled) || offersRes.data.store?.enableRecharge === false;
        setStoreRechargeDisabled(isStoreMode && disabled);
        if (isStoreMode && disabled) {
          setOptions([]);
        }
      } catch (e) {
        console.error(e);
        setOptions([]);
        setBalance(null);
        setPlatformBalance(null);
        setStoreRechargeDisabled(false);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [storeSlug, isStoreMode]);

  const storeLabel = useMemo(
    () => storeInfo?.name || allianceStores.find((s) => s.slug === storeSlug)?.displayName || storeSlug,
    [storeInfo, allianceStores, storeSlug]
  );

  const checkout = async (option: RechargeOption) => {
    if (isStoreMode && storeRechargeDisabled) {
      alert('此店鋪暫未開放充值');
      return;
    }
    const scopeLabel = isStoreMode ? storeLabel : 'PickCourt 平台';
    const ok = window.confirm(
      `確認為 ${scopeLabel} 充值 ${option.points} 分（HK$${option.amount}）？\n\n${
        isStoreMode
          ? '此積分僅限該店使用，不可跨店。'
          : '此積分可於聯盟各店預約使用。'
      }\n\n退款將收取 8% 手續費。`
    );
    if (!ok) return;
    try {
      setProcessing(true);
      const payload: Record<string, unknown> = {
        points: option.points,
        amount: option.amount,
        rechargeOfferId: option._id || null,
      };
      if (isStoreMode) {
        payload.store = storeSlug;
        payload.successUrl = `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}?store=${storeSlug}&success=1`;
        payload.cancelUrl = `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}?store=${storeSlug}`;
      } else {
        payload.successUrl = `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}?success=1`;
        payload.cancelUrl = `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}`;
      }
      const res = await axios.post('/recharge/create-checkout-session', payload);
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '充值失敗，請稍後再試');
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomRecharge = async () => {
    if (isStoreMode && storeRechargeDisabled) {
      alert('此店鋪暫未開放充值');
      return;
    }
    const amount = parseFloat(customAmount);
    const points = Math.floor(amount);

    if (!Number.isFinite(amount) || amount < 100) {
      alert('充值金額最少需要 HK$100');
      return;
    }
    if (points < 100) {
      alert('充值積分最少需要 100 分');
      return;
    }

    await checkout({
      name: '自定義充值',
      points,
      amount,
      description: '1分 = 1元，充值後立即可用',
    });
  };

  const card = 'bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6';
  const customPointsPreview = Math.floor(parseFloat(customAmount) || 0);
  const customValid = Number.isFinite(parseFloat(customAmount)) && parseFloat(customAmount) >= 100;

  return (
    <PickCourtMemberLayout
      title="充值積分"
      subtitle={
        isStoreMode
          ? `${storeLabel} · 店鋪專用積分 · 1 分 = HK$1`
          : 'PickCourt 平台積分 · 可於聯盟各店使用 · 1 分 = HK$1'
      }
    >
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (
        <div className="space-y-6">
          {fromBooking && insufficientBalance && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              預約積分不足。建議先充值 PickCourt 平台積分（全聯盟通用），或充值特定店鋪積分。
            </div>
          )}

          {storeRechargeDisabled && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 space-y-3">
              <p>
                <span className="font-medium text-pickcourt-navy">{storeLabel}</span>{' '}
                暫未開放會員充值。你仍可充值 PickCourt 平台積分（聯盟各店可用）。
              </p>
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="inline-flex items-center rounded-lg bg-pickcourt-gold px-4 py-2 font-semibold text-pickcourt-navy-dark hover:bg-pickcourt-gold-light"
              >
                改充 PickCourt 平台積分
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {isStoreMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="text-pickcourt-navy hover:text-pickcourt-gold"
                >
                  ← 改充 PickCourt 平台積分
                </button>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">店鋪專用，不可跨店</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <GlobeAltIcon className="w-4 h-4 text-pickcourt-gold" />
                預設充值 PickCourt 平台積分
              </span>
            )}
          </div>

          {balance != null && (
            <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-sm text-gray-500">
                  {isStoreMode ? `${storeLabel} 店鋪餘額` : 'PickCourt 平台餘額'}
                </p>
                <p className="text-2xl font-bold text-pickcourt-navy">{balance} 分</p>
                {isStoreMode && platformBalance != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    另可用平台積分 {platformBalance} 分（預約時合計可用 {balance + platformBalance} 分）
                  </p>
                )}
              </div>
              <Link
                to={`${PICKCOURT_ACCOUNT.balance}${isStoreMode ? `?store=${storeSlug}` : ''}`}
                className="text-sm font-medium text-pickcourt-navy hover:text-pickcourt-gold"
              >
                查看交易記錄 →
              </Link>
            </div>
          )}

          {!storeRechargeDisabled && (
          <>
          <div className="grid sm:grid-cols-2 gap-4">
            {options.map((opt) => (
              <div key={opt._id || opt.name} className={card}>
                <div className="flex items-start gap-3">
                  <CreditCardIcon className="w-8 h-8 text-pickcourt-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-pickcourt-navy">{opt.name}</h3>
                    <p className="text-2xl font-bold text-pickcourt-gold mt-1">{opt.points} 分</p>
                    <p className="text-sm text-gray-500">HK${opt.amount}</p>
                    {opt.description && (
                      <p className="text-xs text-gray-400 mt-2">{opt.description}</p>
                    )}
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => checkout(opt)}
                      className="mt-4 w-full py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light disabled:opacity-50 transition-colors"
                    >
                      選擇此方案
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {options.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              {isStoreMode ? '此店暫無固定方案，可使用下方自定義金額' : '暫無固定方案，可使用下方自定義金額'}
            </p>
          )}

          <div className={`${card} text-center`}>
            <h3 className="text-xl font-bold text-pickcourt-navy mb-2">自定義充值金額</h3>
            <p className="text-gray-500 mb-6">最少充值HK$100，1分 = 1元</p>

            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="bg-slate-100 hover:bg-slate-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
              >
                輸入自定義金額
              </button>
            ) : (
              <div className="max-w-md mx-auto text-left">
                <label className="block text-sm font-medium text-gray-700 mb-2">充值金額 (HK$)</label>
                <input
                  type="number"
                  min={100}
                  step={1}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="請輸入充值金額，最少HK$100"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pickcourt-gold focus:border-pickcourt-gold"
                />
                <p className="text-sm text-gray-500 mt-1">將獲得 {customPointsPreview} 積分</p>

                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">快速添加：</p>
                  <div className="flex gap-2">
                    {[1000, 500, 200].map((add) => (
                      <button
                        key={add}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(customAmount) || 0;
                          setCustomAmount(String(current + add));
                        }}
                        className="flex-1 px-3 py-2 text-sm font-medium text-pickcourt-navy bg-pickcourt-gold/10 border border-pickcourt-gold/30 rounded-lg hover:bg-pickcourt-gold/20 transition-colors"
                      >
                        +{add}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomAmount('');
                    }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-gray-700 font-medium py-3 px-6 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCustomRecharge()}
                    disabled={processing || !customValid}
                    className={`flex-1 py-3 px-6 rounded-lg font-semibold transition-colors ${
                      processing || !customValid
                        ? 'bg-gray-300 text-white cursor-not-allowed'
                        : 'bg-pickcourt-gold text-pickcourt-navy-dark hover:bg-pickcourt-gold-light'
                    }`}
                  >
                    {processing ? '處理中...' : '立即充值'}
                  </button>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          {!isStoreMode && rechargeableStores.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-pickcourt-navy mb-3">或充值特定店鋪積分</h3>
              <p className="text-xs text-gray-500 mb-4">店鋪積分僅限該店使用，不可跨店或於 PickCourt 使用。</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {rechargeableStores.map((store) => (
                  <button
                    key={store.slug}
                    type="button"
                    onClick={() => setSearchParams({ store: store.slug })}
                    className={`${card} text-left hover:border-pickcourt-gold transition-colors py-4`}
                  >
                    <BuildingStorefrontIcon className="w-6 h-6 text-pickcourt-gold mb-1" />
                    <h4 className="font-medium text-pickcourt-navy">{store.displayName || store.name}</h4>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PickCourtMemberLayout>
  );
};

export default AccountRecharge;
