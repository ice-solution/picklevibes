const express = require('express');
const { body, validationResult } = require('express-validator');
const Recharge = require('../models/Recharge');
const { auth } = require('../middleware/auth');
const { getPaymentProvider } = require('../config/paymentProvider');
const wonderPaymentService = require('../services/wonderPaymentService');
const { completeRechargePayment } = require('../services/rechargePaymentService');
const {
  getStoreBalanceSummary,
  getPlatformBalanceSummary,
  listUserStoreBalances,
  resolveStoreIdFromInput,
} = require('../services/storeBalanceService');

const router = express.Router();

const stripe =
  getPaymentProvider() === 'stripe' && process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

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

function getClientBaseUrl() {
  return (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function createStripeCheckoutSession(recharge, req, { points, amount, storeDoc, successUrl, cancelUrl }) {
  if (!stripe) {
    throw new Error('Stripe 未設定 STRIPE_SECRET_KEY');
  }
  const scopeLabel = storeDoc ? storeDoc.name : 'PickCourt';
  const defaultSuccess = storeDoc
    ? `${getClientBaseUrl()}/recharge-success?session_id={CHECKOUT_SESSION_ID}&provider=stripe&store=${storeDoc.slug}`
    : `${getClientBaseUrl()}/recharge-success?session_id={CHECKOUT_SESSION_ID}&provider=stripe`;
  const defaultCancel = storeDoc
    ? `${getClientBaseUrl()}/account/recharge?store=${storeDoc.slug}`
    : `${getClientBaseUrl()}/account/recharge`;

  const metadata = {
    rechargeId: recharge._id.toString(),
    userId: req.user.id,
    points: points.toString(),
    amount: amount.toString(),
  };
  if (storeDoc) metadata.storeId = storeDoc._id.toString();

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'hkd',
          product_data: {
            name: `${scopeLabel} 帳戶充值 - ${points}分`,
            description: storeDoc
              ? `為 ${storeDoc.name} 充值 ${points} 分，僅限該店使用`
              : `PickCourt 平台充值 ${points} 分，可於聯盟各店使用`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl || defaultSuccess,
    cancel_url: cancelUrl || defaultCancel,
    metadata,
    customer_email: req.user.email,
  });

  recharge.payment.transactionId = session.id;
  await recharge.save();
  return session.url;
}

async function createWonderPaymentLink(recharge, { points, amount, storeDoc }) {
  const clientUrl = getClientBaseUrl();
  const referenceNumber = recharge._id.toString();
  const apiBase = getApiBaseUrl();
  const callbackUrl =
    process.env.WONDER_CALLBACK_URL ||
    `${apiBase}/payments/wonder/webhook`;

  const scopeLabel = storeDoc ? storeDoc.name : 'PickCourt';
  const storeQs = storeDoc ? `&store=${encodeURIComponent(storeDoc.slug)}` : '';
  const redirectUrl = `${clientUrl}/recharge-success?recharge_id=${recharge._id}&provider=wonder&ref=${encodeURIComponent(referenceNumber)}${storeQs}`;

  const { paymentUrl, orderId } = await wonderPaymentService.createOrder({
    referenceNumber,
    amount,
    currency: 'HKD',
    note: `${scopeLabel} 帳戶充值 - ${points}分`,
    redirectUrl,
    callbackUrl,
  });

  recharge.payment.transactionId = orderId || referenceNumber;
  recharge.paymentIntentId = referenceNumber;
  await recharge.save();

  return paymentUrl;
}

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

router.post('/create-checkout-session', [
  auth,
  body('points').isInt({ min: MIN_RECHARGE_POINTS }).withMessage(`充值積分最少需要${MIN_RECHARGE_POINTS}分`),
  body('amount').isFloat({ min: MIN_RECHARGE_AMOUNT }).withMessage(`充值金額最少需要HK$${MIN_RECHARGE_AMOUNT}`),
  body('rechargeOfferId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('充值優惠ID格式無效'),
  body('storeId').optional(),
  body('store').optional(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array(),
      });
    }

    const { points, amount, rechargeOfferId, successUrl, cancelUrl } = req.body;
    const storeInput = req.body.storeId || req.body.store;
    const storeDoc = storeInput ? await resolveStoreIdFromInput(storeInput) : null;
    if (storeInput && !storeDoc) {
      return res.status(404).json({ message: '店鋪不存在' });
    }

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
      if (!offer) {
        return res.status(404).json({ message: '充值優惠不存在' });
      }
      if (offer.store) {
        if (!storeDoc || String(offer.store) !== String(storeDoc._id)) {
          return res.status(400).json({ message: '充值優惠不屬於此店鋪' });
        }
      } else if (storeDoc) {
        return res.status(400).json({ message: '此優惠為 PickCourt 平台優惠，請勿指定店鋪' });
      }
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
      store: storeDoc ? storeDoc._id : null,
      rechargeOffer: rechargeOfferId || null,
      payment: {
        method: provider === 'wonder' ? 'wonder' : 'stripe',
      },
    });
    await recharge.save();

    let url;
    if (provider === 'wonder') {
      url = await createWonderPaymentLink(recharge, { points, amount, storeDoc });
    } else {
      url = await createStripeCheckoutSession(recharge, req, {
        points,
        amount,
        storeDoc,
        successUrl,
        cancelUrl,
      });
    }

    res.json({
      message: '支付會話創建成功',
      url,
      rechargeId: recharge._id,
      provider,
      scope: storeDoc ? 'store' : 'platform',
      store: storeDoc
        ? { id: storeDoc._id, name: storeDoc.name, slug: storeDoc.slug }
        : null,
    });
  } catch (error) {
    console.error('創建充值支付會話錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤，請稍後再試' });
  }
});

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

    // Wonder 以 webhook 入帳為主；redirect 僅回傳目前狀態
    if (getPaymentProvider() === 'wonder' && ref) {
      return res.json({ status: recharge.status, recharge });
    }

    res.json({ status: recharge.status, recharge });
  } catch (error) {
    console.error('確認充值狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

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
    const { page = 1, limit = 10, status, store, scope } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;
    if (scope === 'platform') {
      query.store = null;
    } else if (store) {
      const storeDoc = await resolveStoreIdFromInput(store);
      if (storeDoc) query.store = storeDoc._id;
    }

    const recharges = await Recharge.find(query)
      .populate('store', 'name slug')
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
    const { page = 1, limit = 10, store } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    if (store) {
      const storeDoc = await resolveStoreIdFromInput(store);
      if (!storeDoc) {
        return res.status(404).json({ message: '店鋪不存在' });
      }

      const [summary, platformSummary] = await Promise.all([
        getStoreBalanceSummary(req.user.id, storeDoc._id),
        getPlatformBalanceSummary(req.user.id),
      ]);
      const sortedTransactions = [...summary.transactions].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + limitNum);

      return res.json({
        mode: 'store',
        store: {
          id: storeDoc._id,
          name: storeDoc.name,
          slug: storeDoc.slug,
        },
        balance: summary.balance,
        platformBalance: platformSummary.balance,
        availableForBooking: summary.balance + platformSummary.balance,
        totalRecharged: summary.totalRecharged,
        totalSpent: summary.totalSpent,
        transactions: paginatedTransactions,
        pagination: {
          current: pageNum,
          pages: Math.ceil(sortedTransactions.length / limitNum) || 1,
          total: sortedTransactions.length,
          limit: limitNum,
        },
      });
    }

    const [platformSummary, storeBalances] = await Promise.all([
      getPlatformBalanceSummary(req.user.id),
      listUserStoreBalances(req.user.id),
    ]);
    const sortedTransactions = [...platformSummary.transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTransactions = sortedTransactions.slice(startIndex, startIndex + limitNum);

    res.json({
      mode: 'platform',
      balance: platformSummary.balance,
      totalRecharged: platformSummary.totalRecharged,
      totalSpent: platformSummary.totalSpent,
      storeBalances,
      transactions: paginatedTransactions,
      pagination: {
        current: pageNum,
        pages: Math.ceil(sortedTransactions.length / limitNum) || 1,
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
