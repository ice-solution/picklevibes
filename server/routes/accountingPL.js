const express = require('express');
const { auth, adminAuth } = require('../middleware/auth');
const { formatHkYmd, defaultFinanceFromYmd } = require('../utils/financeRevenue');
const { computeAccountingPL } = require('../utils/accountingPL');

const router = express.Router();

function parseYmd(raw, fallback) {
  if (!raw || typeof raw !== 'string') return fallback;
  const s = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
}

// @route   GET /api/accounting/pl
// @desc    綜合損益（系統認列收入 + 手動收支）
// @access  Private (Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const today = formatHkYmd();
    const fromYmd = parseYmd(req.query.from, defaultFinanceFromYmd(today));
    const toYmd = parseYmd(req.query.to, today);

    if (fromYmd > toYmd) {
      return res.status(400).json({ message: '開始日期不可晚於結束日期' });
    }

    const storeId = req.query.store || req.query.storeId || null;
    const data = await computeAccountingPL({ fromYmd, toYmd, storeId: storeId || undefined });

    res.json({ success: true, data });
  } catch (error) {
    console.error('綜合損益錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
