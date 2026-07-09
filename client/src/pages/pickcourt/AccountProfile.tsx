import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';
import {
  formatMembershipExpiry,
  getMembershipBadgeClass,
  getMembershipTierLabel,
  resolveDisplayMembership,
} from '../../utils/membershipDisplay';

const AccountProfile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [memberQr, setMemberQr] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  const mongoUserId = useMemo(() => {
    if (!user) return '';
    const u = user as { id?: unknown; _id?: unknown };
    const raw = u.id ?? u._id;
    return raw != null ? String(raw).trim() : '';
  }, [user]);

  const membership = resolveDisplayMembership(user);

  const refreshExtras = useCallback(async () => {
    if (!mongoUserId) return;
    try {
      const svg = await QRCode.toString(mongoUserId, { type: 'svg', width: 160, margin: 2 });
      setMemberQr(svg);
    } catch {
      setMemberQr(null);
    }
    try {
      const res = await axios.get('/recharge/balance');
      setPointsBalance(typeof res.data?.balance === 'number' ? res.data.balance : null);
    } catch {
      setPointsBalance(null);
    }
  }, [mongoUserId]);

  useEffect(() => {
    if (user && !editing) {
      setForm({ name: user.name || '', phone: user.phone || '' });
    }
  }, [user, editing]);

  useEffect(() => {
    void refreshExtras();
  }, [refreshExtras]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('請填寫姓名');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      setEditing(false);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      setError(msg || '更新失敗');
    } finally {
      setSaving(false);
    }
  };

  const cardClass = 'bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm p-6';

  return (
    <PickCourtMemberLayout title="個人資料" subtitle="管理帳戶資料與會員資訊">
      <div className="space-y-6">
        <div className={cardClass}>
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="shrink-0">
              {memberQr ? (
                <div
                  className="p-2 bg-white border border-slate-200 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: memberQr }}
                />
              ) : (
                <div className="w-40 h-40 bg-slate-100 rounded-lg animate-pulse" />
              )}
              <p className="text-xs text-gray-500 text-center mt-2">會員 QR Code</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getMembershipBadgeClass(
                    membership.tier,
                    membership.isVipActive
                  )}`}
                >
                  {getMembershipTierLabel(membership.tier, membership.isVipActive)}
                </span>
                {membership.expiry && (
                  <span className="text-xs text-gray-500">
                    到期：{formatMembershipExpiry(membership.expiry)}
                  </span>
                )}
              </div>
              {pointsBalance != null && (
                <p className="text-sm text-gray-600 mb-4">
                  積分餘額：
                  <Link to={PICKCOURT_ACCOUNT.balance} className="font-bold text-pickcourt-navy hover:text-pickcourt-gold ml-1">
                    {pointsBalance} 分
                  </Link>
                </p>
              )}
              {!editing ? (
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-500 w-16 inline-block">姓名</span>
                    <span className="font-medium text-gray-900">{user?.name}</span>
                  </p>
                  <p>
                    <span className="text-gray-500 w-16 inline-block">電郵</span>
                    <span className="text-gray-900">{user?.email}</span>
                  </p>
                  <p>
                    <span className="text-gray-500 w-16 inline-block">電話</span>
                    <span className="text-gray-900">{user?.phone || '—'}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="mt-4 px-4 py-2 rounded-lg border border-pickcourt-gold/40 text-pickcourt-navy font-medium hover:bg-pickcourt-gold/10 transition-colors"
                  >
                    編輯資料
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-4 max-w-md">
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pickcourt-gold/40 focus:border-pickcourt-gold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-pickcourt-gold/40 focus:border-pickcourt-gold"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light disabled:opacity-50"
                    >
                      {saving ? '儲存中…' : '儲存'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-gray-600 hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className={`${cardClass} grid sm:grid-cols-2 gap-4`}>
          <Link
            to={PICKCOURT_ACCOUNT.bookings}
            className="p-4 rounded-lg border border-slate-100 hover:border-pickcourt-gold/40 hover:bg-pickcourt-gold/5 transition-colors"
          >
            <p className="font-semibold text-pickcourt-navy">我的預約</p>
            <p className="text-sm text-gray-500 mt-1">查看場地預約記錄</p>
          </Link>
          <Link
            to={PICKCOURT_ACCOUNT.orders}
            className="p-4 rounded-lg border border-slate-100 hover:border-pickcourt-gold/40 hover:bg-pickcourt-gold/5 transition-colors"
          >
            <p className="font-semibold text-pickcourt-navy">訂單記錄</p>
            <p className="text-sm text-gray-500 mt-1">商城購物訂單</p>
          </Link>
        </div>
      </div>
    </PickCourtMemberLayout>
  );
};

export default AccountProfile;
