const express = require('express');
const { body, validationResult } = require('express-validator');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/redeem/validate
// @desc    驗證兌換碼
// @access  Private
router.post('/validate', [
  auth,
  body('code').trim().notEmpty().withMessage('兌換碼不能為空'),
  body('amount').isFloat({ min: 0 }).withMessage('金額必須大於等於0'),
  body('orderType').isIn(['booking', 'recharge', 'activity', 'product', 'eshop']).withMessage('訂單類型必須是 booking、recharge、activity、product 或 eshop'),
  body('restrictedCode').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { code, amount, orderType, restrictedCode } = req.body;

    // 查找兌換碼
    const redeemCode = await RedeemCode.findOne({ 
      code: code.toUpperCase(),
      isActive: true 
    });

    if (!redeemCode) {
      return res.status(404).json({ message: '兌換碼不存在或已失效' });
    }

    // 檢查兌換碼是否有效
    if (!redeemCode.isValid()) {
      return res.status(400).json({ message: '兌換碼已過期或使用次數已滿' });
    }

    // 檢查專用代碼限制
    // 如果兌換碼設置了 restrictedCode，則必須匹配
    if (redeemCode.restrictedCode && redeemCode.restrictedCode.trim() !== '') {
      if (!restrictedCode || restrictedCode.trim() !== redeemCode.restrictedCode.trim()) {
        return res.status(400).json({ message: '此兌換碼不適用於當前場景' });
      }
    }

    // 檢查適用範圍
    if (!redeemCode.applicableTypes.includes('all') && 
        !redeemCode.applicableTypes.includes(orderType)) {
      return res.status(400).json({ message: '此兌換碼不適用於當前訂單類型' });
    }

    // 檢查最低消費金額
    if (amount < redeemCode.minAmount) {
      return res.status(400).json({ 
        message: `此兌換碼需要最低消費 HK$${redeemCode.minAmount}` 
      });
    }

    // 檢查用戶是否可以使用
    const canUse = await redeemCode.canUserUse(req.user.id);
    if (!canUse) {
      return res.status(400).json({ message: '您已超過此兌換碼的使用次數限制' });
    }

    // 計算折扣
    const discountAmount = redeemCode.calculateDiscount(amount);
    const finalAmount = amount - discountAmount;

    res.json({
      valid: true,
      redeemCode: {
        id: redeemCode._id,
        code: redeemCode.code,
        name: redeemCode.name,
        type: redeemCode.type,
        value: redeemCode.value,
        discountAmount: discountAmount,
        finalAmount: finalAmount
      }
    });

  } catch (error) {
    console.error('驗證兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/redeem/use
// @desc    使用兌換碼
// @access  Private
router.post('/use', [
  auth,
  body('redeemCodeId').isMongoId().withMessage('請提供有效的兌換碼ID'),
  body('orderType').isIn(['booking', 'recharge', 'activity', 'product', 'eshop']).withMessage('訂單類型必須是 booking、recharge、activity、product 或 eshop'),
  body('orderId').isMongoId().withMessage('請提供有效的訂單ID'),
  body('originalAmount').isFloat({ min: 0 }).withMessage('原始金額必須大於等於0'),
  body('discountAmount').isFloat({ min: 0 }).withMessage('折扣金額必須大於等於0'),
  body('finalAmount').isFloat({ min: 0 }).withMessage('最終金額必須大於等於0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { 
      redeemCodeId, 
      orderType, 
      orderId, 
      originalAmount, 
      discountAmount, 
      finalAmount 
    } = req.body;

    // 查找兌換碼
    const redeemCode = await RedeemCode.findById(redeemCodeId);
    if (!redeemCode || !redeemCode.isValid()) {
      return res.status(400).json({ message: '兌換碼無效或已過期' });
    }

    // 檢查用戶是否可以使用
    const canUse = await redeemCode.canUserUse(req.user.id);
    if (!canUse) {
      return res.status(400).json({ message: '您已超過此兌換碼的使用次數限制' });
    }

    // 創建使用記錄
    const redeemUsage = new RedeemUsage({
      redeemCode: redeemCodeId,
      user: req.user.id,
      orderType,
      orderId,
      originalAmount,
      discountAmount,
      finalAmount,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    await redeemUsage.save();

    // 更新兌換碼統計
    redeemCode.totalUsed += 1;
    redeemCode.totalDiscount += discountAmount;
    await redeemCode.save();

    res.json({
      message: '兌換碼使用成功',
      usage: {
        id: redeemUsage._id,
        discountAmount,
        finalAmount
      }
    });

  } catch (error) {
    console.error('使用兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/my-usage
// @desc    獲取我的兌換碼使用記錄
// @access  Private
router.get('/my-usage', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const usages = await RedeemUsage.find({ user: req.user.id })
      .populate('redeemCode', 'code name type value')
      .sort({ usedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await RedeemUsage.countDocuments({ user: req.user.id });
    
    res.json({
      usages,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取兌換碼使用記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/redeem/admin/create
// @desc    創建兌換碼 (僅管理員)
// @access  Private (Admin)
router.post('/admin/create', [
  auth,
  adminAuth,
  body('code').trim().notEmpty().withMessage('兌換碼不能為空'),
  body('name').trim().notEmpty().withMessage('兌換碼名稱不能為空'),
  body('type').isIn(['fixed', 'percentage']).withMessage('類型必須是 fixed 或 percentage'),
  body('value').isFloat({ min: 0 }).withMessage('折扣值必須大於等於0'),
  body('minAmount').optional().isFloat({ min: 0 }).withMessage('最低消費金額不能為負數'),
  body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('最大折扣金額不能為負數'),
  body('usageLimit').optional().custom((value) => {
    if (value === undefined || value === null || value === '') {
      return true; // 允許空值
    }
    const num = parseInt(value);
    if (isNaN(num) || num < 1) {
      throw new Error('使用次數限制必須是正整數');
    }
    return true;
  }),
  body('userUsageLimit').isInt({ min: 1 }).withMessage('每用戶使用次數限制必須是正整數'),
  body('validUntil').isISO8601().withMessage('請提供有效的到期日期'),
  body('applicableTypes').optional().isArray().withMessage('適用類型必須是數組'),
  body('restrictedCode').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const redeemCodeData = {
      ...req.body,
      code: req.body.code.toUpperCase(),
      createdBy: req.user.id,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date()
    };

    const redeemCode = new RedeemCode(redeemCodeData);
    await redeemCode.save();

    res.status(201).json({
      message: '兌換碼創建成功',
      redeemCode
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: '兌換碼已存在' });
    }
    console.error('創建兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/list
// @desc    獲取所有兌換碼 (僅管理員)
// @access  Private (Admin)
router.get('/admin/list', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = {};
    if (status === 'active') {
      query.isActive = true;
      query.validFrom = { $lte: new Date() };
      query.validUntil = { $gte: new Date() };
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    } else if (status === 'inactive') {
      query.isActive = false;
    }
    
    const redeemCodes = await RedeemCode.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await RedeemCode.countDocuments(query);
    
    res.json({
      redeemCodes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取兌換碼列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/redeem/admin/:id
// @desc    更新兌換碼 (僅管理員)
// @access  Private (Admin)
router.put('/admin/:id', [
  auth,
  adminAuth,
  body('code').optional().trim().notEmpty().withMessage('兌換碼不能為空'),
  body('name').optional().trim().notEmpty().withMessage('兌換碼名稱不能為空'),
  body('type').optional().isIn(['fixed', 'percentage']).withMessage('類型必須是 fixed 或 percentage'),
  body('value').optional().isFloat({ min: 0 }).withMessage('折扣值必須大於等於0'),
  body('minAmount').optional().isFloat({ min: 0 }).withMessage('最低消費金額不能為負數'),
  body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('最大折扣金額不能為負數'),
  body('usageLimit').optional().custom((value) => {
    if (value === undefined || value === null || value === '') {
      return true; // 允許空值
    }
    const num = parseInt(value);
    if (isNaN(num) || num < 1) {
      throw new Error('使用次數限制必須是正整數');
    }
    return true;
  }),
  body('userUsageLimit').optional().isInt({ min: 1 }).withMessage('每用戶使用次數限制必須是正整數'),
  body('validUntil').optional().isISO8601().withMessage('請提供有效的到期日期'),
  body('applicableTypes').optional().isArray().withMessage('適用類型必須是數組'),
  body('restrictedCode').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const redeemCode = await RedeemCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!redeemCode) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }

    res.json({
      message: '兌換碼更新成功',
      redeemCode
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: '兌換碼已存在' });
    }
    console.error('更新兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/redeem/admin/:id/status
// @desc    更新兌換碼狀態 (僅管理員)
// @access  Private (Admin)
router.put('/admin/:id/status', [
  auth,
  adminAuth,
  body('isActive').isBoolean().withMessage('狀態必須是布林值')
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
    const redeemCode = await RedeemCode.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );

    if (!redeemCode) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }

    res.json({
      message: `兌換碼已${isActive ? '啟用' : '禁用'}`,
      redeemCode
    });

  } catch (error) {
    console.error('更新兌換碼狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/stats
// @desc    獲取兌換碼統計數據 (僅管理員)
// @access  Private (Admin)
router.get('/admin/stats', [auth, adminAuth], async (req, res) => {
  try {
    const now = new Date();
    
    // 總兌換碼數量
    const totalCodes = await RedeemCode.countDocuments();
    
    // 有效兌換碼數量
    const activeCodes = await RedeemCode.countDocuments({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    });
    
    // 總使用次數
    const totalUsageResult = await RedeemCode.aggregate([
      {
        $group: {
          _id: null,
          totalUsage: { $sum: '$totalUsed' }
        }
      }
    ]);
    const totalUsage = totalUsageResult.length > 0 ? totalUsageResult[0].totalUsage : 0;
    
    // 總折扣金額
    const totalDiscountResult = await RedeemCode.aggregate([
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: '$totalDiscount' }
        }
      }
    ]);
    const totalDiscount = totalDiscountResult.length > 0 ? totalDiscountResult[0].totalDiscount : 0;
    
    res.json({
      success: true,
      stats: {
        totalCodes,
        activeCodes,
        totalUsage,
        totalDiscount
      }
    });

  } catch (error) {
    console.error('獲取兌換碼統計錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/:id/usage
// @desc    獲取特定兌換碼的使用記錄 (僅管理員)
// @access  Private (Admin)
router.get('/admin/:id/usage', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // 檢查兌換碼是否存在
    const redeemCode = await RedeemCode.findById(id);
    if (!redeemCode) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }
    
    // 獲取使用記錄
    const usages = await RedeemUsage.find({ redeemCode: id })
      .populate('user', 'name email phone')
      .sort({ usedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await RedeemUsage.countDocuments({ redeemCode: id });
    
    res.json({
      success: true,
      redeemCode: {
        _id: redeemCode._id,
        code: redeemCode.code,
        name: redeemCode.name
      },
      usages,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('獲取兌換碼使用記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
