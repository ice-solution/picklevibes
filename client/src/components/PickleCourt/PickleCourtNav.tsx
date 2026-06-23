import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { PICKCOURT_HOME, pickcourtHomeHash } from '../../utils/pickcourtRoutes';
import { useAuth } from '../../contexts/AuthContext';
import {
  getMembershipBadgeClass,
  getMembershipTierLabel,
  resolveDisplayMembership,
} from '../../utils/membershipDisplay';

type NavLink =
  | { to: string; label: string }
  | { href: string; label: string };

const navLinks: NavLink[] = [
  { href: pickcourtHomeHash('search'), label: '搜尋場地' },
  { href: pickcourtHomeHash('platform'), label: '平台介紹' },
  { href: pickcourtHomeHash('venues'), label: '場地 SaaS' },
  { href: pickcourtHomeHash('players'), label: '球友聯盟' },
  { href: pickcourtHomeHash('how-it-works'), label: '運作方式' },
];

const linkClass =
  'text-sm font-medium text-pickcourt-navy hover:text-pickcourt-gold transition-colors';

function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className: string;
  onClick?: () => void;
}) {
  if ('to' in link) {
    return (
      <Link to={link.to} className={className} onClick={onClick}>
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} className={className} onClick={onClick}>
      {link.label}
    </a>
  );
}

function AuthActions({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className={`${compact ? 'h-9' : 'h-10'} w-24 bg-pickcourt-gold/10 rounded-lg animate-pulse`}
        aria-hidden
      />
    );
  }

  if (user) {
    const membership = resolveDisplayMembership(user);
    const tierLabel = getMembershipTierLabel(membership.tier, membership.isVipActive);
    const badgeClass = getMembershipBadgeClass(membership.tier, membership.isVipActive);

    return (
      <div className={`flex items-center ${compact ? 'flex-col gap-2 w-full' : 'gap-3'}`}>
        <Link
          to="/profile"
          onClick={onNavigate}
          className={`flex items-center gap-2 ${compact ? 'w-full justify-center py-2' : ''} text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold transition-colors`}
        >
          <UserCircleIcon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate max-w-[8rem]">{user.name}</span>
        </Link>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
        >
          {tierLabel}
        </span>
        {!compact && (
          <Link
            to="/balance"
            onClick={onNavigate}
            className="text-sm font-medium text-pickcourt-navy/70 hover:text-pickcourt-gold transition-colors"
          >
            餘額
          </Link>
        )}
      </div>
    );
  }

  return (
    <Link
      to="/login"
      onClick={onNavigate}
      className={`text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold transition-colors ${
        compact ? 'block py-2 text-center w-full' : 'px-4 py-2'
      }`}
    >
      球友登入
    </Link>
  );
}

const PickleCourtNav: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-b border-pickcourt-gold/20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link to={PICKCOURT_HOME} className="flex items-center gap-3 shrink-0">
            <img
              src="/pickcourt_logo.jpg"
              alt="PickCourt"
              className="h-10 w-auto lg:h-12 object-contain"
            />
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <NavItem
                key={'to' in link ? link.to : link.href}
                link={link}
                className={linkClass}
              />
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <AuthActions />
            <a
              href={pickcourtHomeHash('contact')}
              className="text-sm font-semibold bg-pickcourt-gold text-pickcourt-navy-dark px-5 py-2.5 rounded-lg hover:bg-pickcourt-gold-light transition-colors shadow-md"
            >
              場地合作
            </a>
          </div>

          <button
            type="button"
            className="lg:hidden p-2 text-pickcourt-navy"
            onClick={() => setOpen(!open)}
            aria-label="選單"
          >
            {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-pickcourt-gold/20 bg-white px-4 py-4 space-y-3">
          {navLinks.map((link) => (
            <NavItem
              key={'to' in link ? link.to : link.href}
              link={link}
              className="block text-pickcourt-navy font-medium py-2"
              onClick={() => setOpen(false)}
            />
          ))}
          <AuthActions compact onNavigate={() => setOpen(false)} />
          <a
            href={pickcourtHomeHash('contact')}
            className="block text-center bg-pickcourt-gold text-pickcourt-navy-dark font-semibold py-3 rounded-lg"
            onClick={() => setOpen(false)}
          >
            場地合作
          </a>
        </div>
      )}
    </header>
  );
};

export default PickleCourtNav;
