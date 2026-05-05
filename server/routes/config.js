const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Config = require('../models/Config');

const router = express.Router();

// @route   GET /api/config/booking
// @desc    取得預約設定（依 role 的可預約天數）
// @access  Public（預約頁需顯示可選日期範圍）
router.get('/booking', async (req, res) => {
  try {
    const config = await Config.getBookingConfig();
    res.json({ data: config });
  } catch (error) {
    console.error('取得預約設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/config/booking
// @desc    更新預約設定（管理員）- 依 role 設定可預約天數
// @access  Private (Admin)
router.put('/booking', [
  auth,
  adminAuth,
  body('maxAdvanceDaysByRole').isObject().withMessage('必須提供依角色設定的可預約天數'),
  body('maxAdvanceDaysByRole.user').optional().isInt({ min: 1, max: 365 }).withMessage('一般用戶可預約天數須為 1–365'),
  body('maxAdvanceDaysByRole.coach').optional().isInt({ min: 1, max: 365 }).withMessage('教練可預約天數須為 1–365'),
  body('maxAdvanceDaysByRole.admin').optional().isInt({ min: 1, max: 365 }).withMessage('管理員可預約天數須為 1–365')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    const { maxAdvanceDaysByRole } = req.body;
    await Config.setBookingConfig(maxAdvanceDaysByRole);
    const config = await Config.getBookingConfig();
    res.json({
      message: '預約設定已更新',
      data: config
    });
  } catch (error) {
    console.error('更新預約設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/config/shop
// @desc    取得購物功能是否開啟
// @access  Public
router.get('/shop', async (req, res) => {
  try {
    const enabled = await Config.getShopEnabled();
    res.json({ data: { enabled } });
  } catch (error) {
    console.error('取得購物設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/config/shop
// @desc    開啟/關閉購物功能（管理員）
// @access  Private (Admin)
router.put('/shop', [
  auth,
  adminAuth,
  body('enabled').isBoolean().withMessage('enabled 必須為 true 或 false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    const { enabled } = req.body;
    await Config.setShopEnabled(enabled);
    const result = await Config.getShopEnabled();
    res.json({
      message: enabled ? '購物功能已開啟' : '購物功能已關閉',
      data: { enabled: result }
    });
  } catch (error) {
    console.error('更新購物設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/config/tier
// @desc    取得 tier 功能是否開啟
// @access  Public
router.get('/tier', async (req, res) => {
  try {
    const enabled = await Config.getTierEnabled();
    res.json({ data: { enabled } });
  } catch (error) {
    console.error('取得 tier 設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/config/tier
// @desc    開啟/關閉 tier 功能（管理員）
// @access  Private (Admin)
router.put('/tier', [
  auth,
  adminAuth,
  body('enabled').isBoolean().withMessage('enabled 必須為 true 或 false')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    const { enabled } = req.body;
    await Config.setTierEnabled(enabled);
    const result = await Config.getTierEnabled();
    res.json({
      message: enabled ? 'Tier 功能已開啟' : 'Tier 功能已關閉',
      data: { enabled: result }
    });
  } catch (error) {
    console.error('更新 tier 設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/config/hotnews
// @desc    取得 HotNews（首頁）內容
// @access  Public
router.get('/hotnews', async (req, res) => {
  try {
    const data = await Config.getHotNews();
    res.json({ data });
  } catch (error) {
    console.error('取得 hotnews 設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/config/hotnews
// @desc    更新 HotNews（首頁）內容（管理員）
// @access  Private(Admin)
router.put('/hotnews', [
  auth,
  adminAuth,
  body('enabled').optional().isBoolean().withMessage('enabled 必須為 true 或 false'),
  body('heroBannerUrl').optional().isString().withMessage('heroBannerUrl 必須為字串'),
  body('title').optional().isString().isLength({ min: 1, max: 120 }).withMessage('title 必須為 1-120 字'),
  body('description').optional().isString().isLength({ min: 1, max: 500 }).withMessage('description 必須為 1-500 字'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    const data = await Config.setHotNews(req.body);
    res.json({ message: 'HotNews 已更新', data });
  } catch (error) {
    console.error('更新 hotnews 設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
