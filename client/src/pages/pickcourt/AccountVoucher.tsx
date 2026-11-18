import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';
import { Link } from 'react-router-dom';

type VoucherOffer = {
  _id?: string;
  name: string;
  points: number;
  amount: number;
  ticketCount?: number | null;
  faceValue?: number | null;
  description?: string;
};

function isPack(opt: VoucherOffer) {
  return Number(opt.ticketCount) > 0 && Number(opt.faceValue) > 0;
}

function bonusPoints(opt: VoucherOffer) {
  return Math.max(0, Number(opt.points) - Number(opt.amount));
}

/**
 * 平台兌換券＝後台「充值優惠」（store: null）。
 * 有張數／面額 → 外賣式券包；否則 → 付 X 得 Y 分（送 Z）。
 */
const AccountVoucher: React.FC = () => {
  const [offers, setOffers] = useState<VoucherOffer[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [offersRes, balanceRes] = await Promise.all([
        axios.get('/recharge-offers'),
        axios.get('/recharge/balance'),
      ]);
      setOffers((offersRes.data.offers || []) as VoucherOffer[]);
      setBalance(balanceRes.data?.balance ?? null);
    } catch (e) {
      console.error(e);
      setOffers([]);
      setBalance(null);
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e instanceof Error ? e.message : '載入失敗');
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const buy = async (option: VoucherOffer) => {
    const pack = isPack(option);
    const detail = pack
      ? `${option.ticketCount} 張 $${option.faceValue}（入帳 ${option.points} 分）`
      : `入帳 ${option.points} 平台積分`;
    const ok = window.confirm(
      `確認購買此充值優惠？\n\n${option.name}\n支付：HK$${option.amount}\n${detail}\n\n只限線上付款；可於聯盟各店訂場使用。\n退款將收取 8% 手續費。`
    );
    if (!ok) return;
    try {
      setProcessing(true);
      const res = await axios.post('/recharge/create-checkout-session', {
        points: option.points,
        amount: option.amount,
        rechargeOfferId: option._id || null,
        successUrl: `${window.location.origin}${PICKCOURT_ACCOUNT.vouchers}?success=1`,
        cancelUrl: `${window.location.origin}${PICKCOURT_ACCOUNT.vouchers}`,
      });
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '購買失敗，請稍後再試');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PickCourtMemberLayout
      title="購買兌換券"
      subtitle="平台充值優惠 · 只限線上付款 · 入帳為全聯盟通用積分"
    >
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">
          <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto mb-3" />
          <p>載入充值優惠…</p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-800">
          <p className="font-semibold">暫時載入唔到充值優惠</p>
          <p className="mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 rounded-lg bg-red-700 text-white px-4 py-2 font-semibold hover:bg-red-800"
          >
            再試一次
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            以下係平台<strong className="font-semibold text-pickcourt-navy">充值優惠</strong>
            （付費後入帳積分，訂場可用）。店內專用儲值請到
            <Link to={PICKCOURT_ACCOUNT.recharge} className="underline ml-1 font-medium text-pickcourt-navy">
              店鋪充值
            </Link>
            。
          </div>

          {balance != null && (
            <div className="bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">PickCourt 平台餘額</p>
                <p className="text-2xl font-bold text-pickcourt-navy tabular-nums">{balance} 分</p>
              </div>
              <Link
                to={PICKCOURT_ACCOUNT.balance}
                className="text-sm font-medium text-pickcourt-navy hover:text-pickcourt-gold"
              >
                查看交易記錄 →
              </Link>
            </div>
          )}

          {offers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-8 text-center text-sm text-gray-600">
              <p className="font-semibold text-pickcourt-navy">暫時未有充值優惠</p>
              <p className="mt-2">有新方案時會顯示喺呢度。</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {offers.map((opt) => {
                const pack = isPack(opt);
                const bonus = bonusPoints(opt);
                const packSave =
                  pack
                    ? Math.max(
                        0,
                        Number(opt.ticketCount) * Number(opt.faceValue) - Number(opt.amount)
                      )
                    : 0;

                return (
                  <li
                    key={opt._id || `${opt.name}-${opt.amount}`}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-pickcourt-gold/40 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-stretch">
                      <div className="flex-1 min-w-0 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-pickcourt-gold/20 text-pickcourt-navy">
                            充值優惠
                          </span>
                          {pack && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                              券包
                            </span>
                          )}
                          {bonus > 0 && !pack && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                              送 {bonus} 分
                            </span>
                          )}
                          {packSave > 0 && (
                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">
                              即省 ${packSave}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 font-bold text-pickcourt-navy text-base sm:text-lg">
                          {opt.name}
                        </h3>

                        {pack ? (
                          <p className="mt-2 text-xl sm:text-2xl font-bold text-pickcourt-gold tabular-nums">
                            {opt.ticketCount} 張 × ${opt.faceValue}
                          </p>
                        ) : (
                          <p className="mt-2 text-xl sm:text-2xl font-bold text-pickcourt-navy tabular-nums">
                            得 <span className="text-pickcourt-gold">{opt.points}</span> 平台積分
                          </p>
                        )}

                        <p className="mt-1.5 text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                          <span>
                            售價{' '}
                            <strong className="text-pickcourt-navy tabular-nums">
                              HK${opt.amount}
                            </strong>
                          </span>
                          {pack && (
                            <span className="text-slate-500">入帳 {opt.points} 分</span>
                          )}
                          {!pack && bonus > 0 && (
                            <span className="text-emerald-700 font-medium">
                              付 {opt.amount} · 多得 {bonus}
                            </span>
                          )}
                        </p>

                        {opt.description && (
                          <p className="mt-2 text-xs text-slate-400 line-clamp-2">{opt.description}</p>
                        )}
                      </div>

                      <div className="sm:w-44 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 p-4 sm:p-5 flex flex-col justify-center gap-2 bg-slate-50/60">
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                          <CreditCardIcon className="h-4 w-4" />
                          線上付款
                        </div>
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => void buy(opt)}
                          className="w-full py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light disabled:opacity-50 transition-colors"
                        >
                          購買此優惠
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </PickCourtMemberLayout>
  );
};

export default AccountVoucher;
