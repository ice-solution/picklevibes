import React from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UserCircleIcon,
  CurrencyDollarIcon,
  TicketIcon,
  CreditCardIcon,
  ShoppingBagIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import PickleCourtNav from '../../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../../components/PickleCourt/PickleCourtFooter';
import SEO from '../../components/SEO/SEO';
import { useAuth } from '../../contexts/AuthContext';
import { PICKCOURT_ACCOUNT, PICKCOURT_BOOK, PICKCOURT_HOME } from '../../utils/pickcourtRoutes';
import {
  getMembershipBadgeClass,
  getMembershipTierLabel,
  resolveDisplayMembership,
} from '../../utils/membershipDisplay';

const primaryLinks = [
  { to: PICKCOURT_ACCOUNT.bookings, label: '我的預約', desc: '查看、管理已訂場次', icon: CalendarDaysIcon },
  {
    to: PICKCOURT_ACCOUNT.vouchers,
    label: '購買兌換券',
    desc: '全聯盟通用 · 付 80 得 100',
    icon: TicketIcon,
  },
  { to: PICKCOURT_ACCOUNT.balance, label: '積分餘額', desc: '平台積分與交易記錄', icon: CurrencyDollarIcon },
];

const secondaryLinks = [
  { to: PICKCOURT_ACCOUNT.recharge, label: '店鋪充值', desc: '只限指定店舖使用', icon: CreditCardIcon },
  { to: PICKCOURT_ACCOUNT.orders, label: '訂單記錄', desc: '商城及其他訂單', icon: ShoppingBagIcon },
  { to: PICKCOURT_ACCOUNT.profile, label: '個人資料／設定', desc: '帳戶與會員資料', icon: UserCircleIcon },
];

const PickCourtMe: React.FC = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-0 flex flex-col">
      <SEO title="我的 | PickCourt" description="會員中心入口" url="/me" noindex />
      <PickleCourtNav />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-24 lg:pt-28 pb-10">
        <h1 className="text-2xl font-bold text-pickcourt-navy mb-6">我的</h1>

        {loading && (
          <div className="py-12 text-center text-sm text-gray-500">
            <div className="inline-block h-8 w-8 border-2 border-pickcourt-gold border-t-transparent rounded-full animate-spin mb-3" />
            <p>載入帳戶…</p>
          </div>
        )}

        {!loading && !user && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-gradient-to-br from-pickcourt-navy to-pickcourt-navy-light text-white p-6 shadow-lg">
              <p className="text-lg font-bold">登入後繼續訂場、買券</p>
              <p className="mt-2 text-sm text-white/75">
                可先匿名搜尋同睇全日格；付款或買券前先登入，登入後會回到你揀嘅場／時段。
              </p>
              <Link
                to="/login"
                state={{ from: { pathname: PICKCOURT_ACCOUNT.bookings } }}
                className="mt-5 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-pickcourt-gold text-pickcourt-navy-dark font-bold py-3 hover:bg-pickcourt-gold-light transition-colors"
              >
                球友登入
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                state={{ from: { pathname: PICKCOURT_ACCOUNT.bookings } }}
                className="mt-2 block text-center text-sm text-white/80 hover:text-white underline"
              >
                未有帳戶？註冊
              </Link>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <TicketIcon className="h-8 w-8 text-emerald-700 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-900">平台兌換券 · 付 80 得 100</p>
                  <p className="text-sm text-emerald-800 mt-1">
                    全聯盟通用（線上付款入帳為平台積分）。店鋪充值則只限該店使用。
                  </p>
                  <Link
                    to="/login"
                    state={{ from: { pathname: PICKCOURT_ACCOUNT.vouchers } }}
                    className="inline-flex mt-3 text-sm font-semibold text-emerald-900 underline"
                  >
                    登入後購買 →
                  </Link>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link
                to={PICKCOURT_HOME}
                className="flex-1 text-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-pickcourt-navy"
              >
                去搵場
              </Link>
              <Link
                to={PICKCOURT_BOOK}
                className="flex-1 text-center rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-pickcourt-navy"
              >
                直接訂場
              </Link>
            </div>
          </div>
        )}

        {!loading && user && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white border border-pickcourt-gold/25 p-5 shadow-sm">
              <p className="font-bold text-lg text-pickcourt-navy">{user.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
              {(() => {
                const m = resolveDisplayMembership(user);
                return (
                  <span
                    className={`mt-3 inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getMembershipBadgeClass(
                      m.tier,
                      m.isVipActive
                    )}`}
                  >
                    {getMembershipTierLabel(m.tier, m.isVipActive)}
                  </span>
                );
              })()}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">常用</p>
              <ul className="space-y-2">
                {primaryLinks.map(({ to, label, desc, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex items-center gap-3 rounded-xl bg-white border border-gray-200 px-4 py-3.5 hover:border-pickcourt-gold/50 transition-colors"
                    >
                      <Icon className="h-6 w-6 text-pickcourt-gold shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-pickcourt-navy">{label}</span>
                        <span className="block text-xs text-gray-500">{desc}</span>
                      </span>
                      <ArrowRightIcon className="h-4 w-4 text-gray-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">更多</p>
              <ul className="space-y-1.5">
                {secondaryLinks.map(({ to, label, desc, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white transition-colors"
                    >
                      <Icon className="h-5 w-5 text-gray-400 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium text-pickcourt-navy/80">{label}</span>
                        <span className="block text-xs text-gray-400">{desc}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="hidden lg:block mt-auto">
        <PickleCourtFooter />
      </div>
    </div>
  );
};

export default PickCourtMe;
