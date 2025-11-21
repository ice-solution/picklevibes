import React, { useEffect, useState } from 'react';
import api from '../../services/api';

interface CourtUsageRangeStats {
  label: string;
  hours: number;
  averageDailyHours: number;
}

interface CourtUsageMonthStats {
  year: number;
  month: number;
  ranges: {
    night: CourtUsageRangeStats;
    day: CourtUsageRangeStats;
    evening: CourtUsageRangeStats;
  };
}

interface MonthlyUsersStats {
  year: number;
  month: number;
  count: number;
}

interface CouponUsageMonthStats {
  year: number;
  month: number;
  total: number;
  byType: {
    booking: number;
    recharge: number;
  };
}

const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const AnalyticsDashboard: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courtUsage, setCourtUsage] = useState<CourtUsageMonthStats[]>([]);
  const [monthlyUsers, setMonthlyUsers] = useState<MonthlyUsersStats[]>([]);
  const [couponUsage, setCouponUsage] = useState<CouponUsageMonthStats[]>([]);

  const fetchData = async (targetYear: number) => {
    setLoading(true);
    setError(null);
    try {
      const [courtRes, usersRes, couponRes] = await Promise.all([
        api.get('/stats/court-usage', { params: { year: targetYear } }),
        api.get('/stats/monthly-users', { params: { year: targetYear } }),
        api.get('/stats/coupon-usage', { params: { year: targetYear } })
      ]);

      setCourtUsage(courtRes.data?.data || []);
      setMonthlyUsers(usersRes.data?.data || []);
      setCouponUsage(couponRes.data?.data || []);
    } catch (err: any) {
      console.error('載入分析數據失敗:', err);
      setError(err.message || '載入分析數據失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleYearChange = (delta: number) => {
    const newYear = year + delta;
    setYear(newYear);
    fetchData(newYear);
  };

  const getMonthUsers = (m: number) =>
    monthlyUsers.find((u) => u.month === m)?.count || 0;

  const getMonthCouponTotal = (m: number) =>
    couponUsage.find((c) => c.month === m)?.total || 0;

  const getMonthCouponBooking = (m: number) =>
    couponUsage.find((c) => c.month === m)?.byType.booking || 0;

  const getMonthCouponRecharge = (m: number) =>
    couponUsage.find((c) => c.month === m)?.byType.recharge || 0;

  const getMonthRangeHours = (m: number, key: keyof CourtUsageMonthStats['ranges']) => {
    const month = courtUsage.find((c) => c.month === m);
    return month ? month.ranges[key].hours : 0;
  };

  const getMonthRangeAvg = (m: number, key: keyof CourtUsageMonthStats['ranges']) => {
    const month = courtUsage.find((c) => c.month === m);
    return month ? month.ranges[key].averageDailyHours : 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">數據分析</h2>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleYearChange(-1)}
            className="px-2 py-1 text-sm border rounded-md text-gray-700 hover:bg-gray-50"
          >
            ← {year - 1}
          </button>
          <span className="text-sm font-medium text-gray-900">{year} 年</span>
          <button
            type="button"
            onClick={() => handleYearChange(1)}
            className="px-2 py-1 text-sm border rounded-md text-gray-700 hover:bg-gray-50"
          >
            {year + 1} →
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      )}

      {!loading && (
        <>
          {/* 場地使用率 */}
          <div className="bg-gray-50 rounded-lg p-4 md:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              每月場地使用時數（分時段）
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-100">
                    <th className="px-2 py-2 text-left font-medium text-gray-700">月份</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">
                      00:00-06:00 (小時 / 日均)
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">
                      07:00-15:00 (小時 / 日均)
                    </th>
                    <th className="px-2 py-2 text-right font-medium text-gray-700">
                      16:00-24:00 (小時 / 日均)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthLabels.map((label, idx) => {
                    const m = idx + 1;
                    return (
                      <tr key={m} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-gray-800">{label}</td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'night').toFixed(1)} /{' '}
                          <span className="text-gray-500">
                            {getMonthRangeAvg(m, 'night').toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'day').toFixed(1)} /{' '}
                          <span className="text-gray-500">
                            {getMonthRangeAvg(m, 'day').toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-gray-800">
                          {getMonthRangeHours(m, 'evening').toFixed(1)} /{' '}
                          <span className="text-gray-500">
                            {getMonthRangeAvg(m, 'evening').toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              備註：此表顯示每月在三個時段內的總使用小時，以及「每日平均」使用小時（以當月天數計算）。
            </p>
          </div>

          {/* 用戶 & 優惠券 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                每月註冊用戶數
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {monthLabels.map((label, idx) => {
                  const m = idx + 1;
                  return (
                    <div
                      key={m}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">{label}</span>
                      <span className="font-medium text-gray-900">
                        {getMonthUsers(m)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 md:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                每月優惠券使用次數
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {monthLabels.map((label, idx) => {
                  const m = idx + 1;
                  return (
                    <div
                      key={m}
                      className="flex flex-col text-sm border-b border-gray-100 pb-1 last:border-b-0"
                    >
                      <div className="flex justify-between">
                        <span className="text-gray-700">{label}</span>
                        <span className="font-medium text-gray-900">
                          總共：{getMonthCouponTotal(m)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                        <span>預約使用：{getMonthCouponBooking(m)}</span>
                        <span>充值使用：{getMonthCouponRecharge(m)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;


