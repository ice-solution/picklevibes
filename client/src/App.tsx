import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import Facilities from './pages/Facilities';
import Pricing from './pages/Pricing';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import PaymentResult from './pages/PaymentResult';
import Recharge from './pages/Recharge';
import RechargeSuccess from './pages/RechargeSuccess';
import Balance from './pages/Balance';
import ProtectedRoute from './components/Auth/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/facilities" element={<Facilities />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route 
                  path="/booking" 
                  element={
                    <ProtectedRoute>
                      <Booking />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route 
                  path="/dashboard" 
                  element={<Navigate to="/my-bookings" replace />}
                />
                <Route 
                  path="/my-bookings" 
                  element={
                    <ProtectedRoute>
                      <MyBookings />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/payment-result" element={<PaymentResult />} />
                <Route 
                  path="/recharge" 
                  element={
                    <ProtectedRoute>
                      <Recharge />
                    </ProtectedRoute>
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
                    <ProtectedRoute>
                      <Balance />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </BookingProvider>
    </AuthProvider>
  );
}

export default App;