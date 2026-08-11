import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  LockClosedIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import apiConfig from '../config/api';
import PickCourtAuthLayout from '../layouts/PickCourtAuthLayout';

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);

  useEffect(() => {
    if (token) {
      validateToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`${apiConfig.API_BASE_URL}/auth/verify-reset-token/${token}`);
      const data = await response.json();

      if (response.ok) {
        setIsTokenValid(true);
      } else {
        setIsTokenValid(false);
        setError(data.message || '重置鏈接無效或已過期');
      }
    } catch {
      setIsTokenValid(false);
      setError('網絡錯誤，請稍後再試');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.password) {
      setError('請輸入新密碼');
      return false;
    }
    if (formData.password.length < 8) {
      setError('密碼至少需要8個字符');
      return false;
    }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
      setError('密碼必須包含至少一個字母和一個數字');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiConfig.API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.message || '重置密碼失敗');
      }
    } catch {
      setError('網絡錯誤，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  if (isTokenValid === false) {
    return (
      <PickCourtAuthLayout title="鏈接無效">
        <div className="text-center space-y-4">
          <ExclamationTriangleIcon className="mx-auto h-14 w-14 text-red-500" />
          <p className="text-slate-600">{error || '重置密碼的鏈接無效或已過期。請重新申請重置密碼。'}</p>
          <Link
            to="/forgot-password"
            className="inline-flex justify-center w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-pickcourt-navy hover:bg-slate-800"
          >
            重新申請重置密碼
          </Link>
        </div>
      </PickCourtAuthLayout>
    );
  }

  if (isTokenValid === null) {
    return (
      <PickCourtAuthLayout title="驗證中">
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pickcourt-navy mx-auto mb-4" />
          <p className="text-slate-600">驗證重置鏈接中...</p>
        </div>
      </PickCourtAuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <PickCourtAuthLayout title="密碼重置成功">
        <div className="text-center space-y-4">
          <CheckCircleIcon className="mx-auto h-14 w-14 text-green-500" />
          <p className="text-slate-600">您的密碼已成功重置。3 秒後將自動跳轉到登入頁面。</p>
          <Link
            to="/login"
            className="inline-flex justify-center w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-pickcourt-navy hover:bg-slate-800"
          >
            立即登入
          </Link>
        </div>
      </PickCourtAuthLayout>
    );
  }

  return (
    <PickCourtAuthLayout title="重置密碼" subtitle="請輸入您的新密碼">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            新密碼
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LockClosedIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="appearance-none block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pickcourt-gold/40 focus:border-pickcourt-navy sm:text-sm"
              placeholder="請輸入新密碼"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            確認新密碼
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LockClosedIcon className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              className="appearance-none block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pickcourt-gold/40 focus:border-pickcourt-navy sm:text-sm"
              placeholder="請再次輸入新密碼"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-pickcourt-navy hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '重置中...' : '重置密碼'}
        </button>

        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="text-pickcourt-navy hover:underline">
            返回登入
          </Link>
        </p>
      </form>
    </PickCourtAuthLayout>
  );
};

export default ResetPassword;
