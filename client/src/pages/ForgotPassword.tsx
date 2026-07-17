import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../config/api';
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import PickCourtAuthLayout from '../layouts/PickCourtAuthLayout';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('請輸入您的電子郵件地址');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('請輸入有效的電子郵件地址');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiConfig.API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.message || '發送重置密碼郵件失敗');
      }
    } catch {
      setError('網絡錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <PickCourtAuthLayout title="郵件已發送">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <CheckCircleIcon className="mx-auto h-16 w-16 text-emerald-500 mb-4" />
          <p className="text-slate-600 mb-6">
            我們已向 <strong>{email}</strong> 發送重置密碼的郵件。
            請檢查您的郵箱並點擊重置鏈接。
          </p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold bg-pickcourt-gold text-pickcourt-navy-dark hover:bg-pickcourt-gold-light"
            >
              返回登入
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false);
                setEmail('');
              }}
              className="w-full flex justify-center py-3 px-4 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            >
              重新發送
            </button>
          </div>
        </motion.div>
      </PickCourtAuthLayout>
    );
  }

  return (
    <PickCourtAuthLayout
      title="忘記密碼"
      subtitle="請輸入您的電子郵件地址，我們將發送重置密碼的鏈接給您"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          to="/login"
          className="inline-flex items-center text-sm text-slate-500 hover:text-pickcourt-gold mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-1" />
          返回登入
        </Link>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              電子郵件地址
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-pickcourt-gold focus:border-pickcourt-gold sm:text-sm"
                placeholder="請輸入您的電子郵件"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 rounded-lg text-sm font-semibold bg-pickcourt-gold text-pickcourt-navy-dark hover:bg-pickcourt-gold-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '發送中...' : '發送重置鏈接'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            記起密碼了？{' '}
            <Link to="/login" className="font-medium text-pickcourt-navy hover:text-pickcourt-gold">
              返回登入
            </Link>
          </p>
        </div>
      </motion.div>
    </PickCourtAuthLayout>
  );
};

export default ForgotPassword;
