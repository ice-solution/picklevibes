import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';
import { Link } from 'react-router-dom';

type RechargeOption = {
  _id?: string;
  name: string;
  points: number;
  amount: number;
  description: string;
};

const AccountRecharge: React.FC = () => {
  const [options, setOptions] = useState<RechargeOption[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [offersRes, balanceRes] = await Promise.all([
          axios.get('/recharge-offers'),
          axios.get('/recharge/balance'),
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const checkout = async (option: RechargeOption) => {
    const ok = window.confirm(
      `確認充值 ${option.points} 分（HK$${option.amount}）？\n\n退款將收取 8% 手續費。`
    );
    if (!ok) return;
    try {
      setProcessing(true);
      const res = await axios.post('/recharge/create-checkout-session', {
        points: option.points,
        amount: option.amount,
        rechargeOfferId: option._id || null,
        successUrl: `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}?success=1`,
        cancelUrl: `${window.location.origin}${PICKCOURT_ACCOUNT.recharge}`,
      });
      window.location.href = res.data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || '充值失敗，請稍後再試');
    } finally {
      setProcessing(false);
    }
  };

  const card = 'bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6';

  return (
    <PickCourtMemberLayout title="充值積分" subtitle="1 分 = HK$1，充值後可用於預約場地">
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
        </div>
      ) : (
        <div className="space-y-6">
          {balance != null && (
            <div className={`${card} flex items-center justify-between`}>
              <div>
                <p className="text-sm text-gray-500">當前餘額</p>
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
            <p className="text-center text-gray-500 py-8">暫無充值方案，請稍後再試</p>
          )}
        </div>
      )}
    </PickCourtMemberLayout>
  );
};

export default AccountRecharge;
