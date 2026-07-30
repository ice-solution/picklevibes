import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { BookingProvider } from './contexts/BookingContext';
import './i18n'; // 初始化 i18n
import './styles/globals.css'; // 引入全局樣式
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import About from './pages/About';
import FAQ from './pages/FAQ';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import Pricing from './pages/Pricing';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import AdminV2 from './pages/AdminV2';
import PaymentResult from './pages/PaymentResult';
import Recharge from './pages/Recharge';
import RechargeSuccess from './pages/RechargeSuccess';
import Balance from './pages/Balance';
import Maintenance from './pages/Maintenance';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import ActivityRegister from './pages/ActivityRegister';
import MyActivities from './pages/MyActivities';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import CoachCourses from './pages/CoachCourses';
import CoachCalendar from './pages/CoachCalendar';
import CoachSchoolRequest from './pages/CoachSchoolRequest';
import CoachRoute from './components/Auth/CoachRoute';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderHistory from './pages/OrderHistory';
import AccountBookings from './pages/pickcourt/AccountBookings';
import AccountProfile from './pages/pickcourt/AccountProfile';
import AccountBalance from './pages/pickcourt/AccountBalance';
import AccountOrders from './pages/pickcourt/AccountOrders';
import AccountRecharge from './pages/pickcourt/AccountRecharge';
import { PickCourtMemberRedirect, PickCourtOrderDetailRedirect } from './components/PickleCourt/PickCourtMemberRedirect';
import { PICKCOURT_ACCOUNT } from './utils/pickcourtRoutes';
import Vlog from './pages/Vlog';
import GameJoin from './pages/GameJoin';
import PickleCourtHome from './pages/PickleCourtHome';
import PickleCourtSearch from './pages/PickleCourtSearch';
import { isPickCourtPublicPath, isPickCourtAdminPath } from './utils/pickcourtRoutes';
import { useDocumentPlatformBrand } from './hooks/useDocumentPlatformBrand';
import StoreAdmin from './pages/StoreAdmin';
import StorePublic from './pages/StorePublic';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import TenantDomainRedirect from './components/TenantDomainRedirect';
import { StoreTenantHostProvider, useStoreTenantHost } from './contexts/StoreTenantHostContext';
import MaintenanceCheck from './components/Auth/MaintenanceCheck';
import { ShopConfigProvider, useShopConfig } from './contexts/ShopConfigContext';
import ShopDisabled from './pages/ShopDisabled';

function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <ShopConfigProvider>
        <BookingProvider>
          <Router>
            <StoreTenantHostProvider>
            <MaintenanceCheck>
              <AppShell />
            </MaintenanceCheck>
            </StoreTenantHostProvider>
          </Router>
        </BookingProvider>
        </ShopConfigProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

function AppShell() {
  const location = useLocation();
  const isStoreAdmin = /^\/store\/[^/]+\/admin/.test(location.pathname);
  const isStoreLogin = /^\/store\/[^/]+\/login$/.test(location.pathname);
  const { resolved: isTenantHost } = useStoreTenantHost();
  const hideMainChrome =
    isPickCourtPublicPath(location.pathname) ||
    isPickCourtAdminPath(location.pathname) ||
    isStoreAdmin ||
    isStoreLogin ||
    isTenantHost;
  useDocumentPlatformBrand(hideMainChrome);

  return (
    <div className={hideMainChrome ? 'min-h-screen' : 'min-h-screen bg-gray-50'}>
      {!hideMainChrome && <Navbar />}
      <main>
        <TenantDomainRedirect />
        <Routes>
                <Route path="/" element={<PickleCourtHome />} />
                <Route path="/search" element={<PickleCourtSearch />} />
                <Route path="/pickcourt" element={<Navigate to="/" replace />} />
                <Route path="/pickcourt/search" element={<Navigate to="/search" replace />} />
                <Route path="/picklecourt" element={<Navigate to="/" replace />} />
                <Route path="/picklecourt/search" element={<Navigate to="/search" replace />} />
                <Route path="/picklevibes" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/vlog/:id" element={<Vlog />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route 
                  path="/pricing" 
                  element={
                    <ProtectedRoute>
                      <Pricing />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/booking" 
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/booking/:storeSlug"
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/booking/:storeSlug/:courtSlug"
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/booking/:storeSlug/:courtSlug/:date"
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  }
                />
                {/* Deep link 分享：/lai-chi-kok/match-court/2026-06-13 — 須在靜態路由之後、catch-all 之前 */}
                <Route path="/login" element={<Login />} />
                <Route path="/store/:storeSlug/login" element={<Login />} />
                <Route path="/pickcourt/login" element={<Navigate to="/login" replace />} />
                <Route path="/picklecourt/login" element={<Navigate to="/login" replace />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route 
                  path="/dashboard" 
                  element={<Navigate to={PICKCOURT_ACCOUNT.bookings} replace />}
                />
                {/* PickCourt 會員中心 */}
                <Route
                  path="/account"
                  element={<Navigate to={PICKCOURT_ACCOUNT.bookings} replace />}
                />
                <Route
                  path="/account/bookings"
                  element={
                    <ProtectedRoute>
                      <AccountBookings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/profile"
                  element={
                    <ProtectedRoute>
                      <AccountProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/balance"
                  element={
                    <ProtectedRoute>
                      <AccountBalance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/recharge"
                  element={
                    <ProtectedRoute>
                      <AccountRecharge />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/orders"
                  element={
                    <ProtectedRoute>
                      <AccountOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account/orders/:id"
                  element={
                    <ProtectedRoute>
                      <AccountOrders />
                    </ProtectedRoute>
                  }
                />
                {/* 舊路徑 → PickCourt 會員中心（PickleVibes 子站保留舊頁） */}
                <Route 
                  path="/my-bookings" 
                  element={
                    <PickCourtMemberRedirect
                      to={PICKCOURT_ACCOUNT.bookings}
                      legacy={
                        <ProtectedRoute>
                          <MyBookings />
                        </ProtectedRoute>
                      }
                    />
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <PickCourtMemberRedirect
                      to={PICKCOURT_ACCOUNT.profile}
                      legacy={
                        <ProtectedRoute>
                          <Profile />
                        </ProtectedRoute>
                      }
                    />
                  } 
                />
                <Route
                  path="/game/join/:sessionId"
                  element={
                    <ProtectedRoute>
                      <GameJoin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/store/:storeSlug/admin"
                  element={<StoreAdmin />}
                />
                <Route path="/store/:storeSlug" element={<StorePublic />} />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/admin-v2"
                  element={
                    <ProtectedRoute>
                      <AdminV2 />
                    </ProtectedRoute>
                  }
                />
                <Route path="/payment-result" element={<PaymentResult />} />
                <Route 
                  path="/recharge" 
                  element={
                    <PickCourtMemberRedirect
                      to={PICKCOURT_ACCOUNT.recharge}
                      legacy={
                        <ProtectedRoute>
                          <Recharge />
                        </ProtectedRoute>
                      }
                    />
                  } 
                />
                <Route 
                  path="/recharge-success" 
                  element={
                    <ProtectedRoute>
                      <RechargeSuccess />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/balance" 
                  element={
                    <PickCourtMemberRedirect
                      to={PICKCOURT_ACCOUNT.balance}
                      legacy={
                        <ProtectedRoute>
                          <Balance />
                        </ProtectedRoute>
                      }
                    />
                  } 
                />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route
                  path="/coach-calendar"
                  element={
                    <CoachRoute>
                      <CoachCalendar />
                    </CoachRoute>
                  }
                />
                <Route
                  path="/coach-courses" 
                  element={
                    <CoachRoute>
                      <CoachCourses />
                    </CoachRoute>
                  } 
                />
                <Route
                  path="/coach/school-request"
                  element={
                    <CoachRoute>
                      <CoachSchoolRequest />
                    </CoachRoute>
                  }
                />
                <Route path="/activities" element={<Activities />} />
                <Route path="/activities/:id" element={<ActivityDetail />} />
                <Route
                  path="/activities/:id/register"
                  element={
                    <ProtectedRoute>
                      <ActivityRegister />
                    </ProtectedRoute>
                  }
                />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route 
                  path="/my-activities" 
                  element={
                    <ProtectedRoute>
                      <MyActivities />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/shop" element={<ShopOrDisabled />} />
                <Route path="/shop/:id" element={<ProductDetailOrDisabled />} />
                <Route 
                  path="/cart" 
                  element={<ProtectedRoute><CartOrDisabled /></ProtectedRoute>} 
                />
                <Route 
                  path="/checkout" 
                  element={<ProtectedRoute><CheckoutOrDisabled /></ProtectedRoute>} 
                />
                <Route 
                  path="/orders" 
                  element={
                    <PickCourtMemberRedirect
                      to={PICKCOURT_ACCOUNT.orders}
                      legacy={
                        <ProtectedRoute>
                          <OrderHistory />
                        </ProtectedRoute>
                      }
                    />
                  } 
                />
                <Route 
                  path="/orders/:id" 
                  element={
                    <ProtectedRoute>
                      <PickCourtOrderDetailRedirect
                        legacy={<OrderHistory />}
                      />
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/:storeSlug/:courtSlug/:date"
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideMainChrome && <Footer />}
    </div>
  );
}

// 依購物功能開關顯示商店或暫停頁（須在 ShopConfigProvider 內使用）
function ShopOrDisabled() {
  const { shopEnabled, loading } = useShopConfig();
  if (loading) return null;
  return shopEnabled ? <Shop /> : <ShopDisabled />;
}
function ProductDetailOrDisabled() {
  const { shopEnabled, loading } = useShopConfig();
  if (loading) return null;
  return shopEnabled ? <ProductDetail /> : <ShopDisabled />;
}
function CartOrDisabled() {
  const { shopEnabled, loading } = useShopConfig();
  if (loading) return null;
  return shopEnabled ? <Cart /> : <ShopDisabled />;
}
function CheckoutOrDisabled() {
  const { shopEnabled, loading } = useShopConfig();
  if (loading) return null;
  return shopEnabled ? <Checkout /> : <ShopDisabled />;
}

export default App;