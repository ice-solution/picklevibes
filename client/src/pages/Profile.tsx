import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import QRCode from 'qrcode';
import { 
  UserIcon, 
  CogIcon,
  BellIcon,
  ShoppingBagIcon,
  LockClosedIcon,
  QrCodeIcon,
  TagIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  formatMembershipExpiry,
  getMembershipBadgeClass,
  getMembershipSourceLabel,
  getMembershipTierLabel,
  resolveDisplayMembership,
} from '../utils/membershipDisplay';

type GameMatchItem = {
  _id: string;
  createdAt: string;
  gameHall: { _id: string; name: string } | null;
  scores: number;
  hitRate: number | null;
  hitAccuracy: number | null;
  maxCombo: number | null;
};

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    preferences: {
      notifications: {
        email: user?.preferences?.notifications?.email ?? true,
        sms: user?.preferences?.notifications?.sms ?? false
      },
      skillLevel: user?.preferences?.skillLevel || 'beginner'
    }
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // 修改密碼
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordErrors, setPasswordErrors] = useState<{ [key: string]: string }>({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [gameMatchesLoading, setGameMatchesLoading] = useState(false);
  const [gameMatches, setGameMatches] = useState<GameMatchItem[]>([]);
  const [gameMatchesError, setGameMatchesError] = useState<string>('');

  /** API 通常回傳 id；少數情況僅有 _id */
  const mongoUserId = useMemo(() => {
    if (!user) return '';
    const u = user as { id?: unknown; _id?: unknown };
    const raw = u.id ?? u._id;
    if (raw == null || raw === '') return '';
    return String(raw).trim();
  }, [user]);

  const [memberQrSvg, setMemberQrSvg] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [tierProgress, setTierProgress] = useState<{
    enabled: boolean;
    annualSpent?: number;
    remaining?: number;
    progressPct?: number;
    currentTier?: { name: string; color?: string } | null;
    nextTier?: { name: string; color?: string; minAnnualSpent?: number } | null;
  } | null>(null);

  useEffect(() => {
    if (!user || isEditing) return;
    setFormData((prev) => ({
      ...prev,
      name: user.name || '',
      phone: user.phone || '',
      preferences: {
        notifications: {
          email: user.preferences?.notifications?.email ?? true,
          sms: user.preferences?.notifications?.sms ?? false
        },
        skillLevel: user.preferences?.skillLevel || 'beginner'
      }
    }));
  }, [user, isEditing]);

  const refreshMemberQrAndBalance = useCallback(async () => {
    if (!mongoUserId) {
      setMemberQrSvg(null);
      setPointsBalance(null);
      return;
    }
    try {
      const svg = await QRCode.toString(mongoUserId, {
        type: 'svg',
        width: 208,
        margin: 2,
        errorCorrectionLevel: 'M'
      });
      setMemberQrSvg(svg);
    } catch {
      setMemberQrSvg(null);
    }
    try {
      const balRes = await axios.get('/recharge/balance');
      setPointsBalance(typeof balRes.data?.balance === 'number' ? balRes.data.balance : null);
    } catch {
      setPointsBalance(null);
    }
  }, [mongoUserId]);

  useEffect(() => {
    void refreshMemberQrAndBalance();
  }, [refreshMemberQrAndBalance]);

  const refreshTierProgress = useCallback(async () => {
    try {
      const res = await axios.get('/tiers/progress');
      const data = res.data?.data;
      if (!data) {
        setTierProgress(null);
        return;
      }
      if (data.enabled === false) {
        setTierProgress({ enabled: false });
        return;
      }
      setTierProgress({
        enabled: true,
        annualSpent: typeof data.annualSpent === 'number' ? data.annualSpent : 0,
        remaining: typeof data.remaining === 'number' ? data.remaining : 0,
        progressPct: typeof data.progressPct === 'number' ? data.progressPct : 0,
        currentTier: data.currentTier ? { name: data.currentTier.name, color: data.currentTier.color } : null,
        nextTier: data.nextTier
          ? { name: data.nextTier.name, color: data.nextTier.color, minAnnualSpent: data.nextTier.minAnnualSpent }
          : null
      });
    } catch {
      setTierProgress(null);
    }
  }, []);

  useEffect(() => {
    void refreshTierProgress();
  }, [refreshTierProgress]);

  const formatPercent2dp = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(2)}%`);

  const refreshGameMatches = useCallback(async () => {
    if (!user) return;
    setGameMatchesLoading(true);
    setGameMatchesError('');
    try {
      const res = await axios.get('/games/me/matches?limit=20');
      setGameMatches(res.data?.data?.items || []);
    } catch (e: any) {
      setGameMatches([]);
      setGameMatchesError(e?.response?.data?.message || '載入遊戲記錄失敗');
    } finally {
      setGameMatchesLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshGameMatches();
  }, [refreshGameMatches]);

  const ProgressRing: React.FC<{ percent: number; color: string; label: string }> = ({ percent, color, label }) => {
    const size = 120;
    const stroke = 10;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    const dash = (p / 100) * c;
    return (
      <div className="flex flex-col items-center">
        <svg width={size} height={size} className="block">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-gray-900 font-bold" fontSize="28">
            {p}%
          </text>
        </svg>
        <div className="text-xs text-gray-600 mt-2">{label}</div>
      </div>
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('preferences.')) {
      const keys = name.split('.');
      if (keys.length === 3) {
        const [, group, field] = keys;
        setFormData((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            [group]: {
              ...((prev.preferences as Record<string, unknown>)[group] as Record<string, unknown>),
              [field]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
            }
          }
        }));
      } else if (keys.length === 2) {
        const [, field] = keys;
        const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        setFormData((prev) => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            [field]: val
          }
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // 清除錯誤
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = '姓名為必填項目';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = '電話號碼為必填項目';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = '請輸入有效的電話號碼';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile(formData);
      setIsEditing(false);
    } catch (error: any) {
      setErrors({ general: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      preferences: {
        notifications: {
          email: user?.preferences?.notifications?.email ?? true,
          sms: user?.preferences?.notifications?.sms ?? false
        },
        skillLevel: user?.preferences?.skillLevel || 'beginner'
      }
    });
    setErrors({});
    setIsEditing(false);
  };

  const validatePasswordForm = () => {
    const err: { [key: string]: string } = {};
    if (!passwordForm.currentPassword.trim()) {
      err.currentPassword = '請輸入當前密碼';
    }
    if (!passwordForm.newPassword) {
      err.newPassword = '請輸入新密碼';
    } else if (passwordForm.newPassword.length < 8) {
      err.newPassword = '新密碼至少需要 8 個字符';
    } else if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(passwordForm.newPassword)) {
      err.newPassword = '新密碼必須包含至少一個字母和一個數字';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      err.confirmPassword = '兩次輸入的新密碼不一致';
    }
    setPasswordErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setPasswordLoading(true);
    setPasswordErrors({});
    setPasswordSuccess(false);
    try {
      await axios.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (error: any) {
      setPasswordErrors({
        general: error.response?.data?.message || '修改密碼失敗，請稍後再試'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const platformMembership = resolveDisplayMembership(user);
  const membershipLabel = getMembershipTierLabel(
    platformMembership.tier,
    platformMembership.isVipActive
  );
  const membershipBadgeClass = getMembershipBadgeClass(
    platformMembership.tier,
    platformMembership.isVipActive
  );
  const membershipSourceLabel = getMembershipSourceLabel(platformMembership.source);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">個人資料</h1>
          <p className="text-gray-600">管理您的個人信息和偏好設置</p>
        </motion.div>

        {(mongoUserId || tierProgress?.enabled) && (
          <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {mongoUserId && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 w-full min-h-[420px] flex flex-col"
              >
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-4">
                  <QrCodeIcon className="w-5 h-5" />
                  <span>會員 QR</span>
                </div>
                <p className="text-center text-lg font-semibold text-gray-900 mb-3">
                  {user?.name || formData.name}
                </p>
                <div className="flex justify-center mb-3 flex-1 items-center">
                  {memberQrSvg ? (
                    <div
                      className="w-52 min-h-[13rem] flex items-center justify-center rounded-lg border border-gray-100 bg-white p-2 [&_svg]:max-h-[13rem] [&_svg]:w-auto [&_svg]:h-auto"
                      dangerouslySetInnerHTML={{ __html: memberQrSvg }}
                      role="img"
                      aria-label="會員編號 QR"
                    />
                  ) : (
                    <div className="w-52 h-52 rounded-lg bg-gray-100 animate-pulse" aria-hidden />
                  )}
                </div>
                <p className="text-center text-base text-gray-700">
                  現有積分：
                  <span className="ml-1 font-bold text-primary-600">
                    {pointsBalance !== null ? `${pointsBalance} 分` : '—'}
                  </span>
                </p>
              </motion.div>
            )}

            {!!tierProgress?.enabled && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 w-full min-h-[420px] flex flex-col"
              >
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-4">
                  <TagIcon className="w-5 h-5" />
                  <span>會員 Tier</span>
                </div>

                <p className="text-center text-lg font-semibold text-gray-900 mb-3">
                  {tierProgress.currentTier?.name || '—'}
                </p>

                <div className="flex justify-center mb-4 flex-1 items-center">
                  <ProgressRing
                    percent={tierProgress.progressPct ?? 0}
                    color={tierProgress.nextTier?.color || tierProgress.currentTier?.color || '#2563eb'}
                    label={tierProgress.nextTier ? `距離「${tierProgress.nextTier.name}」` : '已達最高 Tier'}
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-700">
                    <span>一年內總消費</span>
                    <span className="font-bold text-gray-900">
                      {(tierProgress.annualSpent ?? 0).toLocaleString()} 分
                    </span>
                  </div>
                  {tierProgress.nextTier ? (
                    <>
                      <div className="flex items-center justify-between text-gray-700">
                        <span>下一級門檻</span>
                        <span className="font-bold text-gray-900">
                          {(tierProgress.nextTier.minAnnualSpent ?? 0).toLocaleString()} 分
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-gray-700">
                        <span>還差</span>
                        <span className="font-bold text-primary-600">
                          {(tierProgress.remaining ?? 0).toLocaleString()} 分
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-600">
                      你已達到最高 Tier，感謝支持。
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主要內容 */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">基本信息</h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-outline"
                    >
                      編輯資料
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                {/* 一般錯誤信息 */}
                {errors.general && (
                  <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{errors.general}</p>
                  </div>
                )}

                <div className="space-y-6">
                  {/* 姓名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      姓名
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`input-field ${!isEditing ? 'bg-gray-50' : ''} ${
                        errors.name ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  {/* 電子郵件 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      電子郵件
                    </label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="input-field bg-gray-50"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      電子郵件地址無法修改
                    </p>
                  </div>

                  {/* 電話號碼 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      電話號碼
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`input-field ${!isEditing ? 'bg-gray-50' : ''} ${
                        errors.phone ? 'border-red-500 focus:ring-red-500' : ''
                      }`}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>

                  {/* PickCourt 聯盟會籍 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PickCourt 聯盟會籍
                    </label>
                    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <SparklesIcon className="w-5 h-5 text-amber-500 shrink-0" aria-hidden />
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${membershipBadgeClass}`}
                        >
                          {membershipLabel}
                        </span>
                        {platformMembership.tier === 'vip' && (
                          <span className="text-xs text-gray-500">
                            {platformMembership.isVipActive ? 'VIP 有效中' : 'VIP 已過期'}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">到期日</span>
                          <p className="font-medium text-gray-900">
                            {platformMembership.tier === 'vip'
                              ? formatMembershipExpiry(platformMembership.expiry)
                              : '—'}
                          </p>
                        </div>
                        {membershipSourceLabel && (
                          <div>
                            <span className="text-gray-500">來源</span>
                            <p className="font-medium text-gray-900">{membershipSourceLabel}</p>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        聯盟會籍適用於 PickCourt 跨店預約與平台優惠；店鋪積分 Tier 請見上方卡片。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 編輯按鈕 */}
                {isEditing && (
                  <div className="mt-8 flex gap-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="btn-secondary"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`btn-primary ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isLoading ? '保存中...' : '保存更改'}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>

            {/* 遊戲記錄 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="mt-8 bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900">遊戲記錄</h2>
                <button type="button" className="btn-outline" onClick={() => void refreshGameMatches()} disabled={gameMatchesLoading}>
                  {gameMatchesLoading ? '更新中...' : '刷新'}
                </button>
              </div>
              <div className="p-6">
                {gameMatchesError ? (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{gameMatchesError}</p>
                  </div>
                ) : null}

                {gameMatchesLoading ? (
                  <div className="text-gray-600">載入中...</div>
                ) : gameMatches.length === 0 ? (
                  <div className="text-gray-600">暫時未有遊戲記錄。</div>
                ) : (
                  <div className="space-y-3">
                    {gameMatches.map((m) => (
                      <div key={m._id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {m.gameHall?.name || '遊戲'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {m.createdAt ? new Date(m.createdAt).toLocaleString('zh-TW') : '—'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">分數</div>
                            <div className="text-xl font-extrabold text-primary-600 tabular-nums">
                              {typeof m.scores === 'number' ? m.scores : 0}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                          <div className="rounded-md bg-white border border-gray-200 p-2">
                            <div className="text-xs font-semibold text-gray-600">Hit Rate</div>
                            <div className="mt-1 font-bold text-gray-900 tabular-nums">{formatPercent2dp(m.hitRate)}</div>
                          </div>
                          <div className="rounded-md bg-white border border-gray-200 p-2">
                            <div className="text-xs font-semibold text-gray-600">Hit Accuracy</div>
                            <div className="mt-1 font-bold text-gray-900 tabular-nums">{formatPercent2dp(m.hitAccuracy)}</div>
                          </div>
                          <div className="rounded-md bg-white border border-gray-200 p-2">
                            <div className="text-xs font-semibold text-gray-600">Max Combo</div>
                            <div className="mt-1 font-bold text-gray-900 tabular-nums">{m.maxCombo ?? '—'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* 修改密碼 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <LockClosedIcon className="w-5 h-5" />
                  修改密碼
                </h2>
              </div>
              <div className="p-6">
                {!showPasswordForm ? (
                  <p className="text-gray-600 mb-4">為保障帳戶安全，請定期更換密碼。</p>
                ) : null}
                {passwordSuccess && (
                  <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">密碼已更新成功。</p>
                  </div>
                )}
                {showPasswordForm ? (
                  <form onSubmit={handleChangePasswordSubmit} className="space-y-6">
                    {passwordErrors.general && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800">{passwordErrors.general}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">當前密碼</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => {
                          setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }));
                          if (passwordErrors.currentPassword) setPasswordErrors((e2) => ({ ...e2, currentPassword: '' }));
                        }}
                        className={`input-field ${passwordErrors.currentPassword ? 'border-red-500' : ''}`}
                        placeholder="請輸入當前密碼"
                        autoComplete="current-password"
                      />
                      {passwordErrors.currentPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">新密碼</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => {
                          setPasswordForm((p) => ({ ...p, newPassword: e.target.value }));
                          if (passwordErrors.newPassword) setPasswordErrors((e2) => ({ ...e2, newPassword: '' }));
                        }}
                        className={`input-field ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                        placeholder="至少 8 個字符，含字母與數字"
                        autoComplete="new-password"
                      />
                      {passwordErrors.newPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">確認新密碼</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => {
                          setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }));
                          if (passwordErrors.confirmPassword) setPasswordErrors((e2) => ({ ...e2, confirmPassword: '' }));
                        }}
                        className={`input-field ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                        placeholder="再次輸入新密碼"
                        autoComplete="new-password"
                      />
                      {passwordErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordErrors({});
                        }}
                        className="btn-secondary"
                      >
                        取消
                      </button>
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className={`btn-primary ${passwordLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {passwordLoading ? '更新中...' : '更新密碼'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="btn-outline"
                  >
                    修改密碼
                  </button>
                )}
              </div>
            </motion.div>

            {/* 偏好設置 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-8 bg-white rounded-xl shadow-lg"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CogIcon className="w-5 h-5" />
                  偏好設置
                </h2>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {/* 技能等級 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      匹克球技能等級
                    </label>
                    <select
                      name="preferences.skillLevel"
                      value={formData.preferences.skillLevel}
                      onChange={handleChange}
                      className="input-field"
                    >
                      <option value="beginner">初學者</option>
                      <option value="intermediate">中級</option>
                      <option value="advanced">高級</option>
                      <option value="expert">專家</option>
                    </select>
                  </div>

                  {/* 通知設置 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      通知偏好
                    </label>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="preferences.notifications.email"
                          checked={formData.preferences.notifications.email}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-3 text-sm text-gray-700">
                          電子郵件通知
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          name="preferences.notifications.sms"
                          checked={formData.preferences.notifications.sms}
                          onChange={handleChange}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-3 text-sm text-gray-700">
                          簡訊通知
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 側邊欄 */}
          <div className="space-y-6">
            {/* 帳戶信息 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">帳戶信息</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">註冊時間</p>
                    <p className="font-medium">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-TW') : '未知'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BellIcon className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">最後登入</p>
                    <p className="font-medium">
                      {user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString('zh-TW') : '未知'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 快速操作 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-xl shadow-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
              <div className="space-y-3">
                <Link
                  to="/orders"
                  className="flex items-center space-x-2 w-full btn-outline text-left"
                >
                  <ShoppingBagIcon className="w-5 h-5" />
                  <span>訂單歷史</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(true)}
                  className="w-full btn-outline text-left flex items-center space-x-2"
                >
                  <LockClosedIcon className="w-5 h-5" />
                  <span>修改密碼</span>
                </button>
                <button className="w-full btn-outline text-left">
                  下載數據
                </button>
                <button className="w-full text-red-600 hover:text-red-700 text-left">
                  刪除帳戶
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
