import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { getThisMonthRangeHK } from '../../utils/coachDateRange';
import {
  CalculatorIcon,
  DocumentArrowDownIcon,
  BanknotesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

type PayrollLine = {
  coachClassId: string;
  title: string;
  sessionDateYmd: string;
  startTime: string;
  endTime: string;
  locationLabel: string;
  hours: number;
  hourlyRate: number;
  amount: number;
  multiCoach: boolean;
  storeName?: string;
};

type CoachUnpaidRow = {
  coachId: string;
  name: string;
  email: string;
  phone?: string;
  coachPaymentInfo?: string;
  classCount: number;
  totalHours: number;
  totalAmount: number;
  multiCoachClassCount: number;
  classIds: string[];
  lines: PayrollLine[];
};

type PayoutRow = {
  _id: string;
  coach?: { name?: string; email?: string };
  dateFrom: string;
  dateTo: string;
  classCount: number;
  totalAmount: number;
  settledAt?: string;
  pdfUrl?: string;
  multiCoachClassCount?: number;
};

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString('en-HK', { maximumFractionDigits: 2 })}`;

const CoachPayrollManagement: React.FC = () => {
  const month = useMemo(() => getThisMonthRangeHK(), []);
  const [dateFrom, setDateFrom] = useState(month.from);
  const [dateTo, setDateTo] = useState(month.to);
  const [summary, setSummary] = useState<{
    coachCount: number;
    classCount: number;
    totalAmount: number;
    coaches: CoachUnpaidRow[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const res = await api.get('/coach-classes/payouts', { params: { limit: 30 } });
      setPayouts(res.data?.payouts || []);
    } catch (e) {
      console.error(e);
      setPayouts([]);
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  const runCalculate = async () => {
    setLoading(true);
    try {
      const res = await api.get('/coach-classes/unpaid-summary', {
        params: { dateFrom, dateTo },
      });
      setSummary({
        coachCount: res.data?.coachCount || 0,
        classCount: res.data?.classCount || 0,
        totalAmount: res.data?.totalAmount || 0,
        coaches: res.data?.coaches || [],
      });
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || '一鍵計數失敗');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const settleCoach = async (row: CoachUnpaidRow) => {
    const multiNote =
      row.multiCoachClassCount > 0
        ? `\n注意：其中 ${row.multiCoachClassCount} 堂為多教練課堂，確認後會整堂標為已付。`
        : '';
    if (
      !window.confirm(
        `確認結算「${row.name}」？\n期間 ${dateFrom} ～ ${dateTo}\n${row.classCount} 堂 · 合計 ${money(
          row.totalAmount
        )}${multiNote}\n\n完成後會標記已付款、寫入會計，並產生 PDF 明細。`
      )
    ) {
      return;
    }

    setSettlingId(row.coachId);
    try {
      const res = await api.post('/coach-classes/settle-coach', {
        coachId: row.coachId,
        dateFrom,
        dateTo,
        classIds: row.classIds,
      });
      alert(res.data?.message || '結算完成');
      if (res.data?.payout?._id) {
        await downloadPdf(res.data.payout._id);
      }
      await runCalculate();
      await loadPayouts();
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || '結算失敗');
    } finally {
      setSettlingId(null);
    }
  };

  const downloadPdf = async (payoutId: string) => {
    try {
      const res = await api.get(`/coach-classes/payouts/${payoutId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coach-payout-${payoutId}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.message || '下載 PDF 失敗');
    }
  };

  const resetThisMonth = () => {
    const r = getThisMonthRangeHK();
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BanknotesIcon className="w-6 h-6 text-violet-600" />
            教練薪資結算
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            一鍵計算各教練未付課堂，確認找數後標記已付款並產生 PDF 明細。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-sm text-gray-600">期間</label>
        <input
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        />
        <span className="text-gray-400">至</span>
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={resetThisMonth}
          className="text-xs text-violet-700 hover:underline"
        >
          本月
        </button>
        <button
          type="button"
          onClick={runCalculate}
          disabled={loading || !dateFrom || !dateTo}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <CalculatorIcon className="w-4 h-4" />
          {loading ? '計算中…' : '一鍵計數'}
        </button>
      </div>

      {summary && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
              <div className="text-xs text-violet-700">未付教練</div>
              <div className="text-2xl font-bold text-violet-900">{summary.coachCount}</div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
              <div className="text-xs text-violet-700">未付課堂</div>
              <div className="text-2xl font-bold text-violet-900">{summary.classCount}</div>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
              <div className="text-xs text-violet-700">應付合計</div>
              <div className="text-2xl font-bold text-violet-900">{money(summary.totalAmount)}</div>
            </div>
          </div>

          {summary.coaches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              此期間沒有未付款課堂
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3">教練</th>
                    <th className="px-4 py-3 text-right">堂數</th>
                    <th className="px-4 py-3 text-right">時數</th>
                    <th className="px-4 py-3 text-right">應付</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.coaches.map((row) => {
                    const open = Boolean(expanded[row.coachId]);
                    return (
                      <React.Fragment key={row.coachId}>
                        <tr className="hover:bg-gray-50/80">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 font-medium text-gray-900"
                              onClick={() =>
                                setExpanded((s) => ({ ...s, [row.coachId]: !open }))
                              }
                            >
                              {open ? (
                                <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                              )}
                              {row.name}
                            </button>
                            <div className="text-xs text-gray-500 ml-5">
                              {row.email}
                              {row.multiCoachClassCount > 0 && (
                                <span className="ml-2 text-amber-700">
                                  · {row.multiCoachClassCount} 堂多教練
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.classCount}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.totalHours}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">
                            {money(row.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={settlingId === row.coachId}
                              onClick={() => settleCoach(row)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <DocumentArrowDownIcon className="w-4 h-4" />
                              {settlingId === row.coachId ? '結算中…' : '找數並出 PDF'}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-slate-50">
                            <td colSpan={5} className="px-4 py-3">
                              <table className="min-w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="py-1 text-left font-medium">日期</th>
                                    <th className="py-1 text-left font-medium">時間</th>
                                    <th className="py-1 text-left font-medium">課堂</th>
                                    <th className="py-1 text-right font-medium">時數</th>
                                    <th className="py-1 text-right font-medium">金額</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.lines.map((line) => (
                                    <tr key={line.coachClassId} className="border-t border-gray-100">
                                      <td className="py-1.5">{line.sessionDateYmd}</td>
                                      <td className="py-1.5">
                                        {line.startTime}–{line.endTime}
                                      </td>
                                      <td className="py-1.5">
                                        {line.title}
                                        {line.multiCoach && (
                                          <span className="ml-1 text-amber-700">（多教練）</span>
                                        )}
                                        {line.locationLabel && (
                                          <div className="text-gray-400">{line.locationLabel}</div>
                                        )}
                                      </td>
                                      <td className="py-1.5 text-right tabular-nums">{line.hours}</td>
                                      <td className="py-1.5 text-right tabular-nums">
                                        {money(line.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">最近結算紀錄</h3>
        {payoutsLoading ? (
          <div className="text-sm text-gray-500">載入中…</div>
        ) : payouts.length === 0 ? (
          <div className="text-sm text-gray-500">尚未有結算紀錄</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2">教練</th>
                  <th className="px-4 py-2">期間</th>
                  <th className="px-4 py-2 text-right">堂數</th>
                  <th className="px-4 py-2 text-right">金額</th>
                  <th className="px-4 py-2 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payouts.map((p) => (
                  <tr key={p._id}>
                    <td className="px-4 py-2">{p.coach?.name || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {p.dateFrom} ～ {p.dateTo}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.classCount}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {money(p.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => downloadPdf(p._id)}
                        className="text-violet-700 hover:underline text-xs"
                      >
                        下載
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachPayrollManagement;
