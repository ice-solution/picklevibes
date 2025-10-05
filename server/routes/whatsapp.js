const express = require('express');
const { body, validationResult } = require('express-validator');
const whatsappService = require('../services/whatsappService');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');
const { checkTwilioConfig, testTwilioClient } = require('../utils/checkTwilioConfig');

const router = express.Router();

// @route   GET /api/whatsapp/config
// @desc    檢查 Twilio 配置
// @access  Private (Admin)
router.get('/config', [auth, adminAuth], async (req, res) => {
  try {
    const configStatus = checkTwilioConfig();
    const clientStatus = testTwilioClient();
    
    res.json({
      message: 'Twilio 配置檢查完成',
      configValid: configStatus,
      clientValid: clientStatus,
      allValid: configStatus && clientStatus
    });
  } catch (error) {
    console.error('配置檢查錯誤:', error);
    res.status(500).json({ message: '配置檢查失敗' });
  }
});

// @route   POST /api/whatsapp/send
// @desc    發送 WhatsApp 訊息
// @access  Private (Admin)
router.post('/send', [
  auth,
  adminAuth,
  body('to').isMobilePhone().withMessage('請提供有效的電話號碼'),
  body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('訊息內容必須在1-1000個字符之間')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    // 檢查 Twilio 配置
    if (!checkTwilioConfig()) {
      return res.status(400).json({
        message: 'Twilio 配置不完整，請檢查環境變量設置'
      });
    }

    const { to, message } = req.body;
    
    const result = await whatsappService.sendMessage(to, message);
    
    if (result.success) {
      res.json({
        message: 'WhatsApp 訊息發送成功',
        result
      });
    } else {
      res.status(400).json({
        message: 'WhatsApp 訊息發送失敗',
        error: result.error
      });
    }
  } catch (error) {
    console.error('發送 WhatsApp 訊息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/whatsapp/booking/:id/confirmation
// @desc    發送預約確認訊息
// @access  Private (Admin)
router.post('/booking/:id/confirmation', [auth, adminAuth], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('court', 'name number type')
      .populate('user', 'name phone email');

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    const phoneNumber = booking.players[0]?.phone || booking.user?.phone;
    if (!phoneNumber) {
      return res.status(400).json({ message: '預約中沒有找到有效的電話號碼' });
    }

    const result = await whatsappService.sendBookingConfirmation(booking, phoneNumber);
    
    if (result.success) {
      res.json({
        message: '預約確認訊息發送成功',
        result
      });
    } else {
      res.status(400).json({
        message: '預約確認訊息發送失敗',
        error: result.error
      });
    }
  } catch (error) {
    console.error('發送預約確認訊息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/whatsapp/booking/:id/reminder
// @desc    發送預約提醒訊息
// @access  Private (Admin)
router.post('/booking/:id/reminder', [auth, adminAuth], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('court', 'name number type')
      .populate('user', 'name phone email');

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    const phoneNumber = booking.players[0]?.phone || booking.user?.phone;
    if (!phoneNumber) {
      return res.status(400).json({ message: '預約中沒有找到有效的電話號碼' });
    }

    const result = await whatsappService.sendBookingReminder(booking, phoneNumber);
    
    if (result.success) {
      res.json({
        message: '預約提醒訊息發送成功',
        result
      });
    } else {
      res.status(400).json({
        message: '預約提醒訊息發送失敗',
        error: result.error
      });
    }
  } catch (error) {
    console.error('發送預約提醒訊息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/whatsapp/booking/:id/cancellation
// @desc    發送預約取消訊息
// @access  Private (Admin)
router.post('/booking/:id/cancellation', [auth, adminAuth], async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('court', 'name number type')
      .populate('user', 'name phone email');

    if (!booking) {
      return res.status(404).json({ message: '預約不存在' });
    }

    const phoneNumber = booking.players[0]?.phone || booking.user?.phone;
    if (!phoneNumber) {
      return res.status(400).json({ message: '預約中沒有找到有效的電話號碼' });
    }

    const result = await whatsappService.sendBookingCancellation(booking, phoneNumber);
    
    if (result.success) {
      res.json({
        message: '預約取消訊息發送成功',
        result
      });
    } else {
      res.status(400).json({
        message: '預約取消訊息發送失敗',
        error: result.error
      });
    }
  } catch (error) {
    console.error('發送預約取消訊息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/whatsapp/test
// @desc    測試 WhatsApp 服務
// @access  Private (Admin)
router.get('/test', [auth, adminAuth], async (req, res) => {
  try {
    const testMessage = '🧪 這是一個測試訊息，用於驗證 WhatsApp 服務是否正常運作。';
    const testPhone = req.query.phone || '+85212345678'; // 預設測試電話號碼
    
    if (!whatsappService.isValidPhoneNumber(testPhone)) {
      return res.status(400).json({ 
        message: '無效的電話號碼格式',
        phone: testPhone
      });
    }

    const result = await whatsappService.sendMessage(testPhone, testMessage);
    
    res.json({
      message: 'WhatsApp 測試完成',
      testPhone,
      result
    });
  } catch (error) {
    console.error('WhatsApp 測試錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
