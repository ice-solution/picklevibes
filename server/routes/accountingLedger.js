const express = require('express');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const AccountingTransaction = require('../models/AccountingTransaction');
const Store = require('../models/Store');
const { auth, adminAuth } = require('../middleware/auth');
const { isSuperAdmin } = require('../utils/adminAccess');
const { receiptUpload, deleteFile } = require('../middleware/upload');
const {
  ACCOUNTING_CATEGORIES,
  isAllowedAccountingCategory,
  isValidAccountingCategoryForUpdate,
} = require('../constants/accountingCategories');

const router = express.Router();

function parseAmount(input) {
  const amt = parseFloat(String(input || '').replace(/,/g, ''), 10);
  return Number.isFinite(amt) ? amt : NaN;
}

function parseLedgerDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildDateRange(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

function formatRow(row) {
  return {
    _id: row._id,
    store: row.store,
    type: row.type,
    amount: row.amount,
    date: row.date,
    category: row.category,
    note: row.note || '',
    imagePath: row.imagePath || '',
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function canModifyTransaction(req, tx) {
  if (isSuperAdmin(req.user)) return true;
  return String(tx.createdBy) === String(req.user.id || req.user._id);
}

async function aggregateTotals(match) {
  const [incomeRows, expenseRows] = await Promise.all([
    AccountingTransaction.aggregate([
      { $match: { ...match, type: 'income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    AccountingTransaction.aggregate([
      { $match: { ...match, type: 'expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);
  const income = incomeRows[0]?.total || 0;
  const expense = expenseRows[0]?.total || 0;
  return { income, expense, net: income - expense };
}

// @route   GET /api/accounting/ledger/categories
router.get('/categories', [auth, adminAuth], (_req, res) => {
  res.json({ categories: ACCOUNTING_CATEGORIES });
});

// @route   GET /api/accounting/ledger/summary
router.get('/summary', [auth, adminAuth], async (req, res) => {
  try {
    const { from, to, store } = req.query;
    const match = {};
    if (store) match.store = store;
    const dateRange = buildDateRange(from, to);
    if (dateRange) match.date = dateRange;

    const period = await aggregateTotals(match);
    const allTime = await aggregateTotals(store ? { store } : {});

    res.json({
      success: true,
      data: { period, allTime },
    });
  } catch (error) {
    console.error('會計收支摘要錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/accounting/ledger
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      from,
      to,
      category,
      store,
    } = req.query;

    const q = {};
    if (type === 'income' || type === 'expense') q.type = type;
    if (category && String(category).trim()) q.category = String(category).trim();
    if (store) q.store = store;
    const dateRange = buildDateRange(from, to);
    if (dateRange) q.date = dateRange;

    const limitN = Math.min(parseInt(limit, 10) || 50, 200);
    const pageN = Math.max(parseInt(page, 10) || 1, 1);

    const [items, total, totals] = await Promise.all([
      AccountingTransaction.find(q)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageN - 1) * limitN)
        .limit(limitN)
        .populate('createdBy', 'name email')
        .populate('store', 'name isActive')
        .lean(),
      AccountingTransaction.countDocuments(q),
      aggregateTotals(q),
    ]);

    res.json({
      success: true,
      items: items.map(formatRow),
      totals,
      pagination: {
        page: pageN,
        limit: limitN,
        total,
        totalPages: Math.ceil(total / limitN) || 1,
      },
    });
  } catch (error) {
    console.error('會計收支列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/accounting/ledger
router.post('/', [
  auth,
  adminAuth,
  receiptUpload.single('receipt'),
  body('store').notEmpty().withMessage('請選擇店鋪'),
  body('type').isIn(['income', 'expense']).withMessage('類型須為 income 或 expense'),
  body('amount').notEmpty().withMessage('請填寫金額'),
  body('date').notEmpty().withMessage('請填寫日期'),
  body('category').notEmpty().withMessage('請選擇類別'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const storeDoc = await Store.findById(req.body.store);
    if (!storeDoc) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '店鋪不存在' });
    }

    const amt = parseAmount(req.body.amount);
    const d = parseLedgerDate(req.body.date);
    if (!Number.isFinite(amt) || amt < 0) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '金額無效' });
    }
    if (!d) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '日期無效' });
    }
    if (!isAllowedAccountingCategory(req.body.category)) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '請從清單選擇類別' });
    }

    const imagePath = req.file ? `/uploads/receipts/${req.file.filename}` : '';

    const tx = await AccountingTransaction.create({
      store: storeDoc._id,
      type: req.body.type,
      amount: amt,
      date: d,
      category: String(req.body.category).trim(),
      note: req.body.note ? String(req.body.note).trim() : '',
      imagePath,
      createdBy: req.user.id,
    });

    const populated = await AccountingTransaction.findById(tx._id)
      .populate('createdBy', 'name email')
      .populate('store', 'name isActive');

    res.status(201).json({
      message: '收支紀錄已建立',
      item: formatRow(populated),
    });
  } catch (error) {
    if (req.file) await deleteFile(req.file.path);
    console.error('建立會計收支錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤' });
  }
});

// @route   PUT /api/accounting/ledger/:id
router.put('/:id', [
  auth,
  adminAuth,
  receiptUpload.single('receipt'),
], async (req, res) => {
  try {
    const tx = await AccountingTransaction.findById(req.params.id);
    if (!tx) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(404).json({ message: '紀錄不存在' });
    }
    if (!canModifyTransaction(req, tx)) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(403).json({ message: '無權限編輯此紀錄' });
    }

    const storeDoc = req.body.store ? await Store.findById(req.body.store) : null;
    if (req.body.store && !storeDoc) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '店鋪不存在' });
    }

    if (req.body.type && !['income', 'expense'].includes(req.body.type)) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '類型無效' });
    }

    const amt = req.body.amount != null ? parseAmount(req.body.amount) : tx.amount;
    const d = req.body.date ? parseLedgerDate(req.body.date) : tx.date;

    if (!Number.isFinite(amt) || amt < 0) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '金額無效' });
    }
    if (!d) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '日期無效' });
    }
    if (req.body.category && !isValidAccountingCategoryForUpdate(req.body.category, tx.category)) {
      if (req.file) await deleteFile(req.file.path);
      return res.status(400).json({ message: '請從清單選擇類別' });
    }

    if (req.file) {
      if (tx.imagePath) {
        const old = path.join(__dirname, '../../', tx.imagePath.replace(/^\//, ''));
        await deleteFile(old);
      }
      tx.imagePath = `/uploads/receipts/${req.file.filename}`;
    }

    if (storeDoc) tx.store = storeDoc._id;
    if (req.body.type) tx.type = req.body.type;
    tx.amount = amt;
    tx.date = d;
    if (req.body.category) tx.category = String(req.body.category).trim();
    if (req.body.note !== undefined) tx.note = String(req.body.note || '').trim();

    await tx.save();

    const populated = await AccountingTransaction.findById(tx._id)
      .populate('createdBy', 'name email')
      .populate('store', 'name isActive');

    res.json({
      message: '收支紀錄已更新',
      item: formatRow(populated),
    });
  } catch (error) {
    if (req.file) await deleteFile(req.file.path);
    console.error('更新會計收支錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤' });
  }
});

// @route   DELETE /api/accounting/ledger/:id
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const tx = await AccountingTransaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ message: '紀錄不存在' });
    if (!canModifyTransaction(req, tx)) {
      return res.status(403).json({ message: '無權限刪除此紀錄' });
    }

    if (tx.imagePath) {
      const p = path.join(__dirname, '../../', tx.imagePath.replace(/^\//, ''));
      await deleteFile(p);
    }
    await tx.deleteOne();

    res.json({ message: '收支紀錄已刪除' });
  } catch (error) {
    console.error('刪除會計收支錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
