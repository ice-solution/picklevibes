import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type PublicLink = {
  code: string;
  title: string;
  description: string;
  amount: number;
  pointsAmount: number;
  listAmount?: number;
  listPointsAmount?: number;
  athleteDiscountApplied?: boolean;
  monthlyPassApplied?: boolean;
  purpose?: 'activity' | 'sell_pass';
  isReclub?: boolean;
  sessionStart?: string;
  sessionEnd?: string;
  store?: { name: string; slug: string };
  expiresAt?: string | null;
  isActive: boolean;
};

type PayMethod = 'gateway' | 'points';

const PublicPaymentLink: React.FC = () => {
  const { code = '' } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = !!user;

  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<PublicLink | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>('gateway');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setBlocked(false);
      try {
        const res = await axios.get(`/payment-links/public/${encodeURIComponent(code)}`);
        setLink(res.data.link);
      } catch (e: any) {
        const msg = e.response?.data?.message || '找不到收款連結';
        setError(msg);
        if (e.response?.data?.link) setLink(e.response.data.link);
        if (e.response?.status === 403) setBlocked(true);
      } finally {
        setLoading(false);
      }
    };
    if (code && !authLoading) void load();
  }, [code, user?.id, authLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      setBalance(null);
      setPayMethod('gateway');
      return;
    }
    const loadBal = async () => {
      try {
        const res = await axios.get('/recharge/balance');
        setBalance(res.data.balance ?? 0);
      } catch {
        setBalance(null);
      }
    };
    void loadBal();
  }, [isAuthenticated]);

  const displayPrice = useMemo(() => {
    if (!link) return 0;
    if (!isAuthenticated) return Number(link.amount);
    return payMethod === 'points' ? Number(link.pointsAmount) : Number(link.amount);
  }, [link, payMethod, isAuthenticated]);

  const pointsInsufficient =
    isAuthenticated &&
    payMethod === 'points' &&
    balance != null &&
    balance < displayPrice;

  const handlePay = async () => {
    if (!link) return;

    if (link.purpose === 'sell_pass' && !isAuthenticated) {
      alert('購買月卡請先登入');
      return;
    }

    if (!isAuthenticated) {
      if (!contactEmail.trim()) {
        alert('請填寫電郵，以便發送付款記錄與發票');
        return;
      }
      if (!contactPhone.trim()) {
        alert('請填寫電話，以便發送付款記錄與發票');
        return;
      }
    }

    const isFree = Number(displayPrice) <= 0;

    if (isAuthenticated && (payMethod === 'points' || isFree)) {
      if (
        !window.confirm(
          isFree
            ? `確認使用月卡免費完成「${link.title}」？`
            : `確認使用 ${displayPrice} 積分支付「${link.title}」？`
        )
      ) {
        return;
      }
      setBusy(true);
      try {
        if (isFree && payMethod === 'gateway') {
          const res = await axios.post(`/payment-links/public/${link.code}/pay-gateway`, {});
          if (res.data.free && res.data.paymentId) {
            navigate(
              `/pay/${link.code}/success?payment_id=${res.data.paymentId}&provider=points`
            );
            return;
          }
        }
        const res = await axios.post(`/payment-links/public/${link.code}/pay-points`, {});
        navigate(`/pay/${link.code}/success?payment_id=${res.data.payment._id}&provider=points`);
      } catch (e: any) {
        alert(e.response?.data?.message || '付款失敗');
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const res = await axios.post(`/payment-links/public/${link.code}/pay-gateway`, {
        ...(isAuthenticated
          ? {}
          : {
              contactEmail: contactEmail.trim(),
              contactPhone: contactPhone.trim(),
            }),
      });
      if (res.data.free && res.data.paymentId) {
        navigate(
          `/pay/${link.code}/success?payment_id=${res.data.paymentId}&provider=points`
        );
        return;
      }
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        alert('未能取得付款網址');
      }
    } catch (e: any) {
      alert(e.response?.data?.message || '建立付款失敗');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-600">載入中…</div>
    );
  }

  if (!link && error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 mb-2">無法開啟收款連結</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <Link to="/" className="text-primary-600 hover:underline">
          返回首頁
        </Link>
      </div>
    );
  }

  if (!link) return null;

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-slate-50 to-white py-10 px-4">
      <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b bg-slate-50">
          {link.store?.name && (
            <p className="text-xs text-gray-500 mb-1">{link.store.name}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{link.title}</h1>
          {link.purpose === 'sell_pass' && (
            <p className="mt-1 text-sm text-indigo-700 font-medium">此連結用於購買月卡</p>
          )}
          {(link.isReclub || (link.sessionStart && link.sessionEnd)) && (
            <p className="mt-1 text-xs text-gray-500">
              {link.isReclub ? 'Reclub' : '活動時段'}
              {link.sessionStart && link.sessionEnd
                ? ` · ${link.sessionStart} – ${link.sessionEnd}`
                : ''}
            </p>
          )}
          {link.description && (
            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{link.description}</p>
          )}
        </div>

        <div className="px-6 py-6 space-y-6">
          {blocked ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              {error || '此連結目前無法付款'}
            </div>
          ) : (
            <>
              {link.purpose === 'sell_pass' && !isAuthenticated && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-sm text-indigo-900">
                  購買月卡必須登入。
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/pay/${link.code}` } }}
                    className="text-primary-600 hover:underline ml-1"
                  >
                    前往登入
                  </Link>
                </div>
              )}

              {!isAuthenticated && link.purpose !== 'sell_pass' && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-gray-700">
                  未登入亦可線上付款。請填寫電郵與電話，我們會把付款記錄與發票寄給你。
                  <p className="text-xs text-gray-500 mt-1">
                    已有帳戶？
                    <Link
                      to="/login"
                      state={{ from: { pathname: `/pay/${link.code}` } }}
                      className="text-primary-600 hover:underline ml-1"
                    >
                      登入後可用積分付款
                    </Link>
                  </p>
                </div>
              )}

              {link.monthlyPassApplied && (
                <div className="rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm text-teal-900">
                  月卡優惠：此連結已全免
                  {link.listAmount != null && Number(link.listAmount) > 0 && (
                    <span className="ml-2">
                      （原價 HK${Number(link.listAmount).toFixed(2)}）
                    </span>
                  )}
                </div>
              )}

              {link.athleteDiscountApplied && !link.monthlyPassApplied && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                  選手優惠：此連結已套用半價
                  {link.listAmount != null && link.listAmount !== link.amount && (
                    <span className="ml-2 text-emerald-700">
                      （原價 HK${Number(link.listAmount).toFixed(2)}）
                    </span>
                  )}
                </div>
              )}

              {isAuthenticated && Number(link.amount) > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    付款方式
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PayMethod)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="gateway">
                      線上付款（HK${Number(link.amount).toFixed(2)}）
                    </option>
                    <option value="points">
                      積分付款（{Number(link.pointsAmount)} 積分）
                    </option>
                  </select>
                  {payMethod === 'points' && balance != null && (
                    <p className="text-xs text-gray-500 mt-1.5">目前餘額：{balance} 積分</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">
                    將以帳戶資料付款：{user?.name}
                    {user?.email ? ` · ${user.email}` : ''}
                    {user?.phone ? ` · ${user.phone}` : ''}
                  </p>
                </div>
              ) : isAuthenticated ? (
                <p className="text-sm text-gray-600">
                  已登入：{user?.name}
                  {user?.email ? ` · ${user.email}` : ''}
                </p>
              ) : link.purpose === 'sell_pass' ? null : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    付款方式：線上付款（正價）
                  </p>
                  <label className="block text-sm font-medium text-gray-700">
                    電郵 <span className="text-red-500">*</span>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="用於接收發票"
                      required
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    電話 <span className="text-red-500">*</span>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="聯絡電話"
                      required
                    />
                  </label>
                </div>
              )}

              <div className="flex items-end justify-between border-t pt-4">
                <span className="text-sm text-gray-500">
                  {Number(displayPrice) <= 0
                    ? '應付'
                    : isAuthenticated && payMethod === 'points'
                      ? '應付積分'
                      : '應付金額'}
                </span>
                <span className="text-3xl font-bold text-gray-900">
                  {Number(displayPrice) <= 0
                    ? '免費'
                    : isAuthenticated && payMethod === 'points'
                      ? `${displayPrice} 分`
                      : `HK$${displayPrice.toFixed(2)}`}
                </span>
              </div>

              {pointsInsufficient && (
                <p className="text-sm text-red-600">積分不足，請先充值或改選線上付款</p>
              )}

              <button
                type="button"
                disabled={
                  busy ||
                  pointsInsufficient ||
                  (link.purpose === 'sell_pass' && !isAuthenticated)
                }
                onClick={() => void handlePay()}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {busy
                  ? '處理中…'
                  : Number(displayPrice) <= 0
                    ? '確認免費完成'
                    : isAuthenticated && payMethod === 'points'
                      ? `確認以 ${displayPrice} 積分支付`
                      : `確認線上付款 HK$${displayPrice.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicPaymentLink;
