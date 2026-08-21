const express = require('express');
const { body, validationResult } = require('express-validator');
const PosTransaction = require('../models/PosTransaction');
const Product = require('../models/Product');
const { auth, adminAuth } = require('../middleware/auth');
const {
  checkoutPos,
  cancelPosTransaction,
  formatPosOrderSummary,
  PAYMENT_LABELS,
} = require('../services/posCheckoutService');
const { canAccessStore } = require('../utils/tenantAccess');

const router = express.Router();

// @route   GET /api/pos/my-orders
// @desc    用戶 POS 店內購買記錄
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = { user: req.user.id };

    if (status === 'cancelled') {
      query.status = 'cancelled';
    } else if (status) {
      query.status = 'completed';
    }

    const transactions = await PosTransaction.find(query)
      .populate('store', 'name slug')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PosTransaction.countDocuments(query);

    res.json({
      orders: transactions.map(formatPosOrderSummary),
      pagination: {
        current: parseInt(page, 10),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('獲取用戶 POS 訂單錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/pos/my-orders/:id
router.get('/my-orders/:id', auth, async (req, res) => {
  try {
    const tx = await PosTransaction.findOne({
      _id: req.params.id,
      user: req.user.id,
    })
      .populate('store', 'name slug')
      .populate('items.product', 'name images');

    if (!tx) {
      return res.status(404).json({ message: '訂單不存在' });
    }

    res.json(formatPosOrderSummary(tx));
  } catch (error) {
    console.error('獲取 POS 訂單詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/pos/payment-methods
router.get('/payment-methods', [auth, adminAuth], (_req, res) => {
  res.json({
    methods: PosTransaction.PAYMENT_METHODS.map((value) => ({
      value,
      label: PAYMENT_LABELS[value] || value,
    })),
  });
});

// @route   GET /api/pos/products
router.get('/products', [auth, adminAuth], async (req, res) => {
  try {
    const { search, category, limit = 200 } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ sortOrder: 1, name: 1 })
      .limit(Math.min(parseInt(limit, 10) || 200, 500));

    res.json({ products });
  } catch (error) {
    console.error('POS 獲取商品錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/pos/transactions
router.get('/transactions', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, storeId, transactionNumber, status } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (storeId) {
      if (!canAccessStore(req.tenantAccess, storeId)) {
        return res.status(403).json({ message: '無權限存取此店鋪' });
      }
      query.store = storeId;
    } else if (!req.tenantAccess?.isPlatformAdmin) {
      const allowed = req.tenantAccess?.managedStoreIds || [];
      if (!allowed.length) {
        return res.json({ transactions: [], pagination: { current: 1, pages: 0, total: 0 } });
      }
      query.store = { $in: allowed };
    }

    if (transactionNumber) {
      query.transactionNumber = { $regex: transactionNumber, $options: 'i' };
    }

    const transactions = await PosTransaction.find(query)
      .populate('store', 'name slug')
      .populate('user', 'name email phone')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PosTransaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        current: parseInt(page, 10),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('POS 獲取交易列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/pos/transactions/:id
router.get('/transactions/:id', [auth, adminAuth], async (req, res) => {
  try {
    const tx = await PosTransaction.findById(req.params.id)
      .populate('store', 'name slug')
      .populate('user', 'name email phone')
      .populate('items.product', 'name images')
      .populate('createdBy', 'name email')
      .populate('cancelledBy', 'name email');

    if (!tx) {
      return res.status(404).json({ message: '交易不存在' });
    }
    if (!canAccessStore(req.tenantAccess, tx.store?._id || tx.store)) {
      return res.status(403).json({ message: '無權限存取此店鋪' });
    }

    res.json(tx);
  } catch (error) {
    console.error('POS 獲取交易詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/pos/transactions/:id/cancel
router.put('/transactions/:id/cancel', [
  auth,
  adminAuth,
  body('reason').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array(),
      });
    }

    const result = await cancelPosTransaction({
      transactionId: req.params.id,
      cancelledBy: req.user.id || req.user._id,
      reason: req.body.reason || '',
      tenantAccess: req.tenantAccess,
    });

    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    const msg = result.pointsRefunded > 0
      ? `交易已取消，已退還 ${result.pointsRefunded} 積分，庫存已恢復`
      : '交易已取消，庫存已恢復';

    res.json({
      message: msg,
      transaction: result.transaction,
      pointsRefunded: result.pointsRefunded,
    });
  } catch (error) {
    console.error('POS 取消交易錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/pos/checkout
router.post('/checkout', [
  auth,
  adminAuth,
  body('storeId').isMongoId().withMessage('請選擇店鋪'),
  body('paymentMethod').isIn(PosTransaction.PAYMENT_METHODS).withMessage('請選擇付款方式'),
  body('items').isArray({ min: 1 }).withMessage('請至少選擇一件商品'),
  body('items.*.productId').isMongoId().withMessage('無效的商品'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('數量必須是正整數'),
  body('userId').optional({ nullable: true }).isMongoId().withMessage('無效的用戶'),
  body('redeemCodeId').optional({ nullable: true }).isMongoId().withMessage('無效的兌換碼'),
  body('notes').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array(),
      });
    }

    const { storeId, userId, paymentMethod, items, notes, redeemCodeId } = req.body;

    const result = await checkoutPos({
      storeId,
      userId: userId || null,
      paymentMethod,
      items,
      notes,
      redeemCodeId: redeemCodeId || null,
      createdBy: req.user.id || req.user._id,
      tenantAccess: req.tenantAccess,
    });

    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    res.status(201).json({
      message: 'POS 結帳成功',
      transaction: result.transaction,
    });
  } catch (error) {
    console.error('POS 結帳錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
