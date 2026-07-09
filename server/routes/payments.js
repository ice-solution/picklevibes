const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const StripeTransaction = require('../models/StripeTransaction');
const Recharge = require('../models/Recharge');
const { auth } = require('../middleware/auth');
const { getPaymentProvider } = require('../config/paymentProvider');
const {
  completeRechargePayment,
  parseRechargeIdFromReference,
} = require('../services/rechargePaymentService');

const stripe =
  process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

const router = express.Router();

// 預約現在使用積分支付，不再需要 Stripe Checkout Session

// 預約現在使用積分支付，不再需要 Stripe Payment Intent

// 預約現在使用積分支付，不再需要 Stripe 支付確認

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
    if (!stripe) {
      return res.status(503).json({ message: 'Stripe 退款未啟用' });
    }
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

// 預約現在使用積分支付，不再需要 Stripe Checkout 成功回調

// @route   POST /api/payments/wonder/webhook
// @desc    Wonder Payment webhook（與 checkinSystem 相同：body 為 Invoice JSON）
router.post('/wonder/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    console.log('📨 Wonder webhook:', {
      time: new Date().toISOString(),
      headers: req.headers,
      query,
      body,
    });

    const referenceNumber = body.reference_number || query.reference_number || body.order?.reference_number;
    const state = String(body.state || body.order?.state || '').toLowerCase();
    const correspondenceState = String(
      body.correspondence_state || body.order?.correspondence_state || ''
    ).toLowerCase();
    const isPaid = state === 'completed' || correspondenceState === 'paid';

    const rechargeId = parseRechargeIdFromReference(referenceNumber);
    if (!rechargeId) {
      console.warn('⚠️ Wonder webhook: 找不到 recharge reference_number', referenceNumber);
      return res.status(200).json({ received: true, warning: 'Recharge not found' });
    }

    if (isPaid) {
      const orderNumber = body.number || body.order?.number || referenceNumber;
      await completeRechargePayment(rechargeId, orderNumber);
      console.log('✅ Wonder 充值已完成:', rechargeId);
    } else {
      console.log('ℹ️ Wonder webhook 非 paid 狀態:', { state, correspondenceState, referenceNumber });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Wonder webhook 錯誤:', error);
    res.status(200).json({ received: true, error: error.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Stripe webhook處理
router.post('/webhook', async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ message: 'Stripe webhook 未啟用' });
  }
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
      
      // 預約現在使用積分支付，不再需要 Stripe 處理
      console.log('⚠️  收到 payment_intent.succeeded，但預約現在使用積分支付，跳過處理');
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('支付失敗:', failedPayment.id);
      
      // 預約現在使用積分支付，不再需要 Stripe 處理
      console.log('⚠️  收到 payment_intent.payment_failed，但預約現在使用積分支付，跳過處理');
      break;

    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout Session 完成:', session.id);
      console.log('支付狀態:', session.payment_status);
      
      // 從 metadata 獲取訂單信息
      const bookingId = session.metadata?.bookingId;
      const rechargeId = session.metadata?.rechargeId;
      
      // 只有在支付成功時才更新
      if (session.payment_status === 'paid') {
        console.log('✅ 支付已完成，處理訂單...');
        
        // 預約現在使用積分支付，不再需要 Stripe 處理
        if (bookingId) {
          console.log('⚠️  收到預約訂單 webhook，但預約現在使用積分支付，跳過處理');
        }
        
        // 處理充值訂單
        if (rechargeId) {
          console.log('💰 處理充值訂單:', rechargeId);
          try {
            await completeRechargePayment(rechargeId, session.id);
            console.log('✅ 充值已完成，用戶餘額已更新');
          } catch (rechargeErr) {
            console.error('❌ 充值完成處理失敗:', rechargeErr);
          }
        }
        
        // 如果沒有找到任何訂單ID
        if (!bookingId && !rechargeId) {
          console.error('❌ Checkout Session 缺少訂單 metadata (bookingId 或 rechargeId)');
        }

        // 更新或創建 Stripe 交易記錄
        await StripeTransaction.findOneAndUpdate(
          { paymentIntentId: session.id },
          { 
            paymentIntentId: session.id,
            booking: bookingId || null,
            recharge: rechargeId || null,
            user: session.metadata?.userId,
            amount: session.amount_total,
            currency: session.currency,
            status: 'succeeded',
            paidAt: new Date(),
            paymentMethod: session.payment_method_types,
            stripeResponse: session
          },
          { upsert: true, new: true }
        );
        
        console.log('✅ 交易記錄已更新');
      } else {
        console.log('⚠️  支付未完成，狀態:', session.payment_status);
      }
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
