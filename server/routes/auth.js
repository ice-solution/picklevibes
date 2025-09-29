const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// 生成JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    用戶註冊
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在2-50個字符之間'),
  body('email').isEmail().normalizeEmail().withMessage('請輸入有效的電子郵件'),
  body('password').isLength({ min: 6 }).withMessage('密碼至少需要6個字符'),
  body('phone').matches(/^[0-9+\-\s()]+$/).withMessage('請輸入有效的電話號碼')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { name, email, password, phone } = req.body;

    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '該電子郵件已被註冊' });
    }

    // 創建新用戶
    const user = new User({
      name,
      email,
      password,
      phone
    });

    await user.save();

    // 生成Token
    const token = generateToken(user._id);

    res.status(201).json({
      message: '註冊成功',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('註冊錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/auth/login
// @desc    用戶登錄
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('請輸入有效的電子郵件'),
  body('password').notEmpty().withMessage('密碼為必填項目')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // 查找用戶
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: '電子郵件或密碼錯誤' });
    }

    // 檢查用戶是否被停用
    if (!user.isActive) {
      return res.status(401).json({ message: '帳戶已被停用，請聯繫管理員' });
    }

    // 驗證密碼
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '電子郵件或密碼錯誤' });
    }

    // 更新最後登錄時間
    user.lastLogin = new Date();
    await user.save();

    // 生成Token
    const token = generateToken(user._id);

    res.json({
      message: '登錄成功',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('登錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/auth/me
// @desc    獲取當前用戶信息
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        membershipLevel: user.membershipLevel,
        preferences: user.preferences,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('獲取用戶信息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/auth/profile
// @desc    更新用戶資料
// @access  Private
router.put('/profile', [
  auth,
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在2-50個字符之間'),
  body('phone').optional().matches(/^[0-9+\-\s()]+$/).withMessage('請輸入有效的電話號碼')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { name, phone, preferences } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: '資料更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        membershipLevel: user.membershipLevel,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('更新用戶資料錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/auth/change-password
// @desc    修改密碼
// @access  Private
router.post('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('當前密碼為必填項目'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密碼至少需要6個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    // 驗證當前密碼
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: '當前密碼錯誤' });
    }

    // 更新密碼
    user.password = newPassword;
    await user.save();

    res.json({ message: '密碼修改成功' });
  } catch (error) {
    console.error('修改密碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;


