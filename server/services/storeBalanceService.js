/**
 * 分店餘額服務 —— 寫入既有 userbalances.storeWallets，
 * 避免在 Atlas（500 collections 上限）新建 storebalances collection。
 */
const UserBalance = require('../models/UserBalance');
const Store = require('../models/Store');
const mongoose = require('mongoose');

async function getOrCreateUserBalance(userId) {
  let doc = await UserBalance.findOne({ user: userId });
  if (!doc) {
    doc = new UserBalance({ user: userId, balance: 0, storeWallets: [] });
    await doc.save();
  }
  if (!Array.isArray(doc.storeWallets)) {
    doc.storeWallets = [];
  }
  return doc;
}

function findWallet(userBalance, storeId) {
  const sid = String(storeId);
  return userBalance.storeWallets.find((w) => String(w.store) === sid) || null;
}

function wrapWallet(userBalance, wallet) {
  return {
    get balance() {
      return wallet.balance;
    },
    get totalRecharged() {
      return wallet.totalRecharged;
    },
    get totalSpent() {
      return wallet.totalSpent;
    },
    get transactions() {
      return wallet.transactions;
    },
    get store() {
      return wallet.store;
    },
    async save() {
      userBalance.markModified('storeWallets');
      return userBalance.save();
    },
  };
}

async function getOrCreateStoreBalance(userId, storeId) {
  const userBalance = await getOrCreateUserBalance(userId);
  let wallet = findWallet(userBalance, storeId);
  if (!wallet) {
    userBalance.storeWallets.push({
      store: new mongoose.Types.ObjectId(storeId),
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
      transactions: [],
    });
    userBalance.markModified('storeWallets');
    await userBalance.save();
    wallet = findWallet(userBalance, storeId);
  }
  return wrapWallet(userBalance, wallet);
}

async function addStoreBalance(userId, storeId, amount, description, relatedRecharge = null) {
  const userBalance = await getOrCreateUserBalance(userId);
  let wallet = findWallet(userBalance, storeId);
  if (!wallet) {
    userBalance.storeWallets.push({
      store: new mongoose.Types.ObjectId(storeId),
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
      transactions: [],
    });
    wallet = findWallet(userBalance, storeId);
  }

  wallet.balance += amount;
  wallet.totalRecharged += amount;
  const entry = {
    type: 'recharge',
    amount,
    description: description || '充值',
    createdAt: new Date(),
  };
  if (relatedRecharge) entry.relatedRecharge = relatedRecharge;
  wallet.transactions.push(entry);

  userBalance.markModified('storeWallets');
  await userBalance.save();
  return wrapWallet(userBalance, wallet);
}

async function deductStoreBalance(userId, storeId, amount, description, relatedBooking = null) {
  const userBalance = await getOrCreateUserBalance(userId);
  let wallet = findWallet(userBalance, storeId);
  if (!wallet) {
    userBalance.storeWallets.push({
      store: new mongoose.Types.ObjectId(storeId),
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
      transactions: [],
    });
    wallet = findWallet(userBalance, storeId);
  }

  if (wallet.balance < amount) {
    const err = new Error('積分餘額不足');
    err.status = 400;
    throw err;
  }

  wallet.balance -= amount;
  wallet.totalSpent += amount;
  const entry = {
    type: 'spend',
    amount: -amount,
    description: description || '消費',
    createdAt: new Date(),
  };
  if (relatedBooking) entry.relatedBooking = relatedBooking;
  wallet.transactions.push(entry);

  userBalance.markModified('storeWallets');
  await userBalance.save();
  return wrapWallet(userBalance, wallet);
}

async function refundStoreBalance(userId, storeId, amount, description, relatedBooking = null) {
  const userBalance = await getOrCreateUserBalance(userId);
  let wallet = findWallet(userBalance, storeId);
  if (!wallet) {
    userBalance.storeWallets.push({
      store: new mongoose.Types.ObjectId(storeId),
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
      transactions: [],
    });
    wallet = findWallet(userBalance, storeId);
  }

  wallet.balance += amount;
  wallet.totalSpent = Math.max(0, wallet.totalSpent - amount);
  const entry = {
    type: 'refund',
    amount,
    description: description || '退款',
    createdAt: new Date(),
  };
  if (relatedBooking) entry.relatedBooking = relatedBooking;
  wallet.transactions.push(entry);

  userBalance.markModified('storeWallets');
  await userBalance.save();
  return wrapWallet(userBalance, wallet);
}

async function getStoreBalanceSummary(userId, storeId) {
  const userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance) {
    return { balance: 0, totalRecharged: 0, totalSpent: 0, transactions: [] };
  }
  const wallet = findWallet(userBalance, storeId);
  if (!wallet) {
    return { balance: 0, totalRecharged: 0, totalSpent: 0, transactions: [] };
  }
  return {
    balance: wallet.balance,
    totalRecharged: wallet.totalRecharged,
    totalSpent: wallet.totalSpent,
    transactions: wallet.transactions || [],
  };
}

async function listUserStoreBalances(userId) {
  const userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance?.storeWallets?.length) return [];

  const storeIds = userBalance.storeWallets.map((w) => w.store);
  const stores = await Store.find({ _id: { $in: storeIds } })
    .select('name slug branding.displayName')
    .lean();
  const storeMap = Object.fromEntries(stores.map((s) => [String(s._id), s]));

  return userBalance.storeWallets
    .map((w) => {
      const store = storeMap[String(w.store)] || null;
      return {
        store,
        storeId: w.store,
        balance: w.balance,
        totalRecharged: w.totalRecharged,
        totalSpent: w.totalSpent,
      };
    })
    .sort((a, b) => b.balance - a.balance);
}

async function resolveStoreIdFromInput(storeIdOrSlug) {
  if (!storeIdOrSlug) return null;
  const s = String(storeIdOrSlug).trim();
  if (/^[a-f0-9]{24}$/i.test(s)) {
    const store = await Store.findById(s).select('_id name slug branding.displayName enableRecharge');
    return store || null;
  }
  const store = await Store.findOne({ slug: s.toLowerCase() }).select(
    '_id name slug branding.displayName enableRecharge'
  );
  return store || null;
}

async function getPlatformBalanceSummary(userId) {
  const userBalance = await getOrCreateUserBalance(userId);
  return {
    balance: userBalance.balance,
    totalRecharged: userBalance.totalRecharged,
    totalSpent: userBalance.totalSpent,
    transactions: userBalance.transactions || [],
  };
}

async function addPlatformBalance(userId, amount, description) {
  const userBalance = await getOrCreateUserBalance(userId);
  await userBalance.addBalance(amount, description || '充值');
  return userBalance;
}

async function deductPlatformBalance(userId, amount, description, relatedBooking = null) {
  const userBalance = await getOrCreateUserBalance(userId);
  await userBalance.deductBalance(amount, description || '消費', relatedBooking);
  return userBalance;
}

async function refundPlatformBalance(userId, amount, description, relatedBooking = null) {
  const userBalance = await getOrCreateUserBalance(userId);
  await userBalance.refund(amount, description || '退款', relatedBooking);
  return userBalance;
}

async function getAvailableBalanceForStore(userId, storeId) {
  const [platformSummary, storeSummary] = await Promise.all([
    getPlatformBalanceSummary(userId),
    getStoreBalanceSummary(userId, storeId),
  ]);
  return {
    platform: platformSummary.balance,
    store: storeSummary.balance,
    total: platformSummary.balance + storeSummary.balance,
  };
}

/** 預約扣款：先扣該店積分，不足再扣 PickCourt 平台積分 */
async function deductForStoreBooking(userId, storeId, amount, description, relatedBooking = null) {
  const available = await getAvailableBalanceForStore(userId, storeId);
  if (available.total < amount) {
    const err = new Error('積分餘額不足');
    err.status = 400;
    err.available = available.total;
    err.availablePlatform = available.platform;
    err.availableStore = available.store;
    throw err;
  }

  const storeUsed = Math.min(available.store, amount);
  const platformUsed = amount - storeUsed;

  if (storeUsed > 0) {
    await deductStoreBalance(userId, storeId, storeUsed, description, relatedBooking);
  }
  if (platformUsed > 0) {
    await deductPlatformBalance(userId, platformUsed, description, relatedBooking);
  }

  return { storeUsed, platformUsed, total: amount };
}

/** 預約退款：依扣款來源分別退回店鋪與平台錢包 */
async function refundForStoreBooking(
  userId,
  storeId,
  storeUsed,
  platformUsed,
  description,
  relatedBooking = null
) {
  if (storeUsed > 0) {
    await refundStoreBalance(userId, storeId, storeUsed, description, relatedBooking);
  }
  if (platformUsed > 0) {
    await refundPlatformBalance(userId, platformUsed, description, relatedBooking);
  }
}

/**
 * 預約建立後回填 spend 交易的 relatedBooking
 * （扣款時 booking 尚未存在，故需事後連結）
 */
async function attachRelatedBookingToSpend(userId, storeId, deductionSplit, bookingId) {
  if (!bookingId || !deductionSplit) return;
  const userBalance = await getOrCreateUserBalance(userId);
  let modified = false;

  if (deductionSplit.storeUsed > 0 && storeId) {
    const wallet = findWallet(userBalance, storeId);
    if (wallet?.transactions?.length) {
      for (let i = wallet.transactions.length - 1; i >= 0; i -= 1) {
        const tx = wallet.transactions[i];
        if (tx.type === 'spend' && !tx.relatedBooking) {
          tx.relatedBooking = bookingId;
          modified = true;
          break;
        }
      }
    }
  }

  if (deductionSplit.platformUsed > 0 && userBalance.transactions?.length) {
    for (let i = userBalance.transactions.length - 1; i >= 0; i -= 1) {
      const tx = userBalance.transactions[i];
      if (tx.type === 'spend' && !tx.relatedBooking) {
        tx.relatedBooking = bookingId;
        modified = true;
        break;
      }
    }
  }

  if (modified) {
    userBalance.markModified('storeWallets');
    userBalance.markModified('transactions');
    await userBalance.save();
  }
}

async function completeRechargePayment(recharge, description) {
  if (!recharge || recharge.pointsAdded) return recharge;

  const desc = description || `充值 ${recharge.points} 分`;
  if (recharge.store) {
    await addStoreBalance(recharge.user, recharge.store, recharge.points, desc, recharge._id);
  } else {
    await addPlatformBalance(recharge.user, recharge.points, desc);
  }
  recharge.pointsAdded = true;
  recharge.pointsDeducted = false;
  await recharge.save();
  return recharge;
}

async function reverseRechargePayment(recharge, description) {
  if (!recharge || recharge.pointsDeducted) return recharge;

  const desc = description || `充值取消 - ${recharge.description || ''}`;
  if (recharge.store) {
    await deductStoreBalance(recharge.user, recharge.store, recharge.points, desc);
  } else {
    await deductPlatformBalance(recharge.user, recharge.points, desc);
  }
  recharge.pointsDeducted = true;
  recharge.pointsAdded = false;
  await recharge.save();
  return recharge;
}

const completeRechargeToStoreBalance = completeRechargePayment;
const reverseRechargeFromStoreBalance = reverseRechargePayment;

module.exports = {
  getOrCreateStoreBalance,
  addStoreBalance,
  deductStoreBalance,
  refundStoreBalance,
  getStoreBalanceSummary,
  listUserStoreBalances,
  resolveStoreIdFromInput,
  getPlatformBalanceSummary,
  addPlatformBalance,
  deductPlatformBalance,
  refundPlatformBalance,
  getAvailableBalanceForStore,
  deductForStoreBooking,
  refundForStoreBooking,
  attachRelatedBookingToSpend,
  completeRechargePayment,
  reverseRechargePayment,
  completeRechargeToStoreBalance,
  reverseRechargeFromStoreBalance,
};
