const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const router = express.Router();

// 通用速率限制
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 10, // 最多10次請求
  message: { message: '請求過於頻繁，請15分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 限制忘記密碼請求頻率
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 3, // 最多3次請求
  message: { message: '請求過於頻繁，請15分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 限制重置密碼請求頻率
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分鐘
  max: 5, // 最多5次請求
  message: { message: '請求過於頻繁，請15分鐘後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 配置郵件發送器
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // 使用應用程序密碼
    }
  });
};

// @route   POST /api/auth/register
// @desc    用戶註冊
// @access  Public
router.post('/register', authLimiter, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在2-50個字符之間'),
  body('email').isEmail().withMessage('請提供有效的電子郵件地址'),
  body('password')
    .isLength({ min: 8 }).withMessage('密碼至少需要8個字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('密碼必須包含至少一個字母和一個數字'),
  body('phone').matches(/^[0-9+\-\s()]+$/).withMessage('請提供有效的電話號碼')
], async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { name, email, password, phone } = req.body;

    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: '該電子郵件地址已被使用' 
      });
    }

    // 創建新用戶
    const user = new User({
      name,
      email,
      password,
      phone
    });

    await user.save();

    // 生成JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '註冊成功',
      token,
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
    console.error('註冊錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤' 
    });
  }
});

// @route   POST /api/auth/login
// @desc    用戶登入
// @access  Public
router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('請提供有效的電子郵件地址'),
  body('password').notEmpty().withMessage('密碼不能為空')
], async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { email, password } = req.body;

    // 查找用戶
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        message: '電子郵件或密碼錯誤' 
      });
    }

    // 檢查密碼
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: '電子郵件或密碼錯誤' 
      });
    }

    // 檢查用戶是否啟用
    if (!user.isActive) {
      return res.status(401).json({ 
        message: '帳戶已被停用' 
      });
    }

    // 更新最後登入時間
    user.lastLogin = new Date();
    await user.save();

    // 生成JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.json({
      message: '登入成功',
      token,
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
    console.error('登入錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤' 
    });
  }
});

// 發送重置密碼郵件
const sendResetEmail = async (email, resetToken) => {
  const transporter = createTransporter();
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Picklevibes - 重置密碼',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Picklevibes</h1>
          <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">匹克球場地預約系統</p>
        </div>
        
        <div style="padding: 40px 20px; background: white;">
          <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">重置您的密碼</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            您請求重置密碼。請點擊下面的按鈕來重置您的密碼：
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      text-decoration: none; 
                      padding: 15px 30px; 
                      border-radius: 8px; 
                      font-size: 16px; 
                      font-weight: bold;
                      display: inline-block;">
              重置密碼
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
            如果按鈕無法點擊，請複製以下鏈接到瀏覽器中：<br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              ⚠️ 此鏈接將在1小時後過期。如果您沒有請求重置密碼，請忽略此郵件。
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            © 2024 Picklevibes. 所有權利保留。
          </p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// @route   POST /api/auth/forgot-password
// @desc    發送重置密碼郵件
// @access  Public
router.post('/forgot-password', forgotPasswordLimiter, [
  body('email').isEmail().withMessage('請提供有效的電子郵件地址')
], async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { email } = req.body;

    // 檢查用戶是否存在
    const user = await User.findOne({ email });
    if (!user) {
      // 為了安全，即使用戶不存在也返回成功
      return res.json({ 
        message: '如果該電子郵件地址存在於我們的系統中，您將收到重置密碼的郵件' 
      });
    }

    // 生成重置token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1小時後過期

    // 保存重置token到用戶記錄
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // 發送重置郵件
    try {
      await sendResetEmail(email, resetToken);
      res.json({ 
        message: '如果該電子郵件地址存在於我們的系統中，您將收到重置密碼的郵件' 
      });
    } catch (emailError) {
      console.error('發送郵件失敗:', emailError);
      
      // 清除已保存的token
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();
      
      res.status(500).json({ 
        message: '發送郵件失敗，請稍後再試' 
      });
    }

  } catch (error) {
    console.error('忘記密碼錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤' 
    });
  }
});

// @route   GET /api/auth/verify-reset-token/:token
// @desc    驗證重置密碼token
// @access  Public
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: '重置鏈接無效或已過期' 
      });
    }

    res.json({ 
      message: 'Token有效' 
    });

  } catch (error) {
    console.error('驗證token錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤' 
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    重置密碼
// @access  Public
router.post('/reset-password', resetPasswordLimiter, [
  body('token').notEmpty().withMessage('重置token是必需的'),
  body('password')
    .isLength({ min: 8 }).withMessage('密碼至少需要8個字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('密碼必須包含至少一個字母和一個數字')
], async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { token, password } = req.body;

    // 查找有效的重置token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: '重置鏈接無效或已過期' 
      });
    }

    // 更新密碼並清除重置token
    user.password = password; // 直接設置密碼，讓User模型的pre-save中間件處理加密
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({ 
      message: '密碼重置成功' 
    });

  } catch (error) {
    console.error('重置密碼錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤' 
    });
  }
});

module.exports = router;