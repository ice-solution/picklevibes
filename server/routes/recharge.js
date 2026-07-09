const express = require('express');
const { body, validationResult } = require('express-validator');
const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');
const { auth } = require('../middleware/auth');
const { getPaymentProvider } = require('../config/paymentProvider');
const wonderPaymentService = require('../services/wonderPaymentService');
const { completeRechargePayment } = require('../services/rechargePaymentService');

const router = express.Router();

const stripe =
  getPaymentProvider() === 'stripe' && process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

// 充值選項
const RECHARGE_OPTIONS = [
  { points: 500, amount: 500, label: '500分 (HK$500)' },
  { points: 1000, amount: 1000, label: '1000分 (HK$1000)' },
  { points: 1200, amount: 1200, label: '1200分 (HK$1200)' },
  { points: 2000, amount: 2000, label: '2000分 (HK$2000)' },
];

const MIN_RECHARGE_POINTS = 100;
const MIN_RECHARGE_AMOUNT = 100;

function getApiBaseUrl() {
  if (process.env.WONDER_CALLBACK_URL) {
    return process.env.WONDER_CALLBACK_URL.replace(/\/payments\/wonder\/webhook\/?$/, '');
  }
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL.replace(/\/$/, '');
  }
  const client = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${client}/api`;
}

async function createStripeCheckoutSession(recharge, req, points, amount) {
  if (!stripe) {
    throw new Error('Stripe 未設定 STRIPE_SECRET_KEY');
  }
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'hkd',
          product_data: {
            name: `帳戶充值 - ${points}分`,
            description: `為您的帳戶充值 ${points} 分，價值 HK$${amount}`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL}/recharge-success?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
    cancel_url: `${process.env.CLIENT_URL}/recharge`,
    metadata: {
      rechargeId: recharge._id.toString(),
      userId: req.user.id,
      points: points.toString(),
      amount: amount.toString(),
    },
    customer_email: req.user.email,
  });
  recharge.payment.transactionId = session.id;
  await recharge.save();
  return session.url;
}

async function createWonderPaymentLink(recharge, points, amount) {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const referenceNumber = recharge._id.toString();
  const apiBase = getApiBaseUrl();
  const callbackUrl =
    process.env.WONDER_CALLBACK_URL ||
    `${apiBase}/payments/wonder/webhook`;

  const { paymentUrl, orderId } = await wonderPaymentService.createOrder({
    referenceNumber,
    amount,
    currency: 'HKD',
    note: `帳戶充值 - ${points}分`,
    redirectUrl: `${clientUrl}/recharge-success?recharge_id=${recharge._id}&provider=wonder&ref=${encodeURIComponent(referenceNumber)}`,
    callbackUrl,
  });

  recharge.payment.transactionId = orderId || referenceNumber;
  recharge.paymentIntentId = referenceNumber;
  await recharge.save();

  return paymentUrl;
}

// @route   GET /api/recharge/options
router.get('/options', auth, (req, res) => {
  try {
    res.json({
      options: RECHARGE_OPTIONS,
      paymentProvider: getPaymentProvider(),
    });
  } catch (error) {
    console.error('獲取充值選項錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/recharge/create-checkout-session
router.post('/create-checkout-session', [
  auth,
  body('points').isInt({ min: MIN_RECHARGE_POINTS }).withMessage(`充值積分最少需要${MIN_RECHARGE_POINTS}分`),
  body('amount').isFloat({ min: MIN_RECHARGE_AMOUNT }).withMessage(`充值金額最少需要HK$${MIN_RECHARGE_AMOUNT}`),
  body('rechargeOfferId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('充值優惠ID格式無效'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array(),
      });
    }

    const { points, amount, rechargeOfferId } = req.body;
    const provider = getPaymentProvider();

    if (points < MIN_RECHARGE_POINTS) {
      return res.status(400).json({ message: `充值積分最少需要${MIN_RECHARGE_POINTS}分` });
    }
    if (amount < MIN_RECHARGE_AMOUNT) {
      return res.status(400).json({ message: `充值金額最少需要HK$${MIN_RECHARGE_AMOUNT}` });
    }

    if (rechargeOfferId) {
      const RechargeOffer = require('../models/RechargeOffer');
      const offer = await RechargeOffer.findById(rechargeOfferId);
      if (!offer) return res.status(404).json({ message: '充值優惠不存在' });
      if (!offer.isActive || new Date(offer.expiryDate) <= new Date()) {
        return res.status(400).json({ message: '充值優惠已過期或已停用' });
      }
      if (offer.points !== points || offer.amount !== amount) {
        return res.status(400).json({ message: '充值金額或積分與優惠不匹配' });
      }
    }

    const validOption = RECHARGE_OPTIONS.find((option) => option.points === points && option.amount === amount);
    const isCustomRecharge = !validOption && points >= MIN_RECHARGE_POINTS && amount >= MIN_RECHARGE_AMOUNT;
    if (!validOption && !isCustomRecharge && !rechargeOfferId) {
      return res.status(400).json({ message: '無效的充值選項' });
    }

    const recharge = new Recharge({
      user: req.user.id,
      points,
      amount,
      rechargeOffer: rechargeOfferId || null,
      payment: {
        method: provider === 'wonder' ? 'wonder' : 'stripe',
      },
    });
    await recharge.save();

    let url;
    if (provider === 'wonder') {
      url = await createWonderPaymentLink(recharge, points, amount);
    } else {
      url = await createStripeCheckoutSession(recharge, req, points, amount);
    }

    res.json({
      message: '支付會話創建成功',
      url,
      rechargeId: recharge._id,
      provider,
    });
  } catch (error) {
    console.error('創建充值支付會話錯誤:', error);
    res.status(500).json({
      message: error.message || '服務器錯誤，請稍後再試',
    });
  }
});

// @route   GET /api/recharge/confirm
// @desc    用戶從 Wonder redirect 回來時查詢／補完充值（webhook 為主，此為 fallback）
router.get('/confirm', auth, async (req, res) => {
  try {
    const { recharge_id: rechargeId, ref } = req.query;
    if (!rechargeId) {
      return res.status(400).json({ message: '缺少 recharge_id' });
    }

    const recharge = await Recharge.findOne({ _id: rechargeId, user: req.user.id });
    if (!recharge) {
      return res.status(404).json({ message: '充值記錄不存在' });
    }
    if (recharge.status === 'completed') {
      return res.json({ status: 'completed', recharge });
    }

    if (getPaymentProvider() === 'wonder' && ref) {
      const recharge = await Recharge.findOne({ _id: rechargeId, user: req.user.id });
      if (recharge?.status === 'completed') {
        return res.json({ status: 'completed', recharge });
      }
      // Wonder redirect 後以 webhook 為主；此處僅回傳目前狀態
    }

    res.json({ status: recharge.status, recharge });
  } catch (error) {
    console.error('確認充值狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/recharge/success
router.post('/success', async (req, res) => {
  try {
    const { sessionId, rechargeId } = req.body;
    if (!sessionId || !rechargeId) {
      return res.status(400).json({ message: '缺少必要參數' });
    }
    if (!stripe) {
      return res.status(503).json({ message: 'Stripe 未啟用' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      await completeRechargePayment(rechargeId, session.id);
    }

    res.json({ message: '充值成功處理' });
  } catch (error) {
    console.error('處理充值成功回調錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;

    const recharges = await Recharge.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Recharge.countDocuments(query);

    res.json({
      recharges,
      pagination: {
        current: parseInt(page, 10),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error('獲取充值歷史錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.get('/balance', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    let userBalance = await UserBalance.findOne({ user: req.user.id })
      .populate('transactions.relatedBooking', 'date startTime endTime court')
      .populate('transactions.relatedBooking.court', 'name number type');

    if (!userBalance) {
      userBalance = new UserBalance({ user: req.user.id });
      await userBalance.save();
    }

    const sortedTransactions = [...userBalance.transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + limitNum);

    res.json({
      balance: userBalance.balance,
      totalRecharged: userBalance.totalRecharged,
      totalSpent: userBalance.totalSpent,
      transactions: paginatedTransactions,
      pagination: {
        current: pageNum,
        pages: Math.ceil(sortedTransactions.length / limitNum),
        total: sortedTransactions.length,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error('獲取用戶餘額錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
