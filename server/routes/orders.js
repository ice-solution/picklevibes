const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const UserBalance = require('../models/UserBalance');
const Product = require('../models/Product');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');
const { consumeRedeemCodeOnce } = require('../services/redeemUsageService');
const emailService = require('../services/emailService');
const { normalizeClothingSize } = require('../utils/clothingSizes');
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
  body('redeemCodeId').optional({ values: 'null' }).isMongoId().withMessage('請提供有效的兌換碼ID'),
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

      let sizeForOrder = null;
      if (product.isClothing) {
        const normalized = normalizeClothingSize(item.size);
        if (!normalized) {
          return res.status(400).json({
            message: `產品「${product.name}」請選擇有效尺碼（XS、S、M、L、XL）`
          });
        }
        sizeForOrder = normalized;
      } else if (item.size !== undefined && item.size !== null && String(item.size).trim() !== '') {
        return res.status(400).json({
          message: `產品「${product.name}」無需填寫尺碼`
        });
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        price: price,
        quantity: item.quantity,
        subtotal: itemSubtotal,
        size: sizeForOrder
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

      // 檢查適用範圍（僅以此為準）
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

    // 創建訂單（積分於後台「確認訂單」時扣除，見 PUT /:id/status）
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
      await consumeRedeemCodeOnce({
        redeemCodeId: redeemCode._id,
        userId,
        orderType: 'product',
        orderId: order._id,
        originalAmount: subtotal,
        discountAmount: discount,
        finalAmount: total,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });
    }

    // 發送訂單確認郵件
    try {
      const user = await require('../models/User').findById(userId);
      await emailService.sendOrderConfirmationEmail(user, order);

      // 額外寄送通知給後台（NOTICE_EMAIL，備援 EMAIL_USER / GMAIL_USER）
      try {
        await emailService.sendOrderAdminNotificationEmail(user, order);
      } catch (notifyError) {
        console.error('發送後台訂單通知郵件失敗:', notifyError.message || notifyError);
        // 不影響訂單回應
      }
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
    const userId = order.user._id ? order.user._id : order.user;

    // 取消訂單：若曾於確認時扣過積分，需退回
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      const refundAmt = order.pointsChargedAmount || 0;
      if (refundAmt > 0) {
        const userBalance = await UserBalance.findOne({ user: userId });
        if (userBalance) {
          await userBalance.refund(
            refundAmt,
            `網店訂單 ${order.orderNumber} 取消退回積分`,
            null,
            order._id
          );
        }
        order.pointsChargedAmount = 0;
        order.pointsChargedAt = null;
      }
    }

    // 後台確認訂單（pending → confirmed）：依訂單總額扣除用戶積分（與前台「積分」定價一致）
    if (status === 'confirmed' && oldStatus === 'pending') {
      const chargedBefore = order.pointsChargedAmount || 0;
      const pointsToCharge = Math.round(Number(order.total)) || 0;

      if (pointsToCharge > 0 && chargedBefore === 0) {
        let userBalance = await UserBalance.findOne({ user: userId });
        if (!userBalance) {
          userBalance = new UserBalance({ user: userId, balance: 0 });
        }

        if (userBalance.balance < pointsToCharge) {
          return res.status(400).json({
            message: '客戶積分不足，請通知客戶充值',
            required: pointsToCharge,
            available: userBalance.balance
          });
        }

        await userBalance.deductBalance(
          pointsToCharge,
          `網店訂單 ${order.orderNumber}（後台確認扣款）`,
          null,
          order._id
        );
        order.pointsChargedAmount = pointsToCharge;
        order.pointsChargedAt = new Date();
      }
    }

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

// @route   PUT /api/orders/:id/cancel
// @desc    取消訂單（僅管理員）：恢復庫存、退還實付金額（積分）、退還兌換碼使用，並發送取消通知郵件
// @access  Private (Admin)
router.put('/:id/cancel', [auth, adminAuth], async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone');

    if (!order) {
      return res.status(404).json({ message: '訂單不存在' });
    }

    const cancellable = ['pending', 'confirmed', 'processing'];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({
        message: `訂單狀態為「${order.status}」時無法取消，僅待處理／已確認／處理中可取消`
      });
    }

    // 1. 恢復產品庫存
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    // 2. 退還積分：後台確認扣款（pointsChargedAmount）或舊制下單即扣（pointsDeducted）
    let pointsRefunded = 0;
    const charged = order.pointsChargedAmount || 0;
    const legacyDeducted = order.pointsDeducted || 0;
    let userBalance = await UserBalance.findOne({ user: order.user._id });
    if (!userBalance) {
      userBalance = new UserBalance({ user: order.user._id });
    }
    if (charged > 0) {
      await userBalance.refund(
        charged,
        `網店訂單 ${order.orderNumber} 取消退回積分`,
        null,
        order._id
      );
      pointsRefunded = charged;
      order.pointsChargedAmount = 0;
      order.pointsChargedAt = null;
    } else if (legacyDeducted > 0) {
      await userBalance.refund(
        legacyDeducted,
        `訂單 ${order.orderNumber} 取消退款`,
        null,
        order._id
      );
      pointsRefunded = legacyDeducted;
      order.pointsDeducted = 0;
    }

    // 3. 退還兌換碼使用：刪除使用記錄並更新兌換碼統計
    if (order.redeemCode) {
      const usage = await RedeemUsage.findOne({
        orderType: 'product',
        orderId: order._id
      });
      if (usage) {
        await usage.deleteOne();
        await RedeemCode.findByIdAndUpdate(order.redeemCode, {
          $inc: { totalUsed: -1, totalDiscount: -order.discount }
        });
      }
    }

    order.status = 'cancelled';
    await order.save();

    // 4. 發送取消通知郵件
    try {
      if (order.user) {
        await emailService.sendOrderCancelledEmail(order.user, order, { pointsRefunded });
      }
    } catch (emailError) {
      console.error('發送訂單取消通知郵件失敗:', emailError);
    }

    res.json({
      message: '訂單已取消，庫存與兌換碼已退還' + (pointsRefunded > 0 ? `，已退還 ${pointsRefunded} 分至用戶餘額` : ''),
      order
    });
  } catch (error) {
    console.error('取消訂單錯誤:', error);
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






