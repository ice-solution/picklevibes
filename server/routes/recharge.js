const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Recharge = require('../models/Recharge');
const UserBalance = require('../models/UserBalance');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 充值選項
const RECHARGE_OPTIONS = [
  { points: 500, amount: 500, label: '500分 (HK$500)' },
  { points: 1000, amount: 1000, label: '1000分 (HK$1000)' },
  { points: 1200, amount: 1200, label: '1200分 (HK$1200)' },
  { points: 2000, amount: 2000, label: '2000分 (HK$2000)' }
];

// 最小充值限制
const MIN_RECHARGE_POINTS = 100;
const MIN_RECHARGE_AMOUNT = 100;

// @route   GET /api/recharge/options
// @desc    獲取充值選項
// @access  Private
router.get('/options', auth, (req, res) => {
  try {
    res.json({ options: RECHARGE_OPTIONS });
  } catch (error) {
    console.error('獲取充值選項錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/recharge/create-checkout-session
// @desc    創建充值支付會話
// @access  Private
router.post('/create-checkout-session', [
  auth,
  body('points').isInt({ min: MIN_RECHARGE_POINTS }).withMessage(`充值積分最少需要${MIN_RECHARGE_POINTS}分`),
  body('amount').isFloat({ min: MIN_RECHARGE_AMOUNT }).withMessage(`充值金額最少需要HK$${MIN_RECHARGE_AMOUNT}`)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { points, amount } = req.body;

    // 驗證最小充值限制
    if (points < MIN_RECHARGE_POINTS) {
      return res.status(400).json({ 
        message: `充值積分最少需要${MIN_RECHARGE_POINTS}分` 
      });
    }
    
    if (amount < MIN_RECHARGE_AMOUNT) {
      return res.status(400).json({ 
        message: `充值金額最少需要HK$${MIN_RECHARGE_AMOUNT}` 
      });
    }

    // 驗證充值選項（允許自定義金額）
    const validOption = RECHARGE_OPTIONS.find(option => 
      option.points === points && option.amount === amount
    );
    
    // 如果不是預設選項，檢查是否為自定義充值
    const isCustomRecharge = !validOption && points >= MIN_RECHARGE_POINTS && amount >= MIN_RECHARGE_AMOUNT;

    if (!validOption && !isCustomRecharge) {
      return res.status(400).json({ message: '無效的充值選項' });
    }

    // 創建充值記錄
    const recharge = new Recharge({
      user: req.user.id,
      points: points,
      amount: amount,
      payment: {
        method: 'stripe'
      }
    });

    await recharge.save();

    // 創建 Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'alipay'],
      line_items: [
        {
          price_data: {
            currency: 'hkd',
            product_data: {
              name: `帳戶充值 - ${points}分`,
              description: `為您的帳戶充值 ${points} 分，價值 HK$${amount}`,
            },
            unit_amount: Math.round(amount * 100), // 轉換為分
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/recharge-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/recharge`,
      metadata: {
        rechargeId: recharge._id.toString(),
        userId: req.user.id,
        points: points.toString(),
        amount: amount.toString()
      },
      customer_email: req.user.email,
    });

    // 更新充值記錄的交易ID
    recharge.payment.transactionId = session.id;
    await recharge.save();

    res.json({
      message: '支付會話創建成功',
      url: session.url,
      rechargeId: recharge._id
    });

  } catch (error) {
    console.error('創建充值支付會話錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/recharge/success
// @desc    處理充值成功回調
// @access  Public
router.post('/success', async (req, res) => {
  try {
    const { sessionId, rechargeId } = req.body;

    if (!sessionId || !rechargeId) {
      return res.status(400).json({ message: '缺少必要參數' });
    }

    // 驗證 Stripe Session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // 更新充值狀態
      const recharge = await Recharge.findById(rechargeId);
      if (recharge && recharge.status === 'pending') {
        recharge.status = 'completed';
        recharge.payment.status = 'paid';
        recharge.payment.paidAt = new Date();
        await recharge.save();

        // 更新用戶餘額
        let userBalance = await UserBalance.findOne({ user: recharge.user });
        if (!userBalance) {
          userBalance = new UserBalance({ user: recharge.user });
        }
        
        await userBalance.addBalance(recharge.points, `充值 ${recharge.points} 分`);
      }
    }

    res.json({ message: '充值成功處理' });
  } catch (error) {
    console.error('處理充值成功回調錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/recharge/history
// @desc    獲取充值歷史
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }
    
    const recharges = await Recharge.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Recharge.countDocuments(query);
    
    res.json({
      recharges,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取充值歷史錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/recharge/balance
// @desc    獲取用戶餘額
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    let userBalance = await UserBalance.findOne({ user: req.user.id });
    
    if (!userBalance) {
      userBalance = new UserBalance({ user: req.user.id });
      await userBalance.save();
    }
    
    res.json({ 
      balance: userBalance.balance,
      totalRecharged: userBalance.totalRecharged,
      totalSpent: userBalance.totalSpent,
      transactions: userBalance.transactions.slice(-10) // 最近10筆交易
    });
  } catch (error) {
    console.error('獲取用戶餘額錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
