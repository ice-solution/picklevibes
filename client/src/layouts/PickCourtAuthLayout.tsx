import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import { PICKCOURT_HOME } from '../utils/pickcourtRoutes';

type PickCourtAuthLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
};

/**
 * PickCourt 會員登入／註冊版面（非店鋪白標登入）
 */
const PickCourtAuthLayout: React.FC<PickCourtAuthLayoutProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-pickcourt-navy/[0.03] text-pickcourt-navy">
      <PickleCourtNav />
      <div className="flex-1 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
          <Link to={PICKCOURT_HOME} className="inline-flex items-center justify-center">
            <img
              src="/pickcourt_logo.jpg"
              alt="PickCourt"
              className="h-14 w-auto object-contain"
            />
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-pickcourt-navy">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-slate-600">{subtitle}</div>}
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-pickcourt-gold/20">
            {children}
          </div>
        </div>
      </div>
      <PickleCourtFooter />
    </div>
  );
};

export default PickCourtAuthLayout;
