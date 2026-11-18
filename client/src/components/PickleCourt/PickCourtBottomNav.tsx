import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  CalendarDaysIcon,
  FireIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeSolid,
  CalendarDaysIcon as CalendarSolid,
  FireIcon as FireSolid,
  UserCircleIcon as UserSolid,
} from '@heroicons/react/24/solid';
import {
  PICKCOURT_HOME,
  PICKCOURT_BOOK,
  PICKCOURT_ACTIVITIES,
  PICKCOURT_ME,
  PICKCOURT_ACCOUNT,
} from '../../utils/pickcourtRoutes';

const tabs = [
  { to: PICKCOURT_HOME, label: '首頁', match: (p: string) => p === '/' || p === '/search', Icon: HomeIcon, IconActive: HomeSolid },
  { to: PICKCOURT_BOOK, label: '訂場', match: (p: string) => p === PICKCOURT_BOOK || p.startsWith(`${PICKCOURT_BOOK}/`), Icon: CalendarDaysIcon, IconActive: CalendarSolid },
  {
    to: PICKCOURT_ACTIVITIES,
    label: '活動',
    match: (p: string) =>
      p === PICKCOURT_ACTIVITIES || p.startsWith(`${PICKCOURT_ACTIVITIES}/`) || p.startsWith('/tournaments'),
    Icon: FireIcon,
    IconActive: FireSolid,
  },
  {
    to: PICKCOURT_ME,
    label: '我的',
    match: (p: string) => p === PICKCOURT_ME || p.startsWith(PICKCOURT_ACCOUNT.root),
    Icon: UserCircleIcon,
    IconActive: UserSolid,
  },
] as const;

/** 窄屏固定底欄：首頁｜訂場｜活動｜我的 */
const PickCourtBottomNav: React.FC = () => {
  const { pathname } = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-pickcourt-gold/25 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="主要導航"
    >
      <ul className="grid grid-cols-4 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = active ? tab.IconActive : tab.Icon;
          const to = tab.to;
          return (
            <li key={tab.label}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active ? 'text-pickcourt-navy' : 'text-gray-400'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'text-[#E11D48]' : ''}`} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default PickCourtBottomNav;
