const User = require('../models/User');
const { VIP_PERIOD_MS, VIP_PERIOD_DAYS } = require('../constants/vipMembership');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * VIP 且到期日在「未來」、以整日向上取整剩餘天數為 1 時，自動延長 VIP_PERIOD_DAYS（永續滾動制）
 */
async function renewVipMembershipsOneDayLeft() {
  try {
    console.log(`🔄 開始 VIP 自動續期（剩餘整日 = 1 時延長 ${VIP_PERIOD_DAYS} 日）...`);
    const now = new Date();
    const eligible = await User.find({
      membershipLevel: 'vip',
      membershipExpiry: { $gt: now }
    });

    let renewedCount = 0;
    for (const user of eligible) {
      const daysLeft = Math.ceil((user.membershipExpiry.getTime() - now.getTime()) / DAY_MS);
      if (daysLeft !== 1) continue;

      const before = user.membershipExpiry;
      user.membershipExpiry = new Date(user.membershipExpiry.getTime() + VIP_PERIOD_MS);
      await user.save();
      renewedCount += 1;
      console.log(
        `♻️ VIP 續期: ${user.name} (${user.email}) 原到期 ${before.toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong' })} → 新到期 ${user.membershipExpiry.toLocaleString('zh-TW', { timeZone: 'Asia/Hong_Kong' })}`
      );
    }

    console.log(`✅ VIP 自動續期完成，共 ${renewedCount} 位用戶`);
    return { renewedCount };
  } catch (error) {
    console.error('❌ VIP 自動續期失敗:', error);
    throw error;
  }
}

// 檢查過期VIP會員的函數
async function checkExpiredMemberships() {
  try {
    console.log('🕐 開始檢查過期的VIP會員...');

    // 獲取所有VIP會員（選手 role 進行中時不因 VIP 到期日降級，由選手到期 job 處理）
    const vipUsers = await User.find({ membershipLevel: 'vip', role: { $ne: 'athlete' } });
    console.log(`📋 找到 ${vipUsers.length} 個VIP會員（不含進行中選手）`);

    let expiredCount = 0;
    const now = new Date();

    for (const user of vipUsers) {
      if (user.membershipExpiry && now > user.membershipExpiry) {
        console.log(`🔄 用戶 ${user.name} (${user.email}) 的VIP會籍已過期，降級為普通會員`);

        user.membershipLevel = 'basic';
        user.membershipExpiry = null;
        await user.save();

        expiredCount += 1;
      }
    }

    console.log(`✅ 檢查完成，${expiredCount} 個VIP會員已過期並降級為普通會員`);

    // 顯示當前VIP會員狀態
    const currentVipUsers = await User.find({ membershipLevel: 'vip' });
    console.log(`📊 當前還有 ${currentVipUsers.length} 個有效VIP會員`);

    if (currentVipUsers.length > 0) {
      console.log('📅 VIP會員到期情況:');
      currentVipUsers.forEach((user) => {
        if (user.membershipExpiry) {
          const daysLeft = Math.ceil((user.membershipExpiry - now) / DAY_MS);
          console.log(`  - ${user.name}: ${daysLeft}天後過期 (${user.membershipExpiry.toLocaleDateString('zh-TW')})`);
        }
      });
    }

    return { expiredCount, totalVipUsers: currentVipUsers.length };
  } catch (error) {
    console.error('❌ 檢查過期會員失敗:', error);
    throw error;
  }
}

/** 選手 role 到期 → 改回 user，並恢復／保持 VIP 會籍 */
async function checkExpiredAthleteRoles() {
  try {
    console.log('🏸 開始檢查過期選手 role...');
    const now = new Date();
    const expiredAthletes = await User.find({
      role: 'athlete',
      roleExpiry: { $ne: null, $lte: now },
    });

    let revertedCount = 0;
    for (const user of expiredAthletes) {
      user.role = 'user';
      user.roleExpiry = null;
      user.membershipLevel = 'vip';
      if (!user.membershipExpiry || user.membershipExpiry <= now) {
        user.membershipExpiry = new Date(now.getTime() + VIP_PERIOD_MS);
      }
      await user.save();
      revertedCount += 1;
      console.log(
        `🏸 選手到期: ${user.name} (${user.email}) → 角色 user，VIP 至 ${user.membershipExpiry.toLocaleDateString('zh-TW')}`
      );
    }

    console.log(`✅ 選手 role 檢查完成，共 ${revertedCount} 位已改回 VIP 會員`);
    return { revertedAthleteCount: revertedCount };
  } catch (error) {
    console.error('❌ 檢查過期選手失敗:', error);
    throw error;
  }
}

/** 每日任務：先續期（餘 1 整日），再降級已過期 VIP，再處理選手 role 到期 */
async function runDailyMembershipJobs() {
  const renew = await renewVipMembershipsOneDayLeft();
  const expire = await checkExpiredMemberships();
  const athletes = await checkExpiredAthleteRoles();
  return { ...renew, ...expire, ...athletes };
}

module.exports = {
  checkExpiredMemberships,
  renewVipMembershipsOneDayLeft,
  checkExpiredAthleteRoles,
  runDailyMembershipJobs
};
