import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useShopConfig } from '../../contexts/ShopConfigContext';
import { useMaintenance } from '../../hooks/useMaintenance';
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
  TicketIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  ClockIcon,
  ShoppingBagIcon,
  TagIcon,
  ShoppingCartIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

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

  // 獲取購物車數量
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const count = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        setCartCount(count);
      } catch (error) {
        setCartCount(0);
      }
    };

    updateCartCount();
    // 監聽 storage 變化（當其他標籤頁更新購物車時）
    window.addEventListener('storage', updateCartCount);
    // 定期檢查（因為同頁面的 localStorage 變化不會觸發 storage 事件）
    const interval = setInterval(updateCartCount, 1000);

    return () => {
      window.removeEventListener('storage', updateCartCount);
      clearInterval(interval);
    };
  }, []);

  // 點擊外部關閉下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navigation = [
    { name: t('nav.home'), href: '/', icon: HomeIcon },
    { name: t('nav.about'), href: '/about', icon: InformationCircleIcon },
    { name: t('nav.pricing'), href: '/pricing', icon: CurrencyDollarIcon },
    { name: t('nav.booking'), href: '/booking', icon: CalendarDaysIcon },
    { name: '活動中心', href: '/activities', icon: UsersIcon },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // 維護模式檢查
  const isMaintenanceMode = maintenanceStatus?.maintenanceMode;
  const isPlatformAdmin = user?.role === 'admin';
  const isStoreStaff = user?.role === 'staff' && (user?.managedStores?.length ?? 0) > 0;
  const canAccessAdmin = isPlatformAdmin || isStoreStaff;
  const isCoach = user?.role === 'coach';
  const isAdminV2 = useMemo(() => location.pathname.startsWith('/admin-v2'), [location.pathname]);
  const adminHref = useMemo(() => {
    if (isPlatformAdmin) return isAdminV2 ? '/admin?tab=bookings' : '/admin-v2';
    if (isStoreStaff && user?.managedStores?.[0]) {
      return `/store/${user.managedStores[0].slug}/admin`;
    }
    return '/admin-v2';
  }, [isPlatformAdmin, isStoreStaff, isAdminV2, user?.managedStores]);
  const adminLinkLabel = isPlatformAdmin ? (isAdminV2 ? '返回舊版' : '平台管理') : '店鋪後台';

  // 如果在維護模式下且不是管理員，隱藏導航（包括維護頁面）
  if (isMaintenanceMode && !canAccessAdmin) {
    return null;
  }

  return (
    <nav className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img 
              src="/logo.jpg" 
              alt="PickleVibes Logo" 
              className="w-12 h-12 object-contain"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
              PickleVibes
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center space-x-1 px-2 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                  isActive(item.href)
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden lg:inline">{item.name}</span>
              </Link>
            ))}
            {/* 線上商店 - 依購物功能開關顯示 */}
            {shopEnabled && (
              <Link
                to="/shop"
                className={`flex items-center space-x-1 px-2 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${
                  isActive('/shop')
                    ? 'text-primary-600 bg-primary-50'
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}
              >
                <ShoppingBagIcon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden lg:inline">線上商店</span>
              </Link>
            )}
          </div>

          {/* User Menu / Auth Buttons */}
          <div className="hidden md:flex items-center space-x-2 lg:space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {/* 用戶下拉選單 */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors duration-200"
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>我的</span>
                    <ChevronDownIcon className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {isUserDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
                      >
                        <div className="py-1">
                          <Link
                            to="/profile"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <UserIcon className="w-4 h-4" />
                            <span>編輯資料</span>
                          </Link>
                          <Link
                            to="/my-bookings"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <CalendarDaysIcon className="w-4 h-4" />
                            <span>我的預約</span>
                          </Link>
                          <Link
                            to="/my-activities"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <UsersIcon className="w-4 h-4" />
                            <span>我的活動</span>
                          </Link>
                          <Link
                            to="/recharge"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <CreditCardIcon className="w-4 h-4" />
                            <span>充值</span>
                          </Link>
                          <Link
                            to="/balance"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <CurrencyDollarIcon className="w-4 h-4" />
                            <span>我的積分</span>
                          </Link>
                          <Link
                            to="/orders"
                            onClick={() => setIsUserDropdownOpen(false)}
                            className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <ShoppingBagIcon className="w-4 h-4" />
                            <span>訂單歷史</span>
                          </Link>
                          {isCoach && (
                            <>
                              <Link
                                to="/coach-calendar"
                                onClick={() => setIsUserDropdownOpen(false)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <CalendarIcon className="w-4 h-4" />
                                <span>教練課表</span>
                              </Link>
                              <Link
                                to="/coach-courses"
                                onClick={() => setIsUserDropdownOpen(false)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <AcademicCapIcon className="w-4 h-4" />
                                <span>我的課程預約</span>
                              </Link>
                              <Link
                                to="/coach/school-request"
                                onClick={() => setIsUserDropdownOpen(false)}
                                className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                                <span>教練學校要請</span>
                              </Link>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 管理入口（預設新版；新版可返舊版） */}
                {canAccessAdmin && (
                  <Link
                    to={adminHref}
                    className="flex items-center space-x-1 text-gray-700 hover:text-primary-600 transition-colors duration-200"
                  >
                    <CogIcon className="w-5 h-5" />
                    <span>{adminLinkLabel}</span>
                  </Link>
                )}

                <LanguageSwitcher />
                <button
                  onClick={logout}
                  className="text-gray-700 hover:text-primary-600 transition-colors duration-200"
                >
                  {t('nav.logout')}
                </button>
                {/* 購物車圖標 - 依購物功能顯示 */}
                {shopEnabled && (
                  <Link
                    to="/cart"
                    className="relative flex items-center text-gray-700 hover:text-primary-600 transition-colors duration-200"
                  >
                    <ShoppingCartIcon className="w-6 h-6" />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <LanguageSwitcher />
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-primary-600 transition-colors duration-200"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                >
                  {t('nav.register')}
                </Link>
                {shopEnabled && (
                  <Link
                    to="/cart"
                    className="relative flex items-center text-gray-700 hover:text-primary-600 transition-colors duration-200"
                  >
                    <ShoppingCartIcon className="w-6 h-6" />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-700 hover:text-primary-600 transition-colors duration-200"
            >
              {isOpen ? (
                <XMarkIcon className="w-6 h-6" />
              ) : (
                <Bars3Icon className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-white border-t border-gray-200"
          >
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              ))}
              {shopEnabled && (
                <Link
                  to="/shop"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    isActive('/shop')
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                  }`}
                >
                  <ShoppingBagIcon className="w-5 h-5" />
                  <span>線上商店</span>
                </Link>
              )}
              
              {/* Mobile Auth */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                {user ? (
                  <div className="space-y-2">
                    {shopEnabled && (
                      <Link
                        to="/cart"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                      >
                        <div className="relative">
                          <ShoppingCartIcon className="w-5 h-5" />
                          {cartCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                              {cartCount > 99 ? '99+' : cartCount}
                            </span>
                          )}
                        </div>
                        <span>購物車</span>
                      </Link>
                    )}
                    {/* 用戶功能 */}
                    <div className="text-sm font-medium text-gray-500 px-3 py-1">我的功能</div>
                    <Link
                      to="/profile"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <UserIcon className="w-5 h-5" />
                      <span>編輯資料</span>
                    </Link>
                    <Link
                      to="/my-bookings"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <CalendarDaysIcon className="w-5 h-5" />
                      <span>我的預約</span>
                    </Link>
                    <Link
                      to="/my-activities"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <UsersIcon className="w-5 h-5" />
                      <span>我的活動</span>
                    </Link>
                    <Link
                      to="/recharge"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <CreditCardIcon className="w-5 h-5" />
                      <span>充值</span>
                    </Link>
                    <Link
                      to="/balance"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <CurrencyDollarIcon className="w-5 h-5" />
                      <span>我的積分</span>
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setIsOpen(false)}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <ShoppingBagIcon className="w-5 h-5" />
                      <span>訂單歷史</span>
                    </Link>
                    {isCoach && (
                      <>
                        <Link
                          to="/coach-calendar"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <CalendarIcon className="w-5 h-5" />
                          <span>教練課表</span>
                        </Link>
                        <Link
                          to="/coach-courses"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <AcademicCapIcon className="w-5 h-5" />
                          <span>我的課程預約</span>
                        </Link>
                        <Link
                          to="/coach/school-request"
                          onClick={() => setIsOpen(false)}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <ChatBubbleLeftRightIcon className="w-5 h-5" />
                          <span>教練學校要請</span>
                        </Link>
                      </>
                    )}

                    {/* 管理員功能 */}
                    {canAccessAdmin && (
                      <>
                        <div className="text-sm font-medium text-gray-500 px-3 py-1 mt-4">管理功能</div>
                        <Link
                          to={adminHref}
                          onClick={() => setIsOpen(false)}
                          className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <CogIcon className="w-5 h-5" />
                          <span>{adminLinkLabel}</span>
                        </Link>
                      </>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      登出
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 transition-colors duration-200"
                    >
                      登入
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setIsOpen(false)}
                      className="block bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-md text-base font-medium transition-colors duration-200"
                    >
                      註冊
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
