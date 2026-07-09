import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UserCircleIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import SEO from '../components/SEO/SEO';
import { PICKCOURT_ACCOUNT } from '../utils/pickcourtRoutes';

const tabs = [
  { to: PICKCOURT_ACCOUNT.bookings, label: '我的預約', icon: CalendarDaysIcon },
  { to: PICKCOURT_ACCOUNT.profile, label: '個人資料', icon: UserCircleIcon },
  { to: PICKCOURT_ACCOUNT.balance, label: '積分餘額', icon: CurrencyDollarIcon },
  { to: PICKCOURT_ACCOUNT.recharge, label: '充值', icon: CreditCardIcon },
  { to: PICKCOURT_ACCOUNT.orders, label: '訂單記錄', icon: ShoppingBagIcon },
];

type Props = {
  title: string;
  subtitle?: string;
  seoDescription?: string;
  children: React.ReactNode;
};

const PickCourtMemberLayout: React.FC<Props> = ({ title, subtitle, seoDescription, children }) => {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SEO
        title={title}
        description={seoDescription || `${title} · PickCourt 會員中心`}
        url={pathname}
        noindex
      />
      <PickleCourtNav />
      <div className="flex-1 pt-20 lg:pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-pickcourt-navy">{title}</h1>
            {subtitle && <p className="mt-1 text-gray-600">{subtitle}</p>}
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="lg:w-56 shrink-0">
              <nav className="bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-2 space-y-1">
                {tabs.map(({ to, label, icon: Icon }) => {
                  const active = pathname === to || pathname.startsWith(`${to}/`);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-pickcourt-gold/15 text-pickcourt-navy border border-pickcourt-gold/30'
                          : 'text-gray-600 hover:bg-slate-50 hover:text-pickcourt-navy'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
            </aside>

            <div className="flex-1 min-w-0">{children}</div>
          </div>
        </div>
      </div>
      <PickleCourtFooter />
    </div>
  );
};

export default PickCourtMemberLayout;
