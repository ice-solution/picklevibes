const PaymentLink = require('../models/PaymentLink');
const PaymentLinkPayment = require('../models/PaymentLinkPayment');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');
const User = require('../models/User');
const AccountingTransaction = require('../models/AccountingTransaction');
const emailService = require('./emailService');
const { getPaymentProvider } = require('../config/paymentProvider');
const wonderPaymentService = require('./wonderPaymentService');

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

function buildPaylinkReference(paymentId) {
  return `paylink_${paymentId}`;
}

function parsePaylinkIdFromReference(referenceNumber) {
  if (!referenceNumber) return null;
  const s = String(referenceNumber);
  if (/^[a-f0-9]{24}$/i.test(s)) return null;
  const m = s.match(/^paylink_([a-f0-9]{24})(?:_|$)/i);
  return m ? m[1] : null;
}

async function assertLinkPayable(link) {
  if (!link) {
    return { error: '收款連結不存在', status: 404 };
  }
  const check = link.isPayable();
  if (!check.ok) {
    if (check.reason === 'expired') {
      return { error: '此收款連結已過期', status: 403 };
    }
    return { error: '此收款連結已關閉', status: 403 };
  }
  return { link };
}

async function bumpLinkStats(linkId, amount) {
  await PaymentLink.findByIdAndUpdate(linkId, {
    $inc: {
      'stats.paidCount': 1,
      'stats.paidAmountTotal': amount,
    },
  });
}

async function reverseLinkStats(linkId, amount) {
  await PaymentLink.findByIdAndUpdate(linkId, {
    $inc: {
      'stats.paidCount': -1,
      'stats.paidAmountTotal': -amount,
    },
  });
}

function resolvePointsPrice(link, gatewayAmount) {
  if (link?.pointsAmount != null && Number(link.pointsAmount) > 0) {
    return Number(link.pointsAmount);
  }
  return Number(gatewayAmount);
}

async function sendPaymentInvoiceEmail(payment, linkTitle) {
  const email = String(payment.contactEmail || '').trim();
  if (!email) return;

  const invoiceLike = {
    _id: payment._id,
    amount: Number(payment.amount),
    points: Math.round(Number(payment.amount)),
    description: linkTitle,
    payment: {
      method: payment.method,
      transactionId: payment.payment?.transactionId || String(payment._id),
      paidAt: payment.payment?.paidAt || new Date(),
    },
  };
  const contactUser = {
    name: email.split('@')[0] || '客人',
    email,
    phone: String(payment.contactPhone || '').trim(),
  };
  await emailService.sendRechargeInvoiceEmail(contactUser, invoiceLike);
}

/**
 * 訪客 Gateway：即時收支登記 100% + 電郵發票（無帳戶／無充值）
 */
async function completeGuestGatewayPayment(payment, link, transactionId) {
  const linkTitle = link?.title || '收款連結';
  const alreadyHasLedger = Boolean(payment.accountingTransaction);

  if (!alreadyHasLedger) {
    let createdBy = link?.createdBy;
    if (!createdBy) {
      const fullLink = await PaymentLink.findById(payment.link).select('createdBy');
      createdBy = fullLink?.createdBy;
    }
    if (!createdBy) {
      throw new Error('無法建立收支登記：缺少 createdBy');
    }

    const accountingTx = new AccountingTransaction({
      store: payment.store,
      type: 'income',
      amount: payment.amount,
      date: new Date(),
      category: '收款連結',
      note: `收款連結 ${linkTitle}（訪客）· ${payment.contactEmail || ''} · ${payment.contactPhone || ''}`,
      createdBy,
    });
    await accountingTx.save();
    payment.accountingTransaction = accountingTx._id;
  }

  payment.status = 'completed';
  payment.payment.paidAt = payment.payment.paidAt || new Date();
  if (transactionId) {
    payment.payment.transactionId = String(transactionId);
  }
  payment.pointsDebited = true;
  await payment.save();

  if (!alreadyHasLedger) {
    await bumpLinkStats(payment.link?._id || payment.link, payment.amount);
    try {
      await sendPaymentInvoiceEmail(payment, linkTitle);
    } catch (emailError) {
      console.error('❌ 訪客收款連結發票郵件發送失敗:', emailError);
    }
  }

  return { payment, alreadyCompleted: false, guest: true };
}

/**
 * 登入用戶 Gateway：充值再扣積分價 + 充值發票；不寫收支登記
 */
async function completeMemberGatewayPayment(payment, link, transactionId) {
  const linkTitle = link?.title || '收款連結';
  const creditPoints = Math.round(Number(payment.amount));
  const debitPoints = resolvePointsPrice(link, payment.amount);

  let recharge = payment.recharge
    ? await Recharge.findById(payment.recharge)
    : null;

  const alreadyFullySettled = Boolean(
    payment.pointsDebited &&
      recharge &&
      recharge.pointsAdded &&
      recharge.status === 'completed'
  );

  if (!recharge) {
    recharge = new Recharge({
      user: payment.user,
      points: creditPoints,
      amount: Number(payment.amount),
      description: linkTitle,
      store: payment.store,
      status: 'pending',
      paymentIntentId: `paylink_${payment._id}`,
      payment: {
        method: payment.method === 'stripe' ? 'stripe' : 'wonder',
        status: 'pending',
      },
      pointsAdded: false,
    });
    await recharge.save();
    payment.recharge = recharge._id;
    await payment.save();
  }

  let userBalance = await UserBalance.findOne({ user: payment.user });
  if (!userBalance) {
    userBalance = new UserBalance({ user: payment.user, balance: 0 });
  }

  if (!recharge.pointsAdded) {
    await userBalance.addBalance(creditPoints, linkTitle);
    recharge.pointsAdded = true;
    await recharge.save();
    userBalance = await UserBalance.findOne({ user: payment.user });
  }

  if (!payment.pointsDebited) {
    if (userBalance.balance < debitPoints) {
      throw new Error(
        `扣積分失敗：充值後餘額 ${userBalance.balance}，需扣 ${debitPoints}`
      );
    }
    await userBalance.deductBalance(debitPoints, `付款：${linkTitle}`);
    payment.pointsDebited = true;
    await payment.save();
  }

  if (recharge.status !== 'completed') {
    recharge.status = 'completed';
    recharge.payment.status = 'paid';
    recharge.payment.paidAt = new Date();
    if (transactionId) {
      recharge.payment.transactionId = String(transactionId);
    }
    await recharge.save();

    try {
      const user = await User.findById(payment.user);
      if (user) {
        await emailService.sendRechargeInvoiceEmail(user, recharge);
      }
    } catch (emailError) {
      console.error('❌ 收款連結充值發票郵件發送失敗:', emailError);
    }
  }

  payment.status = 'completed';
  payment.payment.paidAt = new Date();
  if (transactionId) {
    payment.payment.transactionId = String(transactionId);
  }
  payment.accountingTransaction = null;
  await payment.save();

  if (!alreadyFullySettled) {
    await bumpLinkStats(payment.link?._id || payment.link, payment.amount);
  }

  return { payment, alreadyCompleted: false, recharge };
}

async function completeGatewayPayment(paymentId, transactionId) {
  const payment = await PaymentLinkPayment.findById(paymentId).populate(
    'link',
    'title code pointsAmount amount store createdBy'
  );
  if (!payment) {
    throw new Error(`找不到收款付款記錄: ${paymentId}`);
  }
  if (payment.status === 'completed') {
    return { payment, alreadyCompleted: true };
  }
  if (payment.status !== 'pending') {
    throw new Error(`付款狀態不可完成: ${payment.status}`);
  }
  if (payment.method === 'points') {
    throw new Error('積分付款不應經 gateway 完成');
  }

  const link = payment.link;

  if (!payment.user) {
    const email = String(payment.contactEmail || '').trim();
    const phone = String(payment.contactPhone || '').trim();
    if (!email || !phone) {
      throw new Error('訪客付款缺少電郵或電話，無法完成');
    }
    return completeGuestGatewayPayment(payment, link, transactionId);
  }

  return completeMemberGatewayPayment(payment, link, transactionId);
}

async function payWithPoints({ link, userId, payerNote = '', user = null }) {
  const check = await assertLinkPayable(link);
  if (check.error) return check;

  const pointsAmount = resolvePointsPrice(link, link.amount);
  let userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance) {
    userBalance = new UserBalance({ user: userId, balance: 0 });
  }
  if (userBalance.balance < pointsAmount) {
    return {
      error: `積分不足（餘額 ${userBalance.balance}，需 ${pointsAmount}）`,
      status: 400,
    };
  }

  const payment = await PaymentLinkPayment.create({
    link: link._id,
    store: link.store,
    amount: pointsAmount,
    method: 'points',
    status: 'pending',
    user: userId,
    contactEmail: user?.email || '',
    contactPhone: user?.phone || '',
    payerNote: String(payerNote || '').trim(),
  });

  try {
    await userBalance.deductBalance(pointsAmount, `付款：${link.title}`);
    payment.status = 'completed';
    payment.payment.paidAt = new Date();
    payment.payment.transactionId = `points_${payment._id}`;
    await payment.save();
    await bumpLinkStats(link._id, pointsAmount);
    return { payment };
  } catch (err) {
    payment.status = 'failed';
    await payment.save();
    return { error: err.message || '積分扣款失敗', status: 400 };
  }
}

async function createGatewayCheckout({
  link,
  userId = null,
  user = null,
  contactEmail = '',
  contactPhone = '',
  payerNote = '',
}) {
  const check = await assertLinkPayable(link);
  if (check.error) return check;

  const email = String(user?.email || contactEmail || '').trim();
  const phone = String(user?.phone || contactPhone || '').trim();
  const contactName = String(user?.name || '').trim();

  if (!userId) {
    if (!email) {
      return { error: '請填寫電郵，以便發送付款記錄與發票', status: 400 };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: '電郵格式不正確', status: 400 };
    }
    if (!phone) {
      return { error: '請填寫電話，以便發送付款記錄與發票', status: 400 };
    }
  }

  const provider = getPaymentProvider();
  const method = provider === 'wonder' ? 'wonder' : 'stripe';
  const amount = Number(link.amount);

  const payment = await PaymentLinkPayment.create({
    link: link._id,
    store: link.store,
    amount,
    method,
    status: 'pending',
    user: userId || null,
    contactEmail: email,
    contactPhone: phone,
    payerNote: String(payerNote || '').trim(),
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/$/, '');
  const successPath = `${clientUrl}/pay/${link.code}/success?payment_id=${payment._id}&provider=${method}`;
  const cancelUrl = `${clientUrl}/pay/${link.code}`;

  try {
    let url;
    if (method === 'wonder') {
      const referenceNumber = buildPaylinkReference(payment._id);
      const apiBase = getApiBaseUrl();
      const callbackUrl =
        process.env.WONDER_CALLBACK_URL || `${apiBase}/payments/wonder/webhook`;

      const noteParts = [
        `收款連結 - ${link.title}`,
        contactName && `姓名:${contactName}`,
        email && `電郵:${email}`,
        phone && `電話:${phone}`,
        userId ? `用戶:${userId}` : '訪客',
      ].filter(Boolean);

      const { paymentUrl, orderId } = await wonderPaymentService.createOrder({
        referenceNumber,
        amount,
        currency: 'HKD',
        note: noteParts.join(' · ').slice(0, 255),
        redirectUrl: `${successPath}&ref=${encodeURIComponent(referenceNumber)}`,
        callbackUrl,
      });
      payment.payment.transactionId = orderId || referenceNumber;
      await payment.save();
      url = paymentUrl;
    } else {
      if (!process.env.STRIPE_SECRET_KEY) {
        payment.status = 'failed';
        await payment.save();
        return { error: 'Stripe 未設定', status: 503 };
      }
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'hkd',
              product_data: {
                name: link.title,
                description: (link.description || `收款連結 ${link.code}`).slice(0, 500),
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successPath}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
          paymentLinkPaymentId: payment._id.toString(),
          paymentLinkCode: link.code,
          ...(userId ? { userId: String(userId) } : { guest: '1' }),
        },
        ...(email ? { customer_email: email } : {}),
      });
      payment.payment.transactionId = session.id;
      await payment.save();
      url = session.url;
    }

    return { payment, url, provider: method };
  } catch (err) {
    payment.status = 'failed';
    await payment.save();
    console.error('建立收款連結 gateway 失敗:', err);
    return { error: err.message || '建立付款失敗', status: 500 };
  }
}

function serializePublicLink(link, store) {
  const pointsAmount = resolvePointsPrice(link, link.amount);
  return {
    code: link.code,
    title: link.title,
    description: link.description || '',
    amount: link.amount,
    pointsAmount,
    store: store
      ? { name: store.name, slug: store.slug }
      : undefined,
    expiresAt: link.expiresAt,
    isActive: link.isActive,
  };
}

async function refundMemberPoints(payment, link, reason) {
  const linkTitle = link?.title || '收款連結';
  const debitPoints = resolvePointsPrice(link, payment.amount);

  if (payment.user && payment.pointsDebited) {
    let userBalance = await UserBalance.findOne({ user: payment.user });
    if (!userBalance) {
      userBalance = new UserBalance({ user: payment.user, balance: 0 });
    }
    await userBalance.refund(
      debitPoints,
      `收款連結退款：${linkTitle}${reason ? ` · ${reason}` : ''}`
    );
    payment.pointsDebited = false;
  }

  if (payment.recharge) {
    const recharge = await Recharge.findById(payment.recharge);
    if (recharge && recharge.status === 'completed' && recharge.pointsAdded) {
      let userBalance = await UserBalance.findOne({ user: payment.user });
      if (!userBalance) {
        userBalance = new UserBalance({ user: payment.user, balance: 0 });
      }
      await userBalance.deductBalance(
        recharge.points,
        `收款連結退款扣回充值：${linkTitle}${reason ? ` · ${reason}` : ''}`
      );
      recharge.pointsAdded = false;
      recharge.pointsDeducted = true;
      recharge.status = 'cancelled';
      recharge.payment.status = 'refunded';
      recharge.payment.refundedAt = new Date();
      await recharge.save();
    }
  }
}

async function createRefundAccountingEntry(payment, link, cancelledBy, reason) {
  if (!payment.accountingTransaction) return null;

  const existing = payment.refundAccountingTransaction
    ? await AccountingTransaction.findById(payment.refundAccountingTransaction)
    : null;
  if (existing) return existing;

  const linkTitle = link?.title || '收款連結';
  let createdBy = cancelledBy;
  if (!createdBy) {
    createdBy = link?.createdBy;
    if (!createdBy) {
      const fullLink = await PaymentLink.findById(payment.link).select('createdBy');
      createdBy = fullLink?.createdBy;
    }
  }
  if (!createdBy) {
    throw new Error('無法建立退款收支登記：缺少 createdBy');
  }

  const expenseTx = new AccountingTransaction({
    store: payment.store,
    type: 'expense',
    amount: payment.amount,
    date: new Date(),
    category: '收款連結',
    note: `收款連結退款取消 ${linkTitle} · ${payment.contactEmail || payment.contactPhone || '訪客'}${reason ? ` · ${reason}` : ''}`,
    createdBy,
  });
  await expenseTx.save();
  payment.refundAccountingTransaction = expenseTx._id;
  return expenseTx;
}

async function refundWonderGatewayPayment(payment) {
  const referenceNumber = buildPaylinkReference(payment._id);
  const orderNumber = payment.payment?.transactionId || '';
  return wonderPaymentService.refundOrderPayment({
    referenceNumber,
    orderNumber: orderNumber.startsWith('paylink_') ? undefined : orderNumber,
    amount: payment.amount,
  });
}

async function refundStripeGatewayPayment(payment) {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe 未設定');
  }
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(payment.payment.transactionId);
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw new Error('找不到 Stripe payment intent');
  }
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason: 'requested_by_customer',
    metadata: {
      paymentLinkPaymentId: String(payment._id),
    },
  });
}

async function refundPaymentLinkPayment({
  linkId,
  paymentId,
  cancelledBy,
  reason = '',
}) {
  const payment = await PaymentLinkPayment.findById(paymentId).populate(
    'link',
    'title code pointsAmount amount store createdBy'
  );
  if (!payment) {
    return { error: '付款記錄不存在', status: 404 };
  }
  if (String(payment.link?._id || payment.link) !== String(linkId)) {
    return { error: '付款記錄不屬於此收款連結', status: 400 };
  }
  if (payment.status !== 'completed') {
    return { error: '只有已完成付款才可退款', status: 400 };
  }
  if (payment.refundedAt || payment.status === 'cancelled') {
    return { error: '此付款已退款', status: 400 };
  }

  const link = payment.link;
  const trimmedReason = String(reason || '').trim();

  if (payment.method === 'wonder') {
    await refundWonderGatewayPayment(payment);
  } else if (payment.method === 'stripe') {
    await refundStripeGatewayPayment(payment);
  } else if (payment.method === 'points') {
    if (!payment.user) {
      return { error: '積分付款缺少用戶，無法退款', status: 400 };
    }
    const linkTitle = link?.title || '收款連結';
    const debitPoints = resolvePointsPrice(link, payment.amount);
    let userBalance = await UserBalance.findOne({ user: payment.user });
    if (!userBalance) {
      userBalance = new UserBalance({ user: payment.user, balance: 0 });
    }
    await userBalance.refund(
      debitPoints,
      `收款連結退款：${linkTitle}${trimmedReason ? ` · ${trimmedReason}` : ''}`
    );
    payment.pointsDebited = false;
  } else {
    return { error: '不支援此付款方式的退款', status: 400 };
  }

  if (payment.user && payment.method !== 'points') {
    await refundMemberPoints(payment, link, trimmedReason);
  }

  await createRefundAccountingEntry(payment, link, cancelledBy, trimmedReason);

  payment.status = 'cancelled';
  payment.refundedAt = new Date();
  payment.refundedBy = cancelledBy;
  payment.refundReason = trimmedReason;
  await payment.save();

  await reverseLinkStats(payment.link?._id || payment.link, payment.amount);

  return { payment };
}

module.exports = {
  assertLinkPayable,
  completeGatewayPayment,
  payWithPoints,
  createGatewayCheckout,
  buildPaylinkReference,
  parsePaylinkIdFromReference,
  serializePublicLink,
  getApiBaseUrl,
  refundPaymentLinkPayment,
};
