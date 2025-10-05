const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    獲取所有用戶列表 (僅管理員)
// @access  Private (Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 10, role, membershipLevel } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (membershipLevel) query.membershipLevel = membershipLevel;
    
    const users = await User.find(query)
      .select('-password') // 排除密碼
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // 為每個用戶添加積分信息
    const usersWithBalance = await Promise.all(users.map(async (user) => {
      const balance = await UserBalance.findOne({ user: user._id });
      return {
        ...user.toObject(),
        balance: balance ? balance.balance : 0,
        totalRecharged: balance ? balance.totalRecharged : 0,
        totalSpent: balance ? balance.totalSpent : 0
      };
    }));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users: usersWithBalance,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取用戶列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/stats
// @desc    獲取用戶統計信息 (僅管理員)
// @access  Private (Admin)
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const coachUsers = await User.countDocuments({ role: 'coach' });
    const vipUsers = await User.countDocuments({ membershipLevel: 'vip' });
    
    // 按會員等級統計
    const membershipStats = await User.aggregate([
      {
        $group: {
          _id: '$membershipLevel',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按角色統計
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      totalUsers,
      activeUsers,
      adminUsers,
      coachUsers,
      vipUsers,
      membershipStats,
      roleStats
    });
  } catch (error) {
    console.error('獲取用戶統計錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id
// @desc    獲取單個用戶詳情 (僅管理員)
// @access  Private (Admin)
router.get('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取用戶積分信息
    const balance = await UserBalance.findOne({ user: user._id });
    const userWithBalance = {
      ...user.toObject(),
      balance: balance ? balance.balance : 0,
      totalRecharged: balance ? balance.totalRecharged : 0,
      totalSpent: balance ? balance.totalSpent : 0,
      recentTransactions: balance ? balance.transactions.slice(-10).reverse() : []
    };
    
    res.json({ user: userWithBalance });
  } catch (error) {
    console.error('獲取用戶詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    更新用戶角色 (僅管理員)
// @access  Private (Admin)
router.put('/:id/role', [
  auth,
  adminAuth,
  body('role').isIn(['user', 'admin', 'coach']).withMessage('角色必須是 user、admin 或 coach')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { role } = req.body;
    const userId = req.params.id;
    
    // 不能修改自己的角色
    if (userId === req.user.id) {
      return res.status(400).json({ message: '不能修改自己的角色' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新角色
    user.role = role;
    await user.save();
    
    res.json({
      message: '用戶角色更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('更新用戶角色錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/membership
// @desc    更新用戶會員等級 (僅管理員)
// @access  Private (Admin)
router.put('/:id/membership', [
  auth,
  adminAuth,
  body('membershipLevel').isIn(['basic', 'premium', 'vip']).withMessage('會員等級必須是 basic、premium 或 vip')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { membershipLevel } = req.body;
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新會員等級
    user.membershipLevel = membershipLevel;
    await user.save();
    
    res.json({
      message: '用戶會員等級更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('更新用戶會員等級錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/status
// @desc    更新用戶狀態 (啟用/禁用) (僅管理員)
// @access  Private (Admin)
router.put('/:id/status', [
  auth,
  adminAuth,
  body('isActive').isBoolean().withMessage('狀態必須是布爾值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { isActive } = req.body;
    const userId = req.params.id;
    
    // 不能禁用自己
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({ message: '不能禁用自己的帳戶' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新狀態
    user.isActive = isActive;
    await user.save();
    
    res.json({
      message: `用戶已${isActive ? '啟用' : '禁用'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('更新用戶狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/users/:id/manual-recharge
// @desc    管理員手動為用戶充值積分 (僅管理員)
// @access  Private (Admin)
router.post('/:id/manual-recharge', [
  auth,
  adminAuth,
  body('points').isInt({ min: 1 }).withMessage('充值積分必須是正整數'),
  body('reason').trim().isLength({ min: 1, max: 200 }).withMessage('充值原因必須在1-200個字符之間')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { points, reason } = req.body;
    const userId = req.params.id;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取或創建用戶餘額記錄
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId });
    }
    
    // 創建充值記錄（模擬完整支付流程）
    const recharge = new Recharge({
      user: userId,
      points: points,
      amount: points, // 1積分 = 1港幣
      status: 'completed', // 直接完成
      paymentIntentId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 生成唯一ID
      description: `管理員手動充值 - ${reason}`,
      payment: {
        status: 'paid',
        method: 'manual',
        paidAt: new Date(),
        transactionId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      pointsAdded: true, // 手動充值直接標記為已添加
      pointsDeducted: false
    });
    await recharge.save();
    
    // 增加用戶積分
    await userBalance.addBalance(
      points, 
      `管理員手動充值 - ${reason} (管理員: ${req.user.name})`
    );
    
    // 更新充值記錄的關聯
    const latestTransaction = userBalance.transactions[userBalance.transactions.length - 1];
    latestTransaction.relatedBooking = null; // 手動充值不關聯預約
    
    res.json({
      message: '手動充值成功',
      recharge: {
        id: recharge._id,
        points: points,
        amount: points,
        reason: reason,
        adminName: req.user.name,
        completedAt: recharge.payment.paidAt
      },
      userBalance: {
        balance: userBalance.balance,
        totalRecharged: userBalance.totalRecharged,
        totalSpent: userBalance.totalSpent
      }
    });
  } catch (error) {
    console.error('手動充值錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id/balance-history
// @desc    獲取用戶積分歷史記錄 (僅管理員)
// @access  Private (Admin)
router.get('/:id/balance-history', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const userId = req.params.id;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取用戶餘額記錄
    const userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      return res.json({
        balance: 0,
        totalRecharged: 0,
        totalSpent: 0,
        transactions: [],
        pagination: { current: 1, pages: 0, total: 0 }
      });
    }
    
    // 過濾交易類型
    let transactions = userBalance.transactions;
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    // 分頁
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    res.json({
      balance: userBalance.balance,
      totalRecharged: userBalance.totalRecharged,
      totalSpent: userBalance.totalSpent,
      transactions: paginatedTransactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(transactions.length / limit),
        total: transactions.length
      }
    });
  } catch (error) {
    console.error('獲取積分歷史錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id/recharge-records
// @desc    獲取用戶充值記錄 (僅管理員)
// @access  Private (Admin)
router.get('/:id/recharge-records', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.params.id;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 構建查詢條件
    const query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    // 獲取充值記錄
    const rechargeRecords = await Recharge.find(query)
      .populate('redeemCode', 'code name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Recharge.countDocuments(query);
    
    res.json({
      rechargeRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取充值記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/recharge-records/:rechargeId/status
// @desc    更新充值記錄狀態 (僅管理員)
// @access  Private (Admin)
router.put('/:id/recharge-records/:rechargeId/status', [
  auth,
  adminAuth,
  body('status').isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('無效的狀態值'),
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('原因不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { status, reason } = req.body;
    const { id: userId, rechargeId } = req.params;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取充值記錄
    const recharge = await Recharge.findById(rechargeId);
    if (!recharge) {
      return res.status(404).json({ message: '充值記錄不存在' });
    }
    
    // 檢查是否屬於該用戶
    if (recharge.user.toString() !== userId) {
      return res.status(403).json({ message: '無權限操作此充值記錄' });
    }
    
    const oldStatus = recharge.status;
    const oldPaymentStatus = recharge.payment.status;
    
    // 更新狀態
    recharge.status = status;
    recharge.payment.status = status === 'completed' ? 'paid' : 
                            status === 'failed' ? 'failed' : 
                            status === 'cancelled' ? 'refunded' : 'pending';
    
    if (status === 'completed' && oldStatus !== 'completed') {
      recharge.payment.paidAt = new Date();
    } else if (status === 'cancelled' && oldStatus !== 'cancelled') {
      recharge.payment.refundedAt = new Date();
    }
    
    // 確保 paymentIntentId 存在（如果沒有則生成一個）
    if (!recharge.paymentIntentId) {
      recharge.paymentIntentId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    await recharge.save();
    
    // 處理積分變更
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId });
    }
    
    // 如果從非完成狀態變為完成狀態，且尚未添加過積分
    if (status === 'completed' && oldStatus !== 'completed' && !recharge.pointsAdded) {
      await userBalance.addBalance(
        recharge.points, 
        `充值確認 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsAdded = true;
      recharge.pointsDeducted = false; // 重置扣除標記
    }
    // 如果從完成狀態變為取消狀態，且尚未扣除過積分
    else if (status === 'cancelled' && oldStatus === 'completed' && !recharge.pointsDeducted) {
      await userBalance.deductBalance(
        recharge.points, 
        `充值取消 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsDeducted = true;
      recharge.pointsAdded = false; // 重置添加標記
    }
    // 如果從取消狀態變為完成狀態，且尚未重新添加過積分
    else if (status === 'completed' && oldStatus === 'cancelled' && !recharge.pointsAdded) {
      await userBalance.addBalance(
        recharge.points, 
        `充值重新確認 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsAdded = true;
      recharge.pointsDeducted = false; // 重置扣除標記
    }
    // 如果變為失敗狀態，重置所有標記
    else if (status === 'failed') {
      recharge.pointsAdded = false;
      recharge.pointsDeducted = false;
    }
    
    // 保存更新後的記錄
    await recharge.save();
    
    res.json({
      message: '充值狀態更新成功',
      recharge: {
        id: recharge._id,
        status: recharge.status,
        paymentStatus: recharge.payment.status,
        points: recharge.points,
        amount: recharge.amount,
        updatedAt: recharge.updatedAt
      },
      userBalance: {
        balance: userBalance.balance,
        totalRecharged: userBalance.totalRecharged,
        totalSpent: userBalance.totalSpent
      }
    });
  } catch (error) {
    console.error('更新充值狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/users/:id
// @desc    刪除用戶 (僅管理員)
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 不能刪除自己
    if (userId === req.user.id) {
      return res.status(400).json({ message: '不能刪除自己的帳戶' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    await User.findByIdAndDelete(userId);
    
    res.json({
      message: '用戶刪除成功',
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('刪除用戶錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/membership
// @desc    設置用戶會員等級 (僅管理員)
// @access  Private (Admin)
router.put('/:id/membership', [auth, adminAuth], async (req, res) => {
  try {
    const userId = req.params.id;
    const { membershipLevel } = req.body;
    
    // 驗證會員等級
    if (!['basic', 'vip'].includes(membershipLevel)) {
      return res.status(400).json({ message: '無效的會員等級' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 如果設置為VIP，計算到期日期
    if (membershipLevel === 'vip') {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (180 * 24 * 60 * 60 * 1000)); // 180天後
      
      user.membershipLevel = 'vip';
      user.membershipExpiry = expiryDate;
    } else {
      user.membershipLevel = 'basic';
      user.membershipExpiry = null;
    }
    
    await user.save();
    
    res.json({
      message: `用戶會員等級已更新為 ${membershipLevel === 'vip' ? 'VIP會員' : '普通會員'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        membershipLevel: user.membershipLevel,
        membershipExpiry: user.membershipExpiry
      }
    });
  } catch (error) {
    console.error('更新會員等級錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/check-membership
// @desc    檢查所有用戶的會員狀態並更新過期用戶 (僅管理員)
// @access  Private (Admin)
router.get('/check-membership', [auth, adminAuth], async (req, res) => {
  try {
    const vipUsers = await User.find({ membershipLevel: 'vip' });
    let expiredCount = 0;
    
    for (const user of vipUsers) {
      const isStillVip = user.checkMembershipStatus();
      if (!isStillVip) {
        await user.save();
        expiredCount++;
      }
    }
    
    res.json({
      message: `會員狀態檢查完成，${expiredCount} 個VIP會員已過期並降級為普通會員`,
      expiredCount
    });
  } catch (error) {
    console.error('檢查會員狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
