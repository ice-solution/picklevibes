const PlatformMembership = require('../models/PlatformMembership');
const {
  DAY_MS,
  grantVip,
  setBasic,
  syncUserLegacyFields,
} = require('./platformMembershipService');
const { VIP_PERIOD_DAYS, VIP_PERIOD_MS } = require('../constants/vipMembership');

/**
 * VIP 且到期日在「未來」、以整日向上取整剩餘天數為 1 時，自動延長 VIP_PERIOD_DAYS
 */
async function renewVipMembershipsOneDayLeft() {
  try {
    console.log(`🔄 開始 VIP 自動續期（剩餘整日 = 1 時延長 ${VIP_PERIOD_DAYS} 日）...`);
    const now = new Date();
    const eligible = await PlatformMembership.find({
      tier: 'vip',
      expiry: { $gt: now },
    }).populate('user', 'name email');

    let renewedCount = 0;
    for (const membership of eligible) {
      if (!membership.expiry) continue;
      const daysLeft = Math.ceil((membership.expiry.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft !== 1) continue;

      const before = membership.expiry;
      const newExpiry = new Date(membership.expiry.getTime() + VIP_PERIOD_MS);
      membership.expiry = newExpiry;
      await membership.save();
      if (membership.user) {
        await syncUserLegacyFields(membership.user._id, {
          tier: 'vip',
          expiry: newExpiry,
        });
      }
      renewedCount += 1;
      const label = membership.user?.email || membership.user?._id;
      console.log(
        `♻️ VIP 續期: ${membership.user?.name || ''} (${label}) 原到期 ${before.toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong' })} → 新到期 ${newExpiry.toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong' })}`
      );
    }

    console.log(`✅ VIP 自動續期完成，共 ${renewedCount} 位用戶`);
    return { renewedCount };
  } catch (error) {
    console.error('❌ VIP 自動續期失敗:', error);
    throw error;
  }
}

async function checkExpiredMemberships() {
  try {
    console.log('🕐 開始檢查過期的VIP會員...');

    const vipMemberships = await PlatformMembership.find({ tier: 'vip' }).populate(
      'user',
      'name email'
    );
    console.log(`📋 找到 ${vipMemberships.length} 個 VIP 會籍紀錄`);

    let expiredCount = 0;
    const now = new Date();

    for (const membership of vipMemberships) {
      if (membership.expiry && now > membership.expiry) {
        console.log(
          `🔄 用戶 ${membership.user?.name || ''} (${membership.user?.email || membership.user?._id}) 的VIP會籍已過期，降級為普通會員`
        );
        await setBasic(membership.user._id, membership.source || 'pickcourt');
        expiredCount += 1;
      }
    }

    console.log(`✅ 檢查完成，${expiredCount} 個VIP會員已過期並降級為普通會員`);

    const currentVip = await PlatformMembership.find({
      tier: 'vip',
      $or: [{ expiry: null }, { expiry: { $gt: now } }],
    }).populate('user', 'name email membershipExpiry');

    console.log(`📊 當前還有 ${currentVip.length} 個有效VIP會員`);

    if (currentVip.length > 0) {
      console.log('📅 VIP會員到期情況:');
      currentVip.forEach((m) => {
        if (m.expiry) {
          const daysLeft = Math.ceil((m.expiry - now) / DAY_MS);
          console.log(
            `  - ${m.user?.name || m.user?._id}: ${daysLeft}天後過期 (${m.expiry.toLocaleDateString('zh-TW')})`
          );
        }
      });
    }

    return { expiredCount, totalVipUsers: currentVip.length };
  } catch (error) {
    console.error('❌ 檢查過期會員失敗:', error);
    throw error;
  }
}

async function runDailyMembershipJobs() {
  const renew = await renewVipMembershipsOneDayLeft();
  const expire = await checkExpiredMemberships();
  return { ...renew, ...expire };
}

module.exports = {
  checkExpiredMemberships,
  renewVipMembershipsOneDayLeft,
  runDailyMembershipJobs,
};
