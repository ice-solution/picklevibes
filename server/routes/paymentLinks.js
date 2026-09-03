const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const PaymentLink = require('../models/PaymentLink');
const PaymentLinkPayment = require('../models/PaymentLinkPayment');
const Store = require('../models/Store');
const UserBalance = require('../models/UserBalance');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');
const { assertStoreFeatureAccess } = require('../utils/tenantAccess');
const {
  assertNotShareholderWrite,
} = require('../utils/tenantPermissions');
const {
  assertLinkPayable,
  payWithPoints,
  createGatewayCheckout,
  serializePublicLink,
  completeGatewayPayment,
  refundPaymentLinkPayment,
  retryWonderRefundPayment,
} = require('../services/paymentLinkPaymentService');
const { getPaymentProvider } = require('../config/paymentProvider');

const router = express.Router();

// ─── Public ───────────────────────────────────────────────

router.get('/public/payments/:paymentId/confirm', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    let payment = await PaymentLinkPayment.findById(req.params.paymentId);
    if (!payment) {
      return res.status(404).json({ message: '付款記錄不存在' });
    }

    const sessionId = req.query.session_id;
    if (
      payment.status === 'pending' &&
      payment.method === 'stripe' &&
      sessionId &&
      process.env.STRIPE_SECRET_KEY
    ) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(String(sessionId));
        if (session.payment_status === 'paid') {
          await completeGatewayPayment(payment._id, session.id);
          payment = await PaymentLinkPayment.findById(payment._id);
        }
      } catch (e) {
        console.warn('payment link stripe confirm fallback:', e.message);
      }
    }

    res.json({
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      paidAt: payment.payment?.paidAt || null,
    });
  } catch (error) {
    console.error('confirm payment link:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/public/payments/:paymentId', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.paymentId)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const payment = await PaymentLinkPayment.findById(req.params.paymentId)
      .populate('link', 'title code amount')
      .lean();
    if (!payment) {
      return res.status(404).json({ message: '付款記錄不存在' });
    }
    res.json({
      payment: {
        _id: payment._id,
        status: payment.status,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.payment?.paidAt || null,
        link: payment.link
          ? {
              title: payment.link.title,
              code: payment.link.code,
              amount: payment.link.amount,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('get payment link payment:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/public/:code', optionalAuth, async (req, res) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toLowerCase();
    const link = await PaymentLink.findOne({ code }).populate('store', 'name slug');
    if (!link) {
      return res.status(404).json({ message: '收款連結不存在' });
    }
    const check = await assertLinkPayable(link);
    if (check.error) {
      return res.status(check.status || 403).json({
        message: check.error,
        closed: check.error.includes('關閉'),
        expired: check.error.includes('過期'),
        link: serializePublicLink(link, link.store, req.user || null),
      });
    }
    res.json({
      link: serializePublicLink(link, link.store, req.user || null),
      paymentProvider: getPaymentProvider(),
    });
  } catch (error) {
    console.error('get public payment link:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/public/:code/pay-points',
  auth,
  [body('payerNote').optional().trim().isLength({ max: 200 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      const code = String(req.params.code || '')
        .trim()
        .toLowerCase();
      const link = await PaymentLink.findOne({ code });
      if (!link) {
        return res.status(404).json({ message: '收款連結不存在' });
      }

      const result = await payWithPoints({
        link,
        userId: req.user.id || req.user._id,
        payerNote: req.body.payerNote || '',
        user: req.user,
      });
      if (result.error) {
        return res.status(result.status || 400).json({ message: result.error });
      }

      const balance = await UserBalance.findOne({ user: req.user.id || req.user._id });
      res.json({
        message: '積分付款成功',
        payment: result.payment,
        balance: balance?.balance ?? 0,
      });
    } catch (error) {
      console.error('pay-points payment link:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.post(
  '/public/:code/pay-gateway',
  optionalAuth,
  [
    body('contactEmail').optional({ checkFalsy: true }).trim().isEmail().withMessage('電郵格式不正確'),
    body('contactPhone').optional().trim().isLength({ max: 30 }),
    body('payerNote').optional().trim().isLength({ max: 200 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      const code = String(req.params.code || '')
        .trim()
        .toLowerCase();
      const link = await PaymentLink.findOne({ code });
      if (!link) {
        return res.status(404).json({ message: '收款連結不存在' });
      }

      const userId = req.user ? req.user.id || req.user._id : null;
      const result = await createGatewayCheckout({
        link,
        userId,
        user: req.user || null,
        contactEmail: req.body.contactEmail || '',
        contactPhone: req.body.contactPhone || '',
        payerNote: req.body.payerNote || '',
      });
      if (result.error) {
        return res.status(result.status || 400).json({ message: result.error });
      }

      res.json({
        message: '支付會話創建成功',
        url: result.url,
        paymentId: result.payment._id,
        provider: result.provider,
      });
    } catch (error) {
      console.error('pay-gateway payment link:', error);
      res.status(500).json({ message: error.message || '服務器錯誤' });
    }
  }
);

// ─── Admin ────────────────────────────────────────────────

router.use(auth, adminAuth);

function requirePaymentLinksAccess(req, res, storeId) {
  const feature = assertStoreFeatureAccess(req.tenantAccess, storeId, 'paymentLinks');
  if (!feature.ok) {
    return res.status(feature.status).json({ message: feature.message });
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.store) {
      if (!mongoose.isValidObjectId(req.query.store)) {
        return res.status(400).json({ message: '無效店鋪 ID' });
      }
      const denied = requirePaymentLinksAccess(req, res, req.query.store);
      if (denied) return denied;
      filter.store = req.query.store;
    } else if (!req.tenantAccess?.isPlatformAdmin) {
      const allowed = (req.tenantAccess?.managedStores || [])
        .filter((s) => {
          const check = assertStoreFeatureAccess(req.tenantAccess, s.id, 'paymentLinks');
          return check.ok;
        })
        .map((s) => s.id);
      filter.store = { $in: allowed };
    }

    if (req.query.isActive === 'true') filter.isActive = true;
    if (req.query.isActive === 'false') filter.isActive = false;

    const links = await PaymentLink.find(filter)
      .populate('store', 'name slug')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ links });
  } catch (error) {
    console.error('list payment links:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/',
  [
    body('store').notEmpty().withMessage('請選擇店鋪'),
    body('title').trim().notEmpty().withMessage('請輸入標題'),
    body('amount').isFloat({ min: 1 }).withMessage('正價至少 HK$1'),
    body('pointsAmount').isFloat({ min: 1 }).withMessage('積分價至少 1'),
    body('description').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const storeId = req.body.store || req.body.storeId;
      if (!mongoose.isValidObjectId(storeId)) {
        return res.status(400).json({ message: '無效店鋪 ID' });
      }
      const denied = requirePaymentLinksAccess(req, res, storeId);
      if (denied) return denied;
      const writeGuard = assertNotShareholderWrite(req.tenantAccess, storeId);
      if (!writeGuard.ok) {
        return res.status(writeGuard.status).json({ message: writeGuard.message });
      }
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ message: '店鋪不存在' });

      let expiresAt = null;
      if (req.body.expiresAt) {
        expiresAt = new Date(req.body.expiresAt);
        if (Number.isNaN(expiresAt.getTime())) {
          return res.status(400).json({ message: '過期日格式無效' });
        }
      }

      const code = await PaymentLink.generateUniqueCode();
      const link = await PaymentLink.create({
        store: store._id,
        title: String(req.body.title).trim(),
        description: String(req.body.description || '').trim(),
        amount: Number(req.body.amount),
        pointsAmount: Number(req.body.pointsAmount),
        code,
        isActive: req.body.isActive !== false,
        expiresAt,
        createdBy: req.user.id || req.user._id,
      });

      const populated = await PaymentLink.findById(link._id)
        .populate('store', 'name slug')
        .populate('createdBy', 'name email');
      res.status(201).json({ link: populated });
    } catch (error) {
      console.error('create payment link:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.patch(
  '/:id',
  [
    body('title').optional().trim().notEmpty().withMessage('標題不能為空'),
    body('amount').optional().isFloat({ min: 1 }).withMessage('正價至少 HK$1'),
    body('pointsAmount').optional().isFloat({ min: 1 }).withMessage('積分價至少 1'),
  ],
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: '無效 ID' });
      }
      const link = await PaymentLink.findById(req.params.id);
      if (!link) return res.status(404).json({ message: '收款連結不存在' });
      const denied = requirePaymentLinksAccess(req, res, link.store);
      if (denied) return denied;
      const writeGuard = assertNotShareholderWrite(req.tenantAccess, link.store);
      if (!writeGuard.ok) {
        return res.status(writeGuard.status).json({ message: writeGuard.message });
      }

      if (req.body.title != null) link.title = String(req.body.title).trim();
      if (req.body.description != null) {
        link.description = String(req.body.description).trim();
      }
      if (req.body.amount != null) link.amount = Number(req.body.amount);
      if (req.body.pointsAmount != null) link.pointsAmount = Number(req.body.pointsAmount);
      if (req.body.expiresAt === null || req.body.expiresAt === '') {
        link.expiresAt = null;
      } else if (req.body.expiresAt != null) {
        const d = new Date(req.body.expiresAt);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ message: '過期日格式無效' });
        }
        link.expiresAt = d;
      }
      if (typeof req.body.isActive === 'boolean') link.isActive = req.body.isActive;

      await link.save();
      const populated = await PaymentLink.findById(link._id)
        .populate('store', 'name slug')
        .populate('createdBy', 'name email');
      res.json({ link: populated });
    } catch (error) {
      console.error('update payment link:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.patch('/:id/toggle', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const link = await PaymentLink.findById(req.params.id);
    if (!link) return res.status(404).json({ message: '收款連結不存在' });
    const denied = requirePaymentLinksAccess(req, res, link.store);
    if (denied) return denied;
    const writeGuard = assertNotShareholderWrite(req.tenantAccess, link.store);
    if (!writeGuard.ok) {
      return res.status(writeGuard.status).json({ message: writeGuard.message });
    }

    if (typeof req.body.isActive === 'boolean') {
      link.isActive = req.body.isActive;
    } else {
      link.isActive = !link.isActive;
    }
    await link.save();
    res.json({ link });
  } catch (error) {
    console.error('toggle payment link:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const link = await PaymentLink.findById(req.params.id).select('store').lean();
    if (!link) return res.status(404).json({ message: '收款連結不存在' });
    const denied = requirePaymentLinksAccess(req, res, link.store);
    if (denied) return denied;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      PaymentLinkPayment.find({ link: link._id || req.params.id })
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentLinkPayment.countDocuments({ link: req.params.id }),
    ]);

    res.json({
      payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error('list payment link payments:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/:id/payments/:paymentId/refund',
  [body('reason').optional().trim().isLength({ max: 200 }).withMessage('退款原因不能超過200個字符')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.paymentId)) {
        return res.status(400).json({ message: '無效 ID' });
      }

      const link = await PaymentLink.findById(req.params.id).select('store').lean();
      if (!link) return res.status(404).json({ message: '收款連結不存在' });
      const denied = requirePaymentLinksAccess(req, res, link.store);
      if (denied) return denied;
      const writeGuard = assertNotShareholderWrite(req.tenantAccess, link.store);
      if (!writeGuard.ok) {
        return res.status(writeGuard.status).json({ message: writeGuard.message });
      }

      const result = await refundPaymentLinkPayment({
        linkId: req.params.id,
        paymentId: req.params.paymentId,
        cancelledBy: req.user.id || req.user._id,
        reason: req.body.reason || '',
      });
      if (result.error) {
        return res.status(result.status || 400).json({ message: result.error });
      }

      res.json({
        message: '退款成功，會計已記錄取消',
        payment: result.payment,
      });
    } catch (error) {
      console.error('refund payment link payment:', error);
      res.status(500).json({ message: error.message || '退款失敗' });
    }
  }
);

router.post(
  '/:id/payments/:paymentId/retry-wonder-refund',
  [body('reason').optional().trim().isLength({ max: 200 }).withMessage('退款原因不能超過200個字符')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }
      if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.paymentId)) {
        return res.status(400).json({ message: '無效 ID' });
      }

      const link = await PaymentLink.findById(req.params.id).select('store').lean();
      if (!link) return res.status(404).json({ message: '收款連結不存在' });
      const denied = requirePaymentLinksAccess(req, res, link.store);
      if (denied) return denied;
      const writeGuard = assertNotShareholderWrite(req.tenantAccess, link.store);
      if (!writeGuard.ok) {
        return res.status(writeGuard.status).json({ message: writeGuard.message });
      }

      const result = await retryWonderRefundPayment({
        linkId: req.params.id,
        paymentId: req.params.paymentId,
        cancelledBy: req.user.id || req.user._id,
        reason: req.body.reason || '',
      });
      if (result.error) {
        return res.status(result.status || 400).json({ message: result.error });
      }

      res.json({
        message: 'Wonder 退款已確認',
        payment: result.payment,
      });
    } catch (error) {
      console.error('retry wonder refund payment link:', error);
      res.status(500).json({ message: error.message || 'Wonder 退款重試失敗' });
    }
  }
);

module.exports = router;
