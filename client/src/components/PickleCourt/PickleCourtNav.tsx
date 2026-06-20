import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { PICKCOURT_HOME, pickcourtHomeHash } from '../../utils/pickcourtRoutes';

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
            <Link
              to="/login"
              className="text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold transition-colors px-4 py-2"
            >
              球友登入
            </Link>
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
          <Link to="/login" className="block text-pickcourt-navy font-semibold py-2" onClick={() => setOpen(false)}>
            球友登入
          </Link>
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
