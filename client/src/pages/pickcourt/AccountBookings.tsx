import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDaysIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useBooking } from '../../contexts/BookingContext';
import PickCourtMemberLayout from '../../layouts/PickCourtMemberLayout';
import { PICKCOURT_SEARCH } from '../../utils/pickcourtRoutes';

const statusLabel: Record<string, string> = {
  confirmed: '已確認',
  pending: '待確認',
  cancelled: '已取消',
  completed: '已完成',
  no_show: '未到場',
};

const statusClass: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-700',
};

const AccountBookings: React.FC = () => {
  const { user } = useAuth();
  const { bookings, fetchBookings, loading } = useBooking();
  const [mode, setMode] = useState<'upcoming' | 'all'>('upcoming');

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const userBookings = useMemo(() => {
    if (!bookings?.length || !user) return [];
    return bookings
      .filter((b) => {
        const uid = typeof b.user === 'string' ? b.user : b.user?._id;
        return uid === user.id;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return db - da;
        return b.startTime.localeCompare(a.startTime);
      });
  }, [bookings, user]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return userBookings.filter((b) => {
      const d = new Date(b.date);
      d.setHours(0, 0, 0, 0);
      return d >= today && b.status !== 'cancelled';
    });
  }, [userBookings]);

  const list = mode === 'upcoming' ? upcoming : userBookings;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });

  return (
    <PickCourtMemberLayout title="我的預約" subtitle="查看即將到來與過往的場地預約">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'upcoming'
                ? 'bg-pickcourt-gold text-pickcourt-navy-dark'
                : 'bg-white border border-slate-200 text-gray-600 hover:border-pickcourt-gold/40'
            }`}
          >
            即將到來 {upcoming.length > 0 && `(${upcoming.length})`}
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === 'all'
                ? 'bg-pickcourt-gold text-pickcourt-navy-dark'
                : 'bg-white border border-slate-200 text-gray-600 hover:border-pickcourt-gold/40'
            }`}
          >
            全部記錄 {userBookings.length > 0 && `(${userBookings.length})`}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-pickcourt-gold/20 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin h-10 w-10 border-2 border-pickcourt-gold border-t-transparent rounded-full mx-auto" />
              <p className="mt-4 text-gray-500">載入中…</p>
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">暫無預約記錄</p>
              <Link
                to={PICKCOURT_SEARCH}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pickcourt-gold text-pickcourt-navy-dark font-semibold hover:bg-pickcourt-gold-light transition-colors"
              >
                搜尋場地預約
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((booking) => (
                <li key={booking._id} className="p-5 sm:p-6 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-pickcourt-navy">{booking.court?.name || '場地'}</h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            statusClass[booking.status] || statusClass.pending
                          }`}
                        >
                          {statusLabel[booking.status] || booking.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-1">
                        <MapPinIcon className="w-4 h-4 shrink-0" />
                        {typeof booking.court?.store === 'object' && booking.court.store?.name
                          ? booking.court.store.name
                          : '店鋪'}
                      </p>
                      <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-1">
                        <CalendarDaysIcon className="w-4 h-4 shrink-0 text-pickcourt-gold" />
                        {formatDate(booking.date)}
                      </p>
                      <p className="text-sm text-gray-700 flex items-center gap-1.5 mt-0.5">
                        <ClockIcon className="w-4 h-4 shrink-0 text-pickcourt-gold" />
                        {booking.startTime} – {booking.endTime}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PickCourtMemberLayout>
  );
};

export default AccountBookings;
