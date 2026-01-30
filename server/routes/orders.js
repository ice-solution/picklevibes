const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');
const emailService = require('../services/emailService');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/orders
// @desc    創建訂單
// @access  Private
router.post('/', [
  auth,
  body('items').isArray({ min: 1 }).withMessage('訂單必須至少包含一個產品'),
  body('items.*.productId').isMongoId().withMessage('請提供有效的產品ID'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('數量必須是正整數'),
  body('shippingAddress.name').trim().notEmpty().withMessage('收件人姓名為必填項目'),
  body('shippingAddress.phone').trim().notEmpty().withMessage('收件人電話為必填項目'),
  body('shippingAddress.address').trim().notEmpty().withMessage('收件地址為必填項目'),
  body('redeemCodeId').optional().isMongoId().withMessage('請提供有效的兌換碼ID'),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { items, shippingAddress, redeemCodeId, notes } = req.body;
    const userId = req.user.id;

    // 驗證產品並計算總額
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      
      if (!product) {
        return res.status(404).json({ message: `產品 ${item.productId} 不存在` });
      }

      if (!product.isActive) {
        return res.status(400).json({ message: `產品 ${product.name} 已下架` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({ message: `產品 ${product.name} 庫存不足` });
      }

      const price = product.discountPrice !== null && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;
      
      const itemSubtotal = price * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: price,
        quantity: item.quantity,
        subtotal: itemSubtotal
      });
    }

    // 處理兌換碼
    let discount = 0;
    let redeemCode = null;
    let redeemCodeName = null;

    if (redeemCodeId) {
      redeemCode = await RedeemCode.findById(redeemCodeId);
      
      if (!redeemCode || !redeemCode.isValid()) {
        return res.status(400).json({ message: '兌換碼無效或已過期' });
      }

      // 檢查專用代碼限制
      if (redeemCode.restrictedCode && redeemCode.restrictedCode.trim() !== '') {
        if (redeemCode.restrictedCode.trim() !== 'product' && redeemCode.restrictedCode.trim() !== 'eshop') {
          return res.status(400).json({ message: '此兌換碼不適用於產品購買' });
        }
      }

      // 檢查適用範圍
      if (!redeemCode.applicableTypes.includes('all') && 
          !redeemCode.applicableTypes.includes('product') &&
          !redeemCode.applicableTypes.includes('eshop')) {
        return res.status(400).json({ message: '此兌換碼不適用於產品購買' });
      }

      // 檢查最低消費金額
      if (subtotal < redeemCode.minAmount) {
        return res.status(400).json({ 
          message: `此兌換碼需要最低消費 HK$${redeemCode.minAmount}` 
        });
      }

      // 檢查用戶是否可以使用
      const userUsageCount = await RedeemUsage.countDocuments({
        redeemCode: redeemCodeId,
        user: userId
      });
      
      if (userUsageCount >= redeemCode.userUsageLimit) {
        return res.status(400).json({ message: '您已超過此兌換碼的使用次數限制' });
      }

      // 計算折扣
      discount = redeemCode.calculateDiscount(subtotal);
      redeemCodeName = redeemCode.name;
    }

    const total = subtotal - discount;

    // 創建訂單
    const order = new Order({
      orderNumber: Order.generateOrderNumber(),
      user: userId,
      items: orderItems,
      subtotal,
      discount,
      total,
      shippingAddress,
      redeemCode: redeemCodeId || null,
      redeemCodeName,
      notes,
      status: 'pending'
    });

    await order.save();

    // 更新產品庫存
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    // 記錄兌換碼使用
    if (redeemCode) {
      const redeemUsage = new RedeemUsage({
        redeemCode: redeemCode._id,
        user: userId,
        orderType: 'product',
        orderId: order._id,
        originalAmount: subtotal,
        discountAmount: discount,
        finalAmount: total,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      await redeemUsage.save();

      // 更新兌換碼統計
      redeemCode.totalUsed += 1;
      redeemCode.totalDiscount += discount;
      await redeemCode.save();
    }

    // 發送訂單確認郵件
    try {
      const user = await require('../models/User').findById(userId);
      await emailService.sendOrderConfirmationEmail(user, order);
    } catch (emailError) {
      console.error('發送訂單確認郵件失敗:', emailError);
      // 不影響訂單創建
    }

    res.status(201).json({
      message: '訂單創建成功',
      order
    });
  } catch (error) {
    console.error('創建訂單錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/orders/my-orders
// @desc    獲取我的訂單列表
// @access  Private
router.get('/my-orders', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }
    
    const orders = await Order.find(query)
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取訂單列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/orders/:id
// @desc    獲取訂單詳情
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product', 'name images')
      .populate('user', 'name email phone');
    
    if (!order) {
      return res.status(404).json({ message: '訂單不存在' });
    }

    // 檢查權限：只有訂單所有者或管理員可以查看
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: '無權限查看此訂單' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('獲取訂單錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/orders/admin/list
// @desc    獲取所有訂單列表（僅管理員）
// @access  Private (Admin)
router.get('/admin/list', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, status, orderNumber } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    if (orderNumber) {
      query.orderNumber = { $regex: orderNumber, $options: 'i' };
    }
    
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(query);
    
    res.json({
      orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取訂單列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/orders/:id/status
// @desc    更新訂單狀態（僅管理員）
// @access  Private (Admin)
router.put('/:id/status', [
  auth,
  adminAuth,
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('無效的訂單狀態'),
  body('trackingNumber').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { status, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: '訂單不存在' });
    }

    const oldStatus = order.status;
    order.status = status;
    
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    // 如果狀態變更為已出貨，記錄出貨時間
    if (status === 'shipped' && oldStatus !== 'shipped') {
      order.shippedAt = new Date();
      
      // 發送出貨通知郵件
      try {
        await emailService.sendOrderShippedEmail(order.user, order);
      } catch (emailError) {
        console.error('發送出貨通知郵件失敗:', emailError);
        // 不影響訂單狀態更新
      }
    }

    await order.save();

    res.json({
      message: '訂單狀態更新成功',
      order
    });
  } catch (error) {
    console.error('更新訂單狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/orders/:id
// @desc    更新訂單（僅管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('trackingNumber').optional().trim(),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ message: '訂單不存在' });
    }

    res.json({
      message: '訂單更新成功',
      order
    });
  } catch (error) {
    console.error('更新訂單錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;






