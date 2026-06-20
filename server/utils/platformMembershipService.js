const User = require('../models/User');
const PlatformMembership = require('../models/PlatformMembership');
const { VIP_PERIOD_MS } = require('../constants/vipMembership');

const DAY_MS = 24 * 60 * 60 * 1000;

function isVipActive({ tier, expiry }) {
  if (tier !== 'vip') return false;
  if (!expiry) return true;
  return new Date(expiry) > new Date();
}

function membershipFromUser(user) {
  const tier = user.membershipLevel === 'vip' ? 'vip' : 'basic';
  const expiry = user.membershipExpiry || null;
  return {
    tier,
    expiry,
    isVipActive: isVipActive({ tier, expiry }),
    source: 'legacy_picklevibes',
  };
}

function membershipFromPlatform(doc) {
  const tier = doc.tier === 'vip' ? 'vip' : 'basic';
  const expiry = doc.expiry || null;
  return {
    tier,
    expiry,
    isVipActive: isVipActive({ tier, expiry }),
    source: doc.source || 'pickcourt',
  };
}

/**
 * 解析用戶聯盟會籍（優先 PlatformMembership，fallback User 舊欄位）
 */
async function resolveMembership(userOrId) {
  const user =
    userOrId && userOrId._id
      ? userOrId
      : await User.findById(userOrId);
  if (!user) {
    return {
      tier: 'basic',
      expiry: null,
      isVipActive: false,
      source: 'pickcourt',
    };
  }

  const platform = await PlatformMembership.findOne({ user: user._id });
  if (platform) {
    return membershipFromPlatform(platform);
  }
  return membershipFromUser(user);
}

async function syncUserLegacyFields(userId, { tier, expiry }) {
  await User.findByIdAndUpdate(userId, {
    membershipLevel: tier,
    membershipExpiry: expiry,
  });
}

/**
 * 設定聯盟會籍（雙寫 PlatformMembership + User 舊欄位）
 */
async function setMembership(userId, { tier, expiry = null, source = 'pickcourt' }) {
  const normalizedTier = tier === 'vip' ? 'vip' : 'basic';
  const normalizedExpiry = normalizedTier === 'vip' ? expiry : null;

  const platform = await PlatformMembership.findOneAndUpdate(
    { user: userId },
    {
      tier: normalizedTier,
      expiry: normalizedExpiry,
      source,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await syncUserLegacyFields(userId, {
    tier: normalizedTier,
    expiry: normalizedExpiry,
  });

  return membershipFromPlatform(platform);
}

async function grantVip(userId, { days, source = 'pickcourt', expiryDate = null } = {}) {
  let expiry = expiryDate;
  if (!expiry && days) {
    expiry = new Date(Date.now() + days * DAY_MS);
  }
  if (!expiry) {
    expiry = new Date(Date.now() + VIP_PERIOD_MS);
  }
  return setMembership(userId, { tier: 'vip', expiry, source });
}

async function setBasic(userId, source = 'pickcourt') {
  return setMembership(userId, { tier: 'basic', expiry: null, source });
}

async function isUserVipActive(userOrId) {
  const m = await resolveMembership(userOrId);
  return m.isVipActive;
}

/** 供 auth API 回傳 */
function formatMembershipForClient(membership) {
  return {
    membershipLevel: membership.tier,
    membershipExpiry: membership.expiry,
    platformMembership: {
      tier: membership.tier,
      expiry: membership.expiry,
      isVipActive: membership.isVipActive,
      source: membership.source,
    },
  };
}

module.exports = {
  DAY_MS,
  isVipActive,
  resolveMembership,
  setMembership,
  grantVip,
  setBasic,
  isUserVipActive,
  formatMembershipForClient,
  syncUserLegacyFields,
};
