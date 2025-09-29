const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/Booking');
const StripeTransaction = require('../models/StripeTransaction');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    創建支付意圖
// @access  Private
router.post('/create-payment-intent', [
  auth,
  body('bookingId').isMongoId().withMessage('請提供有效的預約ID'),
  body('amount').isFloat({ min: 0 }).withMessage('金額必須大於等於0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { bookingId, amount } = req.body;

    // 驗證預約是否存在且屬於當前用戶
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({ message: '無權限支付此預約' });
    }

    if (booking.payment.status === 'paid') {
      return res.status(400).json({ message: '此預約已支付' });
    }

    // 創建Stripe支付意圖
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // 轉換為分
      currency: 'hkd',
      metadata: {
        bookingId: bookingId,
        userId: req.user.id
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // 更新預約的支付信息
    booking.payment.transactionId = paymentIntent.id;
    await booking.save();

    // 保存 Stripe 交易記錄
    const stripeTransaction = new StripeTransaction({
      paymentIntentId: paymentIntent.id,
      booking: bookingId,
      user: req.user.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      description: `預約場地: ${booking.court.name} - ${booking.date.toDateString()}`,
      metadata: {
        bookingId: bookingId,
        userId: req.user.id,
        courtName: booking.court.name
      },
      stripeResponse: paymentIntent
    });
    await stripeTransaction.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('創建支付意圖錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/payments/confirm
// @desc    確認支付
// @access  Private
router.post('/confirm', [
  auth,
  body('paymentIntentId').notEmpty().withMessage('支付意圖ID為必填項目')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { paymentIntentId } = req.body;

    // 驗證支付意圖
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: '支付未成功' });
    }

    // 查找對應的預約
    const booking = await Booking.findOne({ 
      'payment.transactionId': paymentIntentId 
    });

    if (!booking) {
      return res.status(404).json({ message: '找不到對應的預約' });
    }

    // 更新預約狀態
    booking.payment.status = 'paid';
    booking.payment.paidAt = new Date();
    booking.status = 'confirmed';
    await booking.save();

    // 更新 Stripe 交易記錄
    await StripeTransaction.findOneAndUpdate(
      { paymentIntentId: paymentIntentId },
      { 
        status: 'succeeded',
        paidAt: new Date(),
        stripeResponse: paymentIntent
      }
    );

    res.json({
      message: '支付確認成功',
      booking
    });
  } catch (error) {
    console.error('確認支付錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/payments/refund
// @desc    處理退款
// @access  Private
router.post('/refund', [
  auth,
  body('bookingId').isMongoId().withMessage('請提供有效的預約ID'),
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('退款原因不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { bookingId, reason } = req.body;

    // 查找預約
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    // 檢查權限（用戶只能退款自己的預約，管理員可以退款任何預約）
    if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '無權限處理此退款' });
    }

    if (booking.payment.status !== 'paid') {
      return res.status(400).json({ message: '此預約尚未支付，無需退款' });
    }

    if (booking.payment.status === 'refunded') {
      return res.status(400).json({ message: '此預約已退款' });
    }

    // 檢查是否可以退款（例如：預約開始前24小時內不能退款）
    const bookingDateTime = new Date(`${booking.date.toDateString()} ${booking.startTime}`);
    const now = new Date();
    const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) {
      return res.status(400).json({ message: '預約開始前24小時內不能退款' });
    }

    // 創建Stripe退款
    const refund = await stripe.refunds.create({
      payment_intent: booking.payment.transactionId,
      reason: 'requested_by_customer',
      metadata: {
        bookingId: bookingId,
        reason: reason || '用戶申請退款'
      }
    });

    // 更新預約狀態
    booking.payment.status = 'refunded';
    booking.payment.refundedAt = new Date();
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: booking.user.toString() === req.user.id ? 'user' : 'admin',
      reason: reason || '退款申請',
      refundAmount: refund.amount / 100 // 轉換回元
    };
    await booking.save();

    res.json({
      message: '退款處理成功',
      refund: {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      },
      booking
    });
  } catch (error) {
    console.error('處理退款錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/payments/history
// @desc    獲取支付歷史
// @access  Private
router.get('/history', [auth], async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const bookings = await Booking.find({ 
      user: req.user.id,
      'payment.status': { $in: ['paid', 'refunded'] }
    })
    .populate('court', 'name number')
    .sort({ 'payment.paidAt': -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Booking.countDocuments({ 
      user: req.user.id,
      'payment.status': { $in: ['paid', 'refunded'] }
    });

    res.json({
      payments: bookings.map(booking => ({
        id: booking._id,
        court: booking.court,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        amount: booking.pricing.totalPrice,
        status: booking.payment.status,
        paidAt: booking.payment.paidAt,
        refundedAt: booking.payment.refundedAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取支付歷史錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/payments/test-callback
// @desc    測試支付狀態更新 (開發用)
// @access  Public
router.post('/test-callback', async (req, res) => {
  try {
    const { bookingId, status, paymentIntentId } = req.body;
    
    if (!bookingId || !status) {
      return res.status(400).json({ message: '請提供預約ID和狀態' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    // 更新支付狀態
    if (status === 'success') {
      booking.payment.status = 'paid';
      booking.payment.paidAt = new Date();
      booking.payment.transactionId = paymentIntentId || `test_${Date.now()}`;
      booking.status = 'confirmed';
    } else if (status === 'failed') {
      booking.payment.status = 'failed';
      booking.status = 'cancelled';
    }

    await booking.save();

    // 更新或創建 Stripe 交易記錄
    const transactionId = paymentIntentId || `test_${Date.now()}`;
    await StripeTransaction.findOneAndUpdate(
      { paymentIntentId: transactionId },
      {
        paymentIntentId: transactionId,
        booking: bookingId,
        user: booking.user,
        amount: booking.pricing.totalPrice * 100, // 轉換為分
        currency: 'hkd',
        status: status === 'success' ? 'succeeded' : 'canceled',
        description: `測試支付 - 預約場地`,
        paidAt: status === 'success' ? new Date() : null,
        stripeResponse: { test: true, status }
      },
      { upsert: true, new: true }
    );

    res.json({
      message: '支付狀態更新成功',
      booking: {
        id: booking._id,
        status: booking.status,
        paymentStatus: booking.payment.status,
        paidAt: booking.payment.paidAt
      }
    });
  } catch (error) {
    console.error('測試回調錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/payments/webhook
// @desc    Stripe webhook處理
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook簽名驗證失敗:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 處理事件
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('支付成功:', paymentIntent.id);
      
      // 更新預約狀態
      await Booking.findOneAndUpdate(
        { 'payment.transactionId': paymentIntent.id },
        { 
          'payment.status': 'paid',
          'payment.paidAt': new Date(),
          status: 'confirmed'
        }
      );

      // 更新 Stripe 交易記錄
      await StripeTransaction.findOneAndUpdate(
        { paymentIntentId: paymentIntent.id },
        { 
          status: 'succeeded',
          paidAt: new Date(),
          stripeResponse: paymentIntent
        }
      );
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('支付失敗:', failedPayment.id);
      
      // 更新預約狀態
      await Booking.findOneAndUpdate(
        { 'payment.transactionId': failedPayment.id },
        { 
          'payment.status': 'failed',
          status: 'cancelled'
        }
      );

      // 更新 Stripe 交易記錄
      await StripeTransaction.findOneAndUpdate(
        { paymentIntentId: failedPayment.id },
        { 
          status: 'canceled',
          lastPaymentError: failedPayment.last_payment_error,
          stripeResponse: failedPayment
        }
      );
      break;

    default:
      console.log(`未處理的事件類型: ${event.type}`);
  }

  res.json({ received: true });
});

// @route   GET /api/payments/transactions
// @desc    獲取 Stripe 交易記錄
// @access  Private
router.get('/transactions', [auth], async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const transactions = await StripeTransaction.find(query)
      .populate('booking', 'court date startTime endTime')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await StripeTransaction.countDocuments(query);

    res.json({
      transactions: transactions.map(t => ({
        id: t._id,
        paymentIntentId: t.paymentIntentId,
        amount: t.amountInDollars,
        currency: t.currency,
        status: t.status,
        description: t.description,
        paidAt: t.paidAt,
        createdAt: t.createdAt,
        booking: t.booking,
        user: t.user
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取交易記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/payments/transactions/:id
// @desc    獲取單個 Stripe 交易記錄詳情
// @access  Private
router.get('/transactions/:id', [auth], async (req, res) => {
  try {
    const transaction = await StripeTransaction.findById(req.params.id)
      .populate('booking')
      .populate('user', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: '交易記錄不存在' });
    }

    // 檢查權限
    if (transaction.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '無權限查看此交易記錄' });
    }

    res.json({
      transaction: {
        id: transaction._id,
        paymentIntentId: transaction.paymentIntentId,
        amount: transaction.amountInDollars,
        currency: transaction.currency,
        status: transaction.status,
        description: transaction.description,
        paidAt: transaction.paidAt,
        canceledAt: transaction.canceledAt,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        booking: transaction.booking,
        user: transaction.user,
        paymentMethod: transaction.paymentMethod,
        refunds: transaction.refunds,
        lastPaymentError: transaction.lastPaymentError,
        metadata: transaction.metadata
      }
    });
  } catch (error) {
    console.error('獲取交易記錄詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
