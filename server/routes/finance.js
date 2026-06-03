const express = require('express');
const XLSX = require('xlsx');
const { auth, adminAuth } = require('../middleware/auth');
const {
  computeFinanceSummary,
  computeIncomeLines,
  formatHkYmd
} = require('../utils/financeRevenue');

const router = express.Router();

function parseYmd(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  const s = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

// @route   GET /api/finance/summary
// @desc    簡化損益：場地（出租日）+ 網店收入，積分派送折算
// @access  Private (Admin)
router.get('/summary', [auth, adminAuth], async (req, res) => {
  try {
    const today = formatHkYmd();
    const defaultFrom = `${today.slice(0, 4)}-01-01`;
    const fromYmd = parseYmd(req.query.from, defaultFrom);
    const toYmd = parseYmd(req.query.to, today);

    if (fromYmd > toYmd) {
      return res.status(400).json({ message: '開始日期不可晚於結束日期' });
    }

    const data = await computeFinanceSummary({ fromYmd, toYmd });
    res.json({ success: true, data });
  } catch (error) {
    console.error('財務摘要錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/finance/income-lines
// @desc    收入明細列表（場地出租日 + 網店扣款日）
// @access  Private (Admin)
router.get('/income-lines', [auth, adminAuth], async (req, res) => {
  try {
    const today = formatHkYmd();
    const defaultFrom = `${today.slice(0, 4)}-01-01`;
    const fromYmd = parseYmd(req.query.from, defaultFrom);
    const toYmd = parseYmd(req.query.to, today);

    if (fromYmd > toYmd) {
      return res.status(400).json({ message: '開始日期不可晚於結束日期' });
    }

    const typeFilter = req.query.type; // recognized | excluded | venue | shop
    const { lines, fromYmd: f, toYmd: t } = await computeIncomeLines({ fromYmd, toYmd });

    let filtered = lines;
    if (typeFilter === 'recognized') filtered = lines.filter((l) => l.lineType === 'recognized');
    else if (typeFilter === 'excluded') filtered = lines.filter((l) => l.lineType === 'excluded');
    else if (typeFilter === 'venue') filtered = lines.filter((l) => l.source === 'venue');
    else if (typeFilter === 'shop') filtered = lines.filter((l) => l.source === 'shop');

    const recognized = lines.filter((l) => l.lineType === 'recognized');

    res.json({
      success: true,
      data: {
        period: { fromYmd: f, toYmd: t },
        lines: filtered,
        totals: {
          lineCount: filtered.length,
          recognizedTotal: recognized.reduce((s, l) => s + l.recognized, 0),
          nominalTotal: recognized.reduce((s, l) => s + l.nominal, 0)
        }
      }
    });
  } catch (error) {
    console.error('收入明細錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/finance/summary-xlsx
// @desc    匯出簡化損益 XLSX
// @access  Private (Admin)
router.get('/summary-xlsx', [auth, adminAuth], async (req, res) => {
  try {
    const today = formatHkYmd();
    const defaultFrom = `${today.slice(0, 4)}-01-01`;
    const fromYmd = parseYmd(req.query.from, defaultFrom);
    const toYmd = parseYmd(req.query.to, today);

    const [data, { lines }] = await Promise.all([
      computeFinanceSummary({ fromYmd, toYmd }),
      computeIncomeLines({ fromYmd, toYmd })
    ]);

    const summaryRows = [
      { 項目: '期間', 數值: `${fromYmd} 至 ${toYmd}` },
      { 項目: '場地名目收入（積分）', 數值: data.venue.nominalTotal },
      { 項目: '場地認列收入', 數值: data.venue.recognizedTotal },
      { 項目: '場地扣除（派送積分折算）', 數值: data.venue.giftPointsExcluded },
      { 項目: '網店認列收入', 數值: data.shop.recognizedTotal },
      { 項目: '總認列收入', 數值: data.totals.revenueRecognized },
      { 項目: '期內付費充值（港元）', 數值: data.rechargeInPeriod.paidCashInHKD },
      { 項目: '期內派送積分（管理員手動）', 數值: data.rechargeInPeriod.manualGiftPoints }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), '損益摘要');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        data.venue.byStore.map((r) => ({
          店鋪: r.store,
          預約數: r.count,
          名目收入: r.nominal,
          認列收入: r.recognized
        }))
      ),
      '場地按店'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        lines.map((r) => ({
          計入收入: r.lineType === 'recognized' ? '是' : '否',
          收入日期: r.incomeDate,
          類別: r.category,
          店鋪: r.store || '',
          場地: r.court || '',
          訂單號: r.orderNumber || '',
          摘要: r.description,
          用戶: r.userName,
          付款方式: r.paymentMethod,
          名目: r.nominal,
          認列收入: r.recognized,
          扣除派送: r.giftExcluded,
          有價比例: r.paidPointsRatio != null ? r.paidPointsRatio : '',
          備註: r.excludeReason || ''
        }))
      ),
      '收入明細'
    );

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `損益報表_${fromYmd}_${toYmd}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buf);
  } catch (error) {
    console.error('匯出財務報表錯誤:', error);
    res.status(500).json({ message: '匯出失敗，請稍後再試' });
  }
});

module.exports = router;
