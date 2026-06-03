import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentArrowDownIcon,
  CurrencyDollarIcon,
  InformationCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import api from '../../services/api';

interface FinanceSummary {
  timezone: string;
  period: { fromYmd: string; toYmd: string };
  methodology: Record<string, string>;
  venue: {
    bookingCount: number;
    nominalTotal: number;
    recognizedTotal: number;
    giftPointsExcluded: number;
    adminWaivedListPrice: number;
    cashLikeTotal: number;
    pointsNominalTotal: number;
    byStore: { store: string; count: number; nominal: number; recognized: number }[];
    byPaymentMethod: { method: string; count: number; nominal: number; recognized: number }[];
  };
  shop: {
    orderCount: number;
    nominalTotal: number;
    recognizedTotal: number;
    giftPointsExcluded: number;
  };
  totals: {
    revenueNominal: number;
    revenueRecognized: number;
    giftPointsExcluded: number;
  };
  rechargeInPeriod: {
    paidCashInHKD: number;
    manualGiftPoints: number;
    bonusGiftPointsFromOffers: number;
  };
}

function ymdToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function fmt(n: number) {
  return (Number(n) || 0).toLocaleString('zh-HK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const FinanceReportManagement: React.FC = () => {
  const today = ymdToday();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const [fromYmd, setFromYmd] = useState(yearStart);
  const [toYmd, setToYmd] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<FinanceSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/finance/summary', { params: { from: fromYmd, to: toYmd } });
      setData(res.data?.data || null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '載入失敗');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fromYmd, toYmd]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/finance/summary-xlsx', {
        params: { from: fromYmd, to: toYmd },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `損益報表_${fromYmd}_${toYmd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || '匯出失敗');
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CurrencyDollarIcon className="w-7 h-7 text-primary-600" />
          財務損益（簡化版）
        </h2>
        <p className="text-gray-600 mt-1">
          場地收入按<strong>出租日</strong>；積分消費依用戶「有價充值 vs 派送積分」比例認列，避免把免費派送當成收入。
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
          <input
            type="date"
            value={fromYmd}
            onChange={(e) => setFromYmd(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
          <input
            type="date"
            value={toYmd}
            onChange={(e) => setToYmd(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          重新計算
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !data}
          className="inline-flex items-center gap-2 px-4 py-2 border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          {exporting ? '匯出中…' : '匯出 XLSX'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <div className="flex gap-2 font-semibold mb-2">
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" />
          派送積分如何扣除？
        </div>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>
            <strong>管理員手動充值</strong>（用戶管理內派送）：整筆視為無現金價值，不計入有價池。
          </li>
          <li>
            <strong>付費充值優惠</strong>：實付 HK$ 為有價部分；若獲得積分 &gt; 實付金額，差額視為贈送積分。
          </li>
          <li>
            <strong>積分訂場</strong>：認列收入 = 扣款積分 ×（累計有價積分 ÷ 有價+派送積分）。
          </li>
          <li>
            <strong>現金／轉帳／Stripe 訂場</strong>：全額認列（不受積分池影響）。
          </li>
          <li>
            <strong>管理員免扣款預約</strong>（admin_waived）：不計入認列收入，另列參考金額。
          </li>
        </ul>
      </div>

      {loading && !data && (
        <div className="text-center py-16 text-gray-500">計算中…</div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">總認列收入</p>
              <p className="text-3xl font-bold text-primary-700 mt-1">
                HK$ {fmt(data.totals.revenueRecognized)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                名目合計 HK$ {fmt(data.totals.revenueNominal)}，扣除派送折算 HK${' '}
                {fmt(data.totals.giftPointsExcluded)}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">場地認列收入</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                HK$ {fmt(data.venue.recognizedTotal)}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {data.venue.bookingCount} 筆預約 · 名目 {fmt(data.venue.nominalTotal)}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-500">網店認列收入</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                HK$ {fmt(data.shop.recognizedTotal)}
              </p>
              <p className="text-xs text-gray-400 mt-2">{data.shop.orderCount} 筆已扣款訂單</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">場地收入（按店鋪）</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-2">店鋪</th>
                    <th className="px-4 py-2">筆數</th>
                    <th className="px-4 py-2 text-right">認列</th>
                  </tr>
                </thead>
                <tbody>
                  {data.venue.byStore.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                        無資料
                      </td>
                    </tr>
                  ) : (
                    data.venue.byStore.map((row) => (
                      <tr key={row.store} className="border-t">
                        <td className="px-4 py-2">{row.store}</td>
                        <td className="px-4 py-2">{row.count}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {fmt(row.recognized)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">場地收入（按付款方式）</div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-2">方式</th>
                    <th className="px-4 py-2">筆數</th>
                    <th className="px-4 py-2 text-right">名目</th>
                    <th className="px-4 py-2 text-right">認列</th>
                  </tr>
                </thead>
                <tbody>
                  {data.venue.byPaymentMethod.map((row) => (
                    <tr key={row.method} className="border-t">
                      <td className="px-4 py-2">{row.method}</td>
                      <td className="px-4 py-2">{row.count}</td>
                      <td className="px-4 py-2 text-right">{fmt(row.nominal)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(row.recognized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-900">期內充值參考（非認列收入）</p>
            <p className="text-amber-800 mt-1">
              付費充值入帳 HK$ {fmt(data.rechargeInPeriod.paidCashInHKD)} · 管理員派送積分{' '}
              {fmt(data.rechargeInPeriod.manualGiftPoints)} · 優惠贈送積分{' '}
              {fmt(data.rechargeInPeriod.bonusGiftPointsFromOffers)}
            </p>
            <p className="text-amber-700 mt-2">
              管理員免扣款預約參考名目（不計收入）：HK${' '}
              {fmt(data.venue.adminWaivedListPrice)}
            </p>
          </div>

          <p className="text-xs text-gray-500">
            此報表為管理用簡化損益，不等同正式會計師帳目。商品毛利需另備進貨成本；營運費用未包含在內。
          </p>
        </>
      )}
    </motion.div>
  );
};

export default FinanceReportManagement;
