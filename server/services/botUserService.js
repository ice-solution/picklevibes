const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const { normalizeHkPhone, phoneLookupVariants } = require('../utils/phoneUtils');

async function findUserByPhone(phone) {
  const hk = normalizeHkPhone(phone);
  if (!hk || hk.length < 8) {
    return null;
  }

  const variants = phoneLookupVariants(phone);
  let user = await User.findOne({ phone: { $in: variants }, isActive: true });
  if (user) return user;

  user = await User.findOne({
    isActive: true,
    phone: { $regex: `${hk}$` },
  });
  if (user) return user;

  // 兼容資料庫以空格/括號儲存電話（例如 +852 9123 4567）
  const spaced = hk.replace(/(\d{4})(\d{4})$/, '$1 $2');
  const variantsSpaced = [`${spaced}`, `852 ${spaced}`, `+852 ${spaced}`];
  user = await User.findOne({ phone: { $in: variantsSpaced }, isActive: true });
  return user;
}

async function findUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return null;
  }
  return User.findOne({ email: normalized, isActive: true });
}

async function getUserBalanceSummary(userId) {
  let userBalance = await UserBalance.findOne({ user: userId });
  if (!userBalance) {
    userBalance = new UserBalance({ user: userId });
    await userBalance.save();
  }

  return {
    balance: userBalance.balance,
    totalRecharged: userBalance.totalRecharged,
    totalSpent: userBalance.totalSpent,
  };
}

async function getUserBalanceByPhone(phone) {
  const user = await findUserByPhone(phone);
  if (!user) {
    const err = new Error('找不到此電話號碼的用戶');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const balance = await getUserBalanceSummary(user._id);
  return formatUserBalanceResponse(user, balance);
}

async function getUserBalanceByEmail(email) {
  const user = await findUserByEmail(email);
  if (!user) {
    const err = new Error('找不到此電郵的用戶');
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const balance = await getUserBalanceSummary(user._id);
  return formatUserBalanceResponse(user, balance);
}

function formatUserBalanceResponse(user, balance) {
  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      membershipLevel: user.membershipLevel,
      role: user.role,
    },
    ...balance,
  };
}

module.exports = {
  findUserByPhone,
  findUserByEmail,
  getUserBalanceSummary,
  getUserBalanceByPhone,
  getUserBalanceByEmail,
};
