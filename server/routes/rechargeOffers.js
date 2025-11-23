const express = require('express');
const { body, validationResult } = require('express-validator');
const RechargeOffer = require('../models/RechargeOffer');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/recharge-offers
// @desc    獲取所有充值優惠 (用戶端)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const currentDate = new Date();
    
    // 獲取所有有效的充值優惠
    const offers = await RechargeOffer.find({
      isActive: true,
      expiryDate: { $gt: currentDate }
    })
    .sort({ sortOrder: 1, createdAt: 1 })
    .select('name points amount description expiryDate');

    res.json({ offers });
  } catch (error) {
    console.error('獲取充值優惠錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/recharge-offers/admin
// @desc    獲取所有充值優惠 (管理員端)
// @access  Private (Admin)
router.get('/admin', auth, adminAuth, async (req, res) => {
  try {
    const offers = await RechargeOffer.find()
      .sort({ sortOrder: 1, createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({ offers });
  } catch (error) {
    console.error('獲取充值優惠錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/recharge-offers
// @desc    創建充值優惠
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('優惠名稱必須在1-100個字符之間'),
  body('points').isInt({ min: 1 }).withMessage('充值積分必須是大於0的整數'),
  body('amount').isFloat({ min: 1 }).withMessage('充值金額必須是大於0的數值'),
  body('description').trim().isLength({ min: 1, max: 500 }).withMessage('描述必須在1-500個字符之間'),
  body('expiryDate').isISO8601().withMessage('請提供有效的過期日期'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序順序必須是非負整數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { name, points, amount, description, expiryDate, sortOrder } = req.body;

    // 檢查過期日期是否為未來時間
    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      return res.status(400).json({ 
        message: '過期日期必須是未來時間' 
      });
    }

    // 創建充值優惠
    const offer = new RechargeOffer({
      name,
      points,
      amount,
      description,
      expiryDate: expiry,
      sortOrder: sortOrder || 0,
      createdBy: req.user.id
    });

    await offer.save();

    // 返回創建的優惠（包含創建者信息）
    const createdOffer = await RechargeOffer.findById(offer._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: '充值優惠創建成功',
      offer: createdOffer
    });

  } catch (error) {
    console.error('創建充值優惠錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/recharge-offers/:id
// @desc    更新充值優惠
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('優惠名稱必須在1-100個字符之間'),
  body('points').optional().isInt({ min: 1 }).withMessage('充值積分必須是大於0的整數'),
  body('amount').optional().isFloat({ min: 1 }).withMessage('充值金額必須是大於0的數值'),
  body('description').optional().trim().isLength({ min: 1, max: 500 }).withMessage('描述必須在1-500個字符之間'),
  body('expiryDate').optional().isISO8601().withMessage('請提供有效的過期日期'),
  body('isActive').optional().isBoolean().withMessage('活動狀態必須是布爾值'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序順序必須是非負整數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // 如果更新過期日期，檢查是否為未來時間
    if (updates.expiryDate) {
      const expiry = new Date(updates.expiryDate);
      if (expiry <= new Date()) {
        return res.status(400).json({ 
          message: '過期日期必須是未來時間' 
        });
      }
    }

    const offer = await RechargeOffer.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!offer) {
      return res.status(404).json({ message: '充值優惠不存在' });
    }

    res.json({
      message: '充值優惠更新成功',
      offer
    });

  } catch (error) {
    console.error('更新充值優惠錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/recharge-offers/:id
// @desc    刪除充值優惠
// @access  Private (Admin)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await RechargeOffer.findByIdAndDelete(id);

    if (!offer) {
      return res.status(404).json({ message: '充值優惠不存在' });
    }

    res.json({ message: '充值優惠刪除成功' });

  } catch (error) {
    console.error('刪除充值優惠錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/recharge-offers/:id/toggle
// @desc    切換充值優惠活動狀態
// @access  Private (Admin)
router.post('/:id/toggle', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const offer = await RechargeOffer.findById(id);

    if (!offer) {
      return res.status(404).json({ message: '充值優惠不存在' });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.json({
      message: `充值優惠已${offer.isActive ? '啟用' : '停用'}`,
      offer
    });

  } catch (error) {
    console.error('切換充值優惠狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/recharge-offers/:id/usage
// @desc    獲取特定充值優惠的使用記錄 (僅管理員)
// @access  Private (Admin)
router.get('/:id/usage', [auth, adminAuth], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // 檢查充值優惠是否存在
    const offer = await RechargeOffer.findById(id);
    if (!offer) {
      return res.status(404).json({ message: '充值優惠不存在' });
    }
    
    // 查找使用該優惠的充值記錄（通過 rechargeOffer 字段）
    const Recharge = require('../models/Recharge');
    
    const query = {
      rechargeOffer: id,
      status: 'completed' // 只統計已完成的充值
    };
    
    const recharges = await Recharge.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Recharge.countDocuments(query);
    
    res.json({
      success: true,
      offer: {
        _id: offer._id,
        name: offer.name,
        points: offer.points,
        amount: offer.amount
      },
      recharges: recharges.map(r => ({
        _id: r._id,
        user: r.user,
        points: r.points,
        amount: r.amount,
        status: r.status,
        createdAt: r.createdAt,
        paidAt: r.payment?.paidAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('獲取充值優惠使用記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
