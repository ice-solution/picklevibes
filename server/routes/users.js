const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
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
    
    const total = await User.countDocuments(query);
    
    res.json({
      users,
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

// @route   GET /api/users/:id
// @desc    獲取單個用戶詳情 (僅管理員)
// @access  Private (Admin)
router.get('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    res.json({ user });
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
      inactiveUsers: totalUsers - activeUsers,
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

module.exports = router;
