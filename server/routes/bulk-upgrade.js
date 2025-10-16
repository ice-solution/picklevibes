const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

// @route   POST /api/bulk-upgrade/vip
// @desc    批量升級所有用戶為 VIP 會員 (僅管理員)
// @access  Private (Admin)
router.post('/vip', [auth, adminAuth], async (req, res) => {
  try {
    const { days = 30 } = req.body; // 默認30天VIP期限
    
    console.log('🚀 管理員開始批量升級所有用戶為 VIP 會員...');
    console.log(`📅 VIP 期限: ${days} 天`);

    // 獲取所有普通用戶（排除管理員）
    const basicUsers = await User.find({ 
      membershipLevel: 'basic',
      role: { $ne: 'admin' }
    });

    console.log(`📊 找到 ${basicUsers.length} 個普通用戶需要升級`);

    if (basicUsers.length === 0) {
      return res.json({
        message: '沒有需要升級的用戶',
        upgraded: 0,
        errors: 0
      });
    }

    // 計算 VIP 到期日期
    const vipExpiryDate = new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 批量更新
    for (const user of basicUsers) {
      try {
        user.membershipLevel = 'vip';
        user.membershipExpiry = vipExpiryDate;
        await user.save();
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push({
          userId: user._id,
          email: user.email,
          error: error.message
        });
      }
    }

    console.log(`✅ 批量升級完成: 成功 ${successCount} 個，失敗 ${errorCount} 個`);

    res.json({
      message: '批量升級完成',
      upgraded: successCount,
      errors: errorCount,
      vipExpiryDate: vipExpiryDate,
      errorDetails: errors
    });

  } catch (error) {
    console.error('❌ 批量升級失敗:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試',
      error: error.message 
    });
  }
});

// @route   GET /api/bulk-upgrade/status
// @desc    獲取當前用戶會員狀態統計 (僅管理員)
// @access  Private (Admin)
router.get('/status', [auth, adminAuth], async (req, res) => {
  try {
    const basicCount = await User.countDocuments({ membershipLevel: 'basic' });
    const vipCount = await User.countDocuments({ membershipLevel: 'vip' });
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    // 獲取即將過期的 VIP 會員
    const soonExpiredVips = await User.find({
      membershipLevel: 'vip',
      membershipExpiry: {
        $lte: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7天內過期
        $gte: new Date()
      }
    }).select('name email membershipExpiry');

    res.json({
      statistics: {
        totalUsers: basicCount + vipCount + adminCount,
        basicUsers: basicCount,
        vipUsers: vipCount,
        adminUsers: adminCount
      },
      soonExpiredVips: soonExpiredVips.map(user => ({
        name: user.name,
        email: user.email,
        expiryDate: user.membershipExpiry,
        daysLeft: Math.ceil((user.membershipExpiry - new Date()) / (1000 * 60 * 60 * 24))
      }))
    });

  } catch (error) {
    console.error('❌ 獲取狀態失敗:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試',
      error: error.message 
    });
  }
});

module.exports = router;
