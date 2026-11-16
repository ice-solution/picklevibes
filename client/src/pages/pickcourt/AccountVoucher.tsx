import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { TicketIcon } from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';
import { Link } from 'react-router-dom';

type VoucherOffer = {
  _id?: string;
  name: string;
  points: number;
  amount: number;
  description?: string;
};

/**
 * 平台統一「購買兌換券」：本質係平台積分充值換皮（只限線上付款）。
 * 例：付 HK$80 → 入帳 100 分。
 */
const AccountVoucher: React.FC = () => {
  const [offers, setOffers] = useState<VoucherOffer[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [offersRes, balanceRes] = await Promise.all([
          axios.get('/recharge-offers'),
          axios.get('/recharge/balance'),
        ]);
        const list = (offersRes.data.offers || []) as VoucherOffer[];
        // 優先顯示「付少過面額」嘅券；冇就顯示全部平台方案
        const bonus = list.filter((o) => Number(o.points) > Number(o.amount));
        setOffers(bonus.length > 0 ? bonus : list);
        setBalance(balanceRes.data?.balance ?? null);
      } catch (e) {
        console.error(e);
        setOffers([]);
        setBalance(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const highlight = useMemo(
    () => offers.find((o) => Number(o.amount) === 80 && Number(o.points) === 100) || offers[0],
    [offers]
  );

  const buy = async (option: VoucherOffer) => {
    const ok = window.confirm(
      `確認購買兌換券？\n\n支付：HK$${option.amount}\n面額：${option.points} 分\n\n只限線上付款；入帳為 PickCourt 平台積分，可於聯盟各店預約使用。\n退款將收取 8% 手續費。`
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

  const card = 'bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6';

  return (
    <PickCourtMemberLayout
      title="購買兌換券"
      subtitle="平台統一發售 · 只限線上付款 · 入帳為 PickCourt 平台積分"
    >
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
            <p className="font-semibold">買 80 蚊 = 100 蚊券</p>
            <p className="mt-1">
              以優惠價購買平台積分券，可於聯盟各店訂場使用。各店鋪專用充值請改到
              <Link to={PICKCOURT_ACCOUNT.recharge} className="underline ml-1">
                充值頁
              </Link>
              。
            </p>
          </div>

          {balance != null && (
            <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <p className="text-sm text-gray-500">PickCourt 平台餘額</p>
                <p className="text-2xl font-bold text-pickcourt-navy">{balance} 分</p>
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
            <div className={`${card} text-sm text-gray-600`}>
              暫時未有可購買的兌換券方案。請稍後再試，或聯絡平台管理員於「充值優惠」新增平台方案（例如付
              80 得 100 分）。
              {highlight ? null : null}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {offers.map((opt) => {
                const save = Math.max(0, Number(opt.points) - Number(opt.amount));
                return (
                  <div key={opt._id || `${opt.name}-${opt.amount}`} className={card}>
                    <div className="flex items-start gap-3">
                      <TicketIcon className="w-8 h-8 text-pickcourt-gold shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-pickcourt-navy">{opt.name}</h3>
                        <p className="text-2xl font-bold text-pickcourt-gold mt-1">
                          {opt.points} 分券
                        </p>
                        <p className="text-sm text-gray-600">
                          售價 HK${opt.amount}
                          {save > 0 ? (
                            <span className="ml-2 text-emerald-700 font-medium">即省 {save}</span>
                          ) : null}
                        </p>
                        {opt.description && (
                          <p className="text-xs text-gray-400 mt-2">{opt.description}</p>
                        )}
                        <button
                          type="button"
                          disabled={processing}
                          onClick={() => void buy(opt)}
                          className="mt-4 w-full py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light disabled:opacity-50 transition-colors"
                        >
                          線上付款購買
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </PickCourtMemberLayout>
  );
};

export default AccountVoucher;
