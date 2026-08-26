import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useShopConfig } from '../../contexts/ShopConfigContext';
import { useMaintenance } from '../../hooks/useMaintenance';
import { canOpenAdminV2 } from '../../utils/authRedirect';
import LanguageSwitcher from '../Common/LanguageSwitcher';
import {
  Bars3Icon,
  XMarkIcon,
  UserIcon,
  CogIcon,
  CalendarDaysIcon,
  HomeIcon,
  InformationCircleIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  CreditCardIcon,
  ChevronDownIcon,
  UsersIcon,
  AcademicCapIcon,
  CalendarIcon,
  ShoppingBagIcon,
  TagIcon,
  ShoppingCartIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';

const navLinkClass = (active: boolean) =>
  `px-2.5 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
    active ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
  }`;

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { user, logout } = useAuth();
  const { shopEnabled } = useShopConfig();
  const { status: maintenanceStatus } = useMaintenance();
  const { t } = useTranslation();
  const location = useLocation();
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const count = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    updateCartCount();
    window.addEventListener('storage', updateCartCount);
    const interval = setInterval(updateCartCount, 1000);
    return () => {
      window.removeEventListener('storage', updateCartCount);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setIsUserDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isMaintenanceMode = maintenanceStatus?.maintenanceMode;
  const isAdmin = user?.role === 'admin';
  const canManage = canOpenAdminV2(user);
  const isCoach = user?.role === 'coach';
  const isAdminV2 = useMemo(() => location.pathname.startsWith('/admin-v2'), [location.pathname]);

  if (isMaintenanceMode && !isAdmin) {
    return null;
  }

  const cartButton = (className = '') =>
    shopEnabled ? (
      <Link
        to="/cart"
        className={`relative inline-flex items-center justify-center h-9 w-9 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50 ${className}`}
        aria-label={t('nav.cart')}
        title={t('nav.cart')}
      >
        <ShoppingCartIcon className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-4 px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </Link>
    ) : null;

  const userMenuItems = (
    <>
      <Link to="/profile" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <UserIcon className="w-4 h-4" />
        <span>{t('nav.editProfile')}</span>
      </Link>
      <Link to="/my-bookings" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <CalendarDaysIcon className="w-4 h-4" />
        <span>{t('nav.myBookings')}</span>
      </Link>
      <Link to="/my-activities" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <UsersIcon className="w-4 h-4" />
        <span>{t('nav.myActivities')}</span>
      </Link>
      <Link to="/recharge" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <CreditCardIcon className="w-4 h-4" />
        <span>{t('nav.recharge')}</span>
      </Link>
      <Link to="/balance" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <CurrencyDollarIcon className="w-4 h-4" />
        <span>{t('nav.balance')}</span>
      </Link>
      <Link to="/my-redeem" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <TicketIcon className="w-4 h-4" />
        <span>{t('nav.myRedeem')}</span>
      </Link>
      <Link to="/orders" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
        <ShoppingBagIcon className="w-4 h-4" />
        <span>{t('nav.orders')}</span>
      </Link>
      {isCoach && (
        <>
          <Link to="/coach-calendar" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            <CalendarIcon className="w-4 h-4" />
            <span>教練課表</span>
          </Link>
          <Link to="/coach-courses" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
            <AcademicCapIcon className="w-4 h-4" />
            <span>我的課堂</span>
          </Link>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          logout();
          setIsUserDropdownOpen(false);
        }}
        className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100 mt-1"
      >
        {t('nav.logout')}
      </button>
    </>
  );

  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-3">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <img src="/logo.jpg" alt="PickleVibes" className="w-10 h-10 object-contain flex-shrink-0" />
            <span className="hidden xl:block text-xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent leading-none">
              PickleVibes
            </span>
          </Link>

          <div className="hidden lg:flex flex-1 items-center justify-center gap-0.5 min-w-0">
            <Link to="/" className={navLinkClass(isActive('/'))}>
              {t('nav.home')}
            </Link>
            <Link to="/about" className={navLinkClass(isActive('/about'))}>
              {t('nav.about')}
            </Link>
            <Link to="/courts" className={navLinkClass(isActive('/courts'))}>
              {t('nav.courts')}
            </Link>
            <Link to="/vips" className={navLinkClass(isActive('/vips'))}>
              {t('nav.vips')}
            </Link>
            <Link to="/booking" className={navLinkClass(isActive('/booking'))}>
              {t('nav.booking')}
            </Link>
            <Link to="/activities" className={navLinkClass(isActive('/activities'))}>
              {t('nav.activities')}
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-1 flex-shrink-0 ml-auto">
            {shopEnabled && (
              <Link
                to="/shop"
                className={`inline-flex items-center justify-center h-9 w-9 rounded-md ${
                  isActive('/shop') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
                title={t('nav.shop')}
                aria-label={t('nav.shop')}
              >
                <ShoppingBagIcon className="w-5 h-5" />
              </Link>
            )}

            {user ? (
              <>
                <div className="relative" ref={userDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen((open) => !open)}
                    className="inline-flex items-center gap-1 h-9 px-2 rounded-md text-sm font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span className="hidden xl:inline">{t('nav.myAccount')}</span>
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </button>
                  <AnimatePresence>
                    {isUserDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black/5 z-50 py-1"
                      >
                        {userMenuItems}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {canManage && (
                  <Link
                    to={isAdmin && isAdminV2 ? '/admin?tab=bookings' : '/admin-v2'}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50"
                    title={isAdmin && isAdminV2 ? t('nav.adminLegacy') : t('nav.admin')}
                    aria-label={isAdmin && isAdminV2 ? t('nav.adminLegacy') : t('nav.admin')}
                  >
                    <CogIcon className="w-5 h-5" />
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link to="/login" className={navLinkClass(isActive('/login'))}>
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="ml-1 inline-flex items-center h-9 px-3 rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}

            <LanguageSwitcher compact />
            {cartButton()}
          </div>

          <div className="lg:hidden flex items-center gap-1 ml-auto">
            <LanguageSwitcher compact />
            {cartButton()}
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-50"
              aria-label="Menu"
            >
              {isOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              <Link to="/" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <HomeIcon className="w-5 h-5" />
                {t('nav.home')}
              </Link>
              <Link to="/about" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/about') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <InformationCircleIcon className="w-5 h-5" />
                {t('nav.about')}
              </Link>
              <Link to="/courts" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/courts') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <BuildingOfficeIcon className="w-5 h-5" />
                {t('nav.courts')}
              </Link>
              <Link to="/vips" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/vips') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <TagIcon className="w-5 h-5" />
                {t('nav.vips')}
              </Link>
              <Link to="/booking" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/booking') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <CalendarDaysIcon className="w-5 h-5" />
                {t('nav.booking')}
              </Link>
              <Link to="/activities" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/activities') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                <UsersIcon className="w-5 h-5" />
                {t('nav.activities')}
              </Link>
              {shopEnabled && (
                <Link to="/shop" onClick={() => setIsOpen(false)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium ${isActive('/shop') ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <ShoppingBagIcon className="w-5 h-5" />
                  {t('nav.shop')}
                </Link>
              )}

              <div className="border-t border-gray-100 pt-3 mt-3">
                {user ? (
                  <div className="space-y-1">
                    {canManage && (
                      <Link
                        to={isAdmin && isAdminV2 ? '/admin?tab=bookings' : '/admin-v2'}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <CogIcon className="w-5 h-5" />
                        {isAdmin && isAdminV2 ? t('nav.adminLegacy') : t('nav.admin')}
                      </Link>
                    )}
                    <Link to="/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <UserIcon className="w-5 h-5" />
                      {t('nav.editProfile')}
                    </Link>
                    <Link to="/my-bookings" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <CalendarDaysIcon className="w-5 h-5" />
                      {t('nav.myBookings')}
                    </Link>
                    <Link to="/my-activities" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <UsersIcon className="w-5 h-5" />
                      {t('nav.myActivities')}
                    </Link>
                    <Link to="/recharge" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <CreditCardIcon className="w-5 h-5" />
                      {t('nav.recharge')}
                    </Link>
                    <Link to="/balance" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <CurrencyDollarIcon className="w-5 h-5" />
                      {t('nav.balance')}
                    </Link>
                    <Link to="/my-redeem" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <TicketIcon className="w-5 h-5" />
                      {t('nav.myRedeem')}
                    </Link>
                    <Link to="/orders" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      <ShoppingBagIcon className="w-5 h-5" />
                      {t('nav.orders')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link to="/login" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50">
                      {t('nav.login')}
                    </Link>
                    <Link to="/register" onClick={() => setIsOpen(false)} className="block bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-md text-base font-medium">
                      {t('nav.register')}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
