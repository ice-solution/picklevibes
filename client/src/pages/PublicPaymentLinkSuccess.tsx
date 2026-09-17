import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircleIcon, ClockIcon, TicketIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

type MonthlyPassGrant = {
  granted?: boolean;
  planType?: string;
  name?: string;
  expiresAt?: string | null;
};

function formatExpiry(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-HK', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return String(iso);
  }
}

const PublicPaymentLinkSuccess: React.FC = () => {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [amount, setAmount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [monthlyPass, setMonthlyPass] = useState<MonthlyPassGrant | null>(null);

  useEffect(() => {
    const paymentId = searchParams.get('payment_id');
    const sessionId = searchParams.get('session_id');
    const provider = searchParams.get('provider') || '';

    const run = async () => {
      try {
        if (paymentId) {
          const res = await axios.get(
            `/payment-links/public/payments/${paymentId}/confirm`,
            { params: sessionId ? { session_id: sessionId } : {} }
          );
          setStatus(res.data.status || 'pending');
          setAmount(res.data.amount ?? null);
          if (res.data.monthlyPass) setMonthlyPass(res.data.monthlyPass);

          try {
            const detail = await axios.get(`/payment-links/public/payments/${paymentId}`);
            setTitle(detail.data.payment?.link?.title || '');
            if (detail.data.payment?.monthlyPass) {
              setMonthlyPass(detail.data.payment.monthlyPass);
            }
          } catch {
            /* ignore */
          }

          // Wonder：webhook 可能稍慢，短輪詢
          if (res.data.status !== 'completed' && provider === 'wonder') {
            for (let i = 0; i < 5; i += 1) {
              // eslint-disable-next-line no-await-in-loop
              await new Promise((r) => setTimeout(r, 1500));
              // eslint-disable-next-line no-await-in-loop
              const again = await axios.get(
                `/payment-links/public/payments/${paymentId}/confirm`
              );
              setStatus(again.data.status || 'pending');
              if (again.data.monthlyPass) setMonthlyPass(again.data.monthlyPass);
              if (again.data.status === 'completed') break;
            }
          }
        } else if (sessionId) {
          setStatus('completed');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">確認付款中…</p>
        </div>
      </div>
    );
  }

  const ok = status === 'completed';
  const passOpened = ok && monthlyPass?.granted && monthlyPass?.name;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center">
        {ok ? (
          <CheckCircleIcon className="w-14 h-14 text-green-600 mx-auto mb-4" />
        ) : (
          <ClockIcon className="w-14 h-14 text-amber-500 mx-auto mb-4" />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {passOpened ? '月卡已開通' : ok ? '付款成功' : '付款處理中'}
        </h1>
        {title && <p className="text-gray-600 mb-1">{title}</p>}
        {amount != null && (
          <p className="text-lg font-semibold text-gray-900 mb-4">
            {Number(amount) <= 0 ? '免費' : `HK$${Number(amount).toFixed(2)}`}
          </p>
        )}

        {passOpened && (
          <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4 text-left">
            <div className="flex items-center gap-2 text-teal-900 font-medium">
              <TicketIcon className="w-5 h-5" />
              {monthlyPass.name}
            </div>
            {monthlyPass.expiresAt ? (
              <p className="mt-2 text-sm text-teal-800">
                有效至{' '}
                <span className="font-semibold">{formatExpiry(monthlyPass.expiresAt)}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-teal-800">月卡權益已寫入你的帳戶。</p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-500 mb-6">
          {passOpened
            ? '之後符合條件的活動收款連結可免費使用。可隨時在個人資料查看月卡到期日。'
            : ok
              ? '感謝您的付款。'
              : '若尚未顯示成功，請稍候數分鐘；付款確認後系統會自動入帳。'}
        </p>
        <div className="flex flex-col gap-2">
          {user && (
            <Link
              to="/profile"
              className="inline-flex justify-center rounded-lg bg-teal-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-teal-700"
            >
              查看我的月卡
            </Link>
          )}
          <Link
            to={`/pay/${code}`}
            className="text-primary-600 hover:underline text-sm"
          >
            返回收款頁
          </Link>
          <Link to="/" className="text-gray-500 hover:underline text-sm">
            返回首頁
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PublicPaymentLinkSuccess;
