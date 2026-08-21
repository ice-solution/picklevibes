const Product = require('../models/Product');
const Store = require('../models/Store');
const UserBalance = require('../models/UserBalance');
const AccountingTransaction = require('../models/AccountingTransaction');
const PosTransaction = require('../models/PosTransaction');
const { adjustProductStock } = require('../utils/productStock');
const {
  validateVariantSelection,
  usesVariantStock,
} = require('../utils/productVariants');
const { canAccessStore } = require('../utils/tenantAccess');

const PAYMENT_LABELS = {
  kpay: 'KPay',
  cash: '現金',
  points: '積分扣數',
};

function getProductPrice(product) {
  if (product.discountPrice != null && product.discountPrice < product.price) {
    return product.discountPrice;
  }
  return product.price;
}

async function buildPosItems(rawItems, { allowInactive = true } = {}) {
  let subtotal = 0;
  const items = [];

  for (const item of rawItems) {
    const product = await Product.findById(item.productId);
    if (!product) {
      return { error: `產品 ${item.productId} 不存在` };
    }

    if (!allowInactive && !product.isActive) {
      return { error: `產品 ${product.name} 已下架` };
    }

    const selection = validateVariantSelection(product, {
      color: item.color,
      size: item.size,
    });
    if (!selection.ok) {
      return { error: selection.message };
    }

    let availableStock = product.stock;
    if (usesVariantStock(product) && selection.variant) {
      availableStock = selection.variant.stock;
    }

    if (availableStock < item.quantity) {
      return { error: `產品 ${product.name} 庫存不足（剩餘 ${availableStock}）` };
    }

    const price = getProductPrice(product);
    const itemSubtotal = price * item.quantity;
    subtotal += itemSubtotal;

    items.push({
      product: product._id,
      name: product.name,
      price,
      quantity: item.quantity,
      subtotal: itemSubtotal,
      color: selection.color,
      size: selection.size,
    });
  }

  return { items, subtotal, total: subtotal };
}

async function checkoutPos({
  storeId,
  userId,
  paymentMethod,
  items: rawItems,
  notes,
  createdBy,
  tenantAccess,
  redeemCodeId = null,
}) {
  if (!canAccessStore(tenantAccess, storeId)) {
    return { error: '無權限存取此店鋪', status: 403 };
  }

  const store = await Store.findById(storeId);
  if (!store) {
    return { error: '店鋪不存在', status: 404 };
  }

  if (paymentMethod === 'points' && !userId) {
    return { error: '積分扣數必須選擇客戶帳戶', status: 400 };
  }

  if (redeemCodeId && !userId) {
    return { error: '使用兌換券必須選擇客戶帳戶', status: 400 };
  }

  const built = await buildPosItems(rawItems, { allowInactive: true });
  if (built.error) {
    return { error: built.error, status: 400 };
  }

  let { items, subtotal } = built;
  let discount = 0;
  let redeemCode = null;
  let redeemCodeName = '';
  let total = subtotal;

  if (redeemCodeId) {
    const RedeemCode = require('../models/RedeemCode');
    redeemCode = await RedeemCode.findById(redeemCodeId);
    if (!redeemCode || !redeemCode.isValid()) {
      return { error: '兌換碼無效或已過期', status: 400 };
    }
    if (
      !redeemCode.applicableTypes.includes('all') &&
      !redeemCode.applicableTypes.includes('product') &&
      !redeemCode.applicableTypes.includes('eshop')
    ) {
      return { error: '此兌換碼不適用於商品／POS 銷售', status: 400 };
    }
    if (subtotal < redeemCode.minAmount) {
      return { error: `此兌換碼需要最低消費 HK$${redeemCode.minAmount}`, status: 400 };
    }
    const canUse = await redeemCode.canUserUse(userId);
    if (!canUse) {
      return { error: '客戶已超過此兌換碼的使用次數限制', status: 400 };
    }
    discount = redeemCode.calculateDiscount(subtotal);
    redeemCodeName = redeemCode.name;
    total = Math.max(0, subtotal - discount);
  }

  if (paymentMethod === 'points') {
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId, balance: 0 });
    }
    if (userBalance.balance < total) {
      return { error: `客戶積分不足（餘額 ${userBalance.balance}，需 ${total}）`, status: 400 };
    }
  }

  const transactionNumber = PosTransaction.generateTransactionNumber();
  const itemSummary = items.map((it) => `${it.name}×${it.quantity}`).join('、');
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || paymentMethod;

  for (let i = 0; i < rawItems.length; i++) {
    const reqItem = rawItems[i];
    const orderItem = items[i];
    await adjustProductStock(
      reqItem.productId,
      reqItem.quantity,
      orderItem.color,
      orderItem.size,
      -reqItem.quantity
    );
  }

  const posTransaction = new PosTransaction({
    transactionNumber,
    store: storeId,
    user: userId || null,
    items,
    subtotal,
    discount,
    total,
    redeemCode: redeemCode ? redeemCode._id : null,
    redeemCodeName,
    paymentMethod,
    pointsChargedAmount: paymentMethod === 'points' ? total : 0,
    status: 'completed',
    notes: notes || '',
    createdBy,
  });

  try {
    if (paymentMethod === 'points') {
      let userBalance = await UserBalance.findOne({ user: userId });
      if (!userBalance) {
        userBalance = new UserBalance({ user: userId, balance: 0 });
      }
      await userBalance.deductBalance(
        total,
        `POS 銷售 ${transactionNumber}`,
        null,
        null,
        posTransaction._id
      );
    }

    if (redeemCode) {
      const { consumeRedeemCodeOnce } = require('./redeemUsageService');
      await consumeRedeemCodeOnce({
        redeemCodeId: redeemCode._id,
        userId,
        orderType: 'product',
        orderId: posTransaction._id,
        originalAmount: subtotal,
        discountAmount: discount,
        finalAmount: total,
      });
    }

    const accountingTx = new AccountingTransaction({
      store: storeId,
      type: 'income',
      amount: total,
      date: new Date(),
      category: '器材',
      note: `POS ${transactionNumber} · ${paymentLabel}${userId ? '' : ' · 散客'}${redeemCodeName ? ` · 券:${redeemCodeName}` : ''} · ${itemSummary}`,
      createdBy,
    });
    await accountingTx.save();

    posTransaction.accountingTransaction = accountingTx._id;
    await posTransaction.save();

    await posTransaction.populate([
      { path: 'store', select: 'name slug' },
      { path: 'user', select: 'name email phone' },
      { path: 'createdBy', select: 'name email' },
    ]);

    return { transaction: posTransaction };
  } catch (err) {
    for (let i = 0; i < rawItems.length; i++) {
      const reqItem = rawItems[i];
      const orderItem = items[i];
      await adjustProductStock(
        reqItem.productId,
        reqItem.quantity,
        orderItem.color,
        orderItem.size,
        reqItem.quantity
      );
    }
    throw err;
  }
}

async function cancelPosTransaction({
  transactionId,
  cancelledBy,
  reason,
  tenantAccess,
}) {
  const tx = await PosTransaction.findById(transactionId).populate('user', 'name email phone');
  if (!tx) {
    return { error: '交易不存在', status: 404 };
  }
  if (tx.status !== 'completed') {
    return { error: '此交易已取消或無法取消', status: 400 };
  }
  if (!canAccessStore(tenantAccess, tx.store)) {
    return { error: '無權限存取此店鋪', status: 403 };
  }

  for (const item of tx.items) {
    await adjustProductStock(
      item.product,
      item.quantity,
      item.color,
      item.size,
      item.quantity
    );
  }

  let pointsRefunded = 0;
  const charged = Number(tx.pointsChargedAmount) || 0;
  if (tx.paymentMethod === 'points' && charged > 0 && tx.user) {
    const userId = tx.user._id || tx.user;
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId, balance: 0 });
    }
    await userBalance.refund(
      charged,
      `POS ${tx.transactionNumber} 取消退回積分`,
      null,
      null,
      tx._id
    );
    pointsRefunded = charged;
  }

  // 退還兌換碼使用：刪除使用記錄、更新統計，並還原口袋狀態
  if (tx.redeemCode) {
    const RedeemUsage = require('../models/RedeemUsage');
    const RedeemCode = require('../models/RedeemCode');
    const UserRedeemPocket = require('../models/UserRedeemPocket');
    const usage = await RedeemUsage.findOne({
      orderType: 'product',
      orderId: tx._id,
    });
    if (usage) {
      const usageUserId = usage.user;
      const discountAmount = Number(usage.discountAmount) || Number(tx.discount) || 0;
      await usage.deleteOne();
      await RedeemCode.findByIdAndUpdate(tx.redeemCode, {
        $inc: { totalUsed: -1, totalDiscount: -discountAmount },
      });
      const pocket = await UserRedeemPocket.findOne({
        user: usageUserId,
        redeemCode: tx.redeemCode,
      });
      if (pocket && pocket.status !== 'removed') {
        pocket.status = 'available';
        pocket.usedAt = null;
        pocket.lastRedeemUsage = null;
        await pocket.save();
      }
    }
  }

  const expenseTx = new AccountingTransaction({
    store: tx.store,
    type: 'expense',
    amount: tx.total,
    date: new Date(),
    category: '器材',
    note: `POS 取消退款 ${tx.transactionNumber}${reason ? ` · ${reason}` : ''}`,
    createdBy: cancelledBy,
  });
  await expenseTx.save();

  tx.status = 'cancelled';
  tx.pointsChargedAmount = 0;
  tx.cancelledAt = new Date();
  tx.cancelledBy = cancelledBy;
  tx.cancelReason = reason || '';
  tx.refundAccountingTransaction = expenseTx._id;
  await tx.save();

  await tx.populate([
    { path: 'store', select: 'name slug' },
    { path: 'user', select: 'name email phone' },
    { path: 'createdBy', select: 'name email' },
    { path: 'cancelledBy', select: 'name email' },
  ]);

  return { transaction: tx, pointsRefunded };
}

function formatPosOrderSummary(tx) {
  return {
    _id: tx._id,
    orderType: 'pos',
    orderNumber: tx.transactionNumber,
    items: (tx.items || []).map((item) => ({
      product: item.product,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
      color: item.color,
      size: item.size,
    })),
    subtotal: tx.subtotal,
    discount: tx.discount || 0,
    total: tx.total,
    redeemCodeName: tx.redeemCodeName || '',
    status: tx.status === 'cancelled' ? 'cancelled' : 'completed',
    paymentMethod: tx.paymentMethod,
    paymentMethodLabel: PAYMENT_LABELS[tx.paymentMethod] || tx.paymentMethod,
    store: tx.store,
    pointsChargedAmount: tx.pointsChargedAmount,
    notes: tx.notes || '',
    cancelledAt: tx.cancelledAt,
    cancelReason: tx.cancelReason || '',
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

module.exports = {
  checkoutPos,
  cancelPosTransaction,
  buildPosItems,
  formatPosOrderSummary,
  PAYMENT_LABELS,
};
