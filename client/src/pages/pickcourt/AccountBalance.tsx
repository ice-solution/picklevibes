import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  CurrencyDollarIcon,
  BuildingStorefrontIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';

type StoreBalanceItem = {
  store: { name?: string; slug?: string; branding?: { displayName?: string } };
  storeId: string;
  balance: number;
  totalRecharged: number;
  totalSpent: number;
};

type RelatedBookingInfo = {
  date: string;
  startTime: string;
  endTime: string;
  store?: {
    name?: string;
    slug?: string;
    branding?: { displayName?: string };
  };
  court?: { name?: string };
};

type BalanceData = {
  mode?: 'store' | 'platform';
  balance: number;
  platformBalance?: number;
  availableForBooking?: number;
  totalRecharged: number;
  totalSpent: number;
  store?: { id: string; name: string; slug: string };
  storeBalances?: StoreBalanceItem[];
  transactions: Array<{
    type: string;
    amount: number;
    description: string;
    createdAt: string;
    relatedBooking?: RelatedBookingInfo;
  }>;
  pagination?: { current: number; pages: number; total: number };
};

function relatedBookingLabel(booking: RelatedBookingInfo): string {
  const storeName = booking.store?.branding?.displayName || booking.store?.name || '';
  const courtName = booking.court?.name || '';
  const place = [storeName, courtName].filter(Boolean).join(' · ');
  const when = booking.date
    ? `${new Date(booking.date).toLocaleDateString('zh-TW')} ${booking.startTime || ''}–${booking.endTime || ''}`
    : '';
  return [place, when].filter(Boolean).join(' · ');
}

const AccountBalance: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const storeSlug = searchParams.get('store') || '';
  const [data, setData] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);

  const load = async (p = 1, store?: string) => {
    try {
      if (p === 1) setLoading(true);
      else setLoadingPage(true);
      const storeParam = store ? `&store=${encodeURIComponent(store)}` : '';
      const res = await axios.get(`/recharge/balance?page=${p}&limit=10${storeParam}`);
      setData(res.data);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    void load(1, storeSlug || undefined);
  }, [storeSlug]);

  const transactions = useMemo(() => {
    if (!data?.transactions) return [];
    return [...data.transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data]);

  const card = 'bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6';
  const storeLabel = data?.store?.name || storeSlug;

  if (!storeSlug && data?.mode === 'platform') {
    return (
      <PickCourtMemberLayout title="積分餘額" subtitle="PickCourt 平台積分 + 各店專用積分">
        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`${card} bg-gradient-to-br from-pickcourt-navy to-pickcourt-navy-light text-white`}>
              <div className="flex items-center gap-2 text-white/70 text-sm">
                <GlobeAltIcon className="w-4 h-4" />
                PickCourt 平台積分
              </div>
              <p className="text-4xl font-bold mt-1 text-pickcourt-gold">{data.balance} 分</p>
              <p className="text-sm text-white/70 mt-2">可於聯盟各店預約使用</p>
              <div className="flex flex-wrap gap-6 mt-4 text-sm text-white/80">
                <span>累計充值 {data.totalRecharged} 分</span>
                <span>累計消費 {data.totalSpent} 分</span>
              </div>
              <Link
                to={PICKCOURT_ACCOUNT.recharge}
                className="inline-flex mt-6 px-5 py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light transition-colors"
              >
                充值平台積分
              </Link>
            </div>

            {(data.storeBalances || []).length > 0 && (
              <div>
                <h2 className="font-bold text-pickcourt-navy mb-3">各店專用積分</h2>
                <p className="text-sm text-gray-500 mb-4">僅限該店使用，不可跨店</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(data.storeBalances || []).map((item) => {
                    const slug = item.store?.slug || '';
                    const name = item.store?.branding?.displayName || item.store?.name || '店鋪';
                    return (
                      <button
                        key={item.storeId}
                        type="button"
                        onClick={() => setSearchParams({ store: slug })}
                        className={`${card} text-left hover:border-pickcourt-gold transition-colors`}
                      >
                        <BuildingStorefrontIcon className="w-8 h-8 text-pickcourt-gold mb-2" />
                        <h3 className="font-bold text-pickcourt-navy">{name}</h3>
                        <p className="text-2xl font-bold text-pickcourt-gold mt-1">{item.balance} 分</p>
                        <p className="text-xs text-gray-500 mt-1">
                          充值 {item.totalRecharged} · 消費 {item.totalSpent}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {transactions.length > 0 && (
              <div className={card}>
                <h2 className="font-bold text-pickcourt-navy mb-4">平台交易記錄</h2>
                <ul className="divide-y divide-slate-100">
                  {transactions.map((tx, i) => (
                    <li key={i} className="py-4 flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{tx.description}</p>
                        {tx.relatedBooking && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {relatedBookingLabel(tx.relatedBooking)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(tx.createdAt).toLocaleString('zh-TW')}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {tx.amount > 0 ? '+' : ''}
                        {tx.amount} 分
                      </span>
                    </li>
                  ))}
                </ul>
                {data.pagination && data.pagination.pages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
                    <button
                      type="button"
                      disabled={page <= 1 || loadingPage}
                      onClick={() => load(page - 1)}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                    >
                      上一頁
                    </button>
                    <span className="px-3 py-1.5 text-sm text-gray-600">
                      {page} / {data.pagination.pages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= data.pagination.pages || loadingPage}
                      onClick={() => load(page + 1)}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                    >
                      下一頁
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PickCourtMemberLayout>
    );
  }

  return (
    <PickCourtMemberLayout
      title="積分餘額"
      subtitle={storeLabel ? `${storeLabel} 店鋪積分` : '查看餘額與交易記錄'}
    >
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="text-sm text-pickcourt-navy hover:text-pickcourt-gold"
          >
            ← 返回平台積分總覽
          </button>

          <div className={`${card} bg-gradient-to-br from-pickcourt-navy to-pickcourt-navy-light text-white`}>
            <p className="text-white/70 text-sm">{storeLabel || '當前'}店鋪餘額</p>
            <p className="text-4xl font-bold mt-1 text-pickcourt-gold">{data.balance} 分</p>
            {typeof data.platformBalance === 'number' && (
              <p className="text-sm text-white/70 mt-2">
                另可用 PickCourt 平台積分 {data.platformBalance} 分
                {typeof data.availableForBooking === 'number' && (
                  <> · 預約合計可用 {data.availableForBooking} 分</>
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-6 mt-4 text-sm text-white/80">
              <span>累計充值 {data.totalRecharged} 分</span>
              <span>累計消費 {data.totalSpent} 分</span>
            </div>
            <Link
              to={`${PICKCOURT_ACCOUNT.recharge}?store=${storeSlug}`}
              className="inline-flex mt-6 px-5 py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light transition-colors"
            >
              充值此店積分
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: '累計充值', value: data.totalRecharged, icon: ArrowDownCircleIcon, color: 'text-emerald-600' },
              { label: '累計消費', value: data.totalSpent, icon: ArrowUpCircleIcon, color: 'text-red-500' },
              { label: '店鋪餘額', value: data.balance, icon: CurrencyDollarIcon, color: 'text-pickcourt-navy' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className={card}>
                <Icon className={`w-8 h-8 ${color} mb-2`} />
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value} 分</p>
              </div>
            ))}
          </div>

          <div className={card}>
            <h2 className="font-bold text-pickcourt-navy mb-4">店鋪交易記錄</h2>
            {transactions.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">暫無交易</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {transactions.map((tx, i) => (
                  <li key={i} className="py-4 flex justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{tx.description}</p>
                      {tx.relatedBooking && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {relatedBookingLabel(tx.relatedBooking)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(tx.createdAt).toLocaleString('zh-TW')}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold ${
                        tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount} 分
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.pagination && data.pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <button
                  type="button"
                  disabled={page <= 1 || loadingPage}
                  onClick={() => load(page - 1, storeSlug || undefined)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >
                  上一頁
                </button>
                <span className="px-3 py-1.5 text-sm text-gray-600">
                  {page} / {data.pagination.pages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.pagination.pages || loadingPage}
                  onClick={() => load(page + 1, storeSlug || undefined)}
                  className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40"
                >
                  下一頁
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-gray-500">無法載入餘額資料</p>
      )}
    </PickCourtMemberLayout>
  );
};

export default AccountBalance;
