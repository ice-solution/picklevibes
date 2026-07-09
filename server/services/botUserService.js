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
  return user;
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
  getUserBalanceSummary,
  getUserBalanceByPhone,
};
