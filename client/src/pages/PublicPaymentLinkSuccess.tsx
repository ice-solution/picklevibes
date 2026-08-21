import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

const PublicPaymentLinkSuccess: React.FC = () => {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [amount, setAmount] = useState<number | null>(null);
  const [title, setTitle] = useState('');

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

          try {
            const detail = await axios.get(`/payment-links/public/payments/${paymentId}`);
            setTitle(detail.data.payment?.link?.title || '');
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

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border max-w-md w-full p-8 text-center">
        {ok ? (
          <CheckCircleIcon className="w-14 h-14 text-green-600 mx-auto mb-4" />
        ) : (
          <ClockIcon className="w-14 h-14 text-amber-500 mx-auto mb-4" />
        )}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {ok ? '付款成功' : '付款處理中'}
        </h1>
        {title && <p className="text-gray-600 mb-1">{title}</p>}
        {amount != null && (
          <p className="text-lg font-semibold text-gray-900 mb-4">
            HK${Number(amount).toFixed(2)}
          </p>
        )}
        <p className="text-sm text-gray-500 mb-6">
          {ok
            ? '感謝您的付款。'
            : '若尚未顯示成功，請稍候數分鐘；付款確認後系統會自動入帳。'}
        </p>
        <div className="flex flex-col gap-2">
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
