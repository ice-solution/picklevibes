const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const FoodCategory = require('../models/FoodCategory');
const FoodItem = require('../models/FoodItem');
const FoodOrder = require('../models/FoodOrder');
const Store = require('../models/Store');
const { auth, adminAuth } = require('../middleware/auth');
const { assertStoreFeatureAccess } = require('../utils/tenantAccess');
const { assertNotShareholderWrite } = require('../utils/tenantPermissions');
const { foodUpload, processFoodImage, deleteFile } = require('../middleware/upload');
const {
  findActiveBookingsForUser,
  placeFoodOrder,
} = require('../services/foodOrderService');
const path = require('path');

const router = express.Router();
const FEATURE = 'foodOrders';

function errMsg(errors) {
  return { message: '輸入驗證失敗', errors: errors.array() };
}

function guardStore(req, res, storeId) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const writeBlock = assertNotShareholderWrite(req.tenantAccess, storeId);
    if (!writeBlock.ok) {
      res.status(writeBlock.status).json({ message: writeBlock.message });
      return true;
    }
  }
  const feature = assertStoreFeatureAccess(req.tenantAccess, storeId, FEATURE);
  if (!feature.ok) {
    res.status(feature.status).json({ message: feature.message });
    return true;
  }
  return null;
}

function parsePhones(input) {
  if (Array.isArray(input)) {
    return input.map((p) => String(p || '').trim()).filter(Boolean);
  }
  return String(input || '')
    .split(/[,，\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// ─── User ────────────────────────────────────────────────

/** 目前進行中的預約（可訂餐） */
router.get('/eligibility', auth, async (req, res) => {
  try {
    const bookings = await findActiveBookingsForUser(req.user._id);
    res.json({
      canOrder: bookings.length > 0,
      bookings: bookings.map((b) => ({
        _id: b._id,
        store: b.store,
        court: b.court,
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
    });
  } catch (error) {
    console.error('food eligibility:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

/** 某店選單（需該店有進行中預約） */
router.get('/menu', auth, async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.store;
    if (!storeId || !mongoose.isValidObjectId(storeId)) {
      return res.status(400).json({ message: '請提供店鋪' });
    }
    const active = await findActiveBookingsForUser(req.user._id, storeId);
    if (!active.length) {
      return res.status(403).json({ message: '目前沒有此店鋪進行中的預約，無法瀏覽菜單' });
    }

    const [categories, items] = await Promise.all([
      FoodCategory.find({ store: storeId, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
      FoodItem.find({ store: storeId, isAvailable: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    res.json({
      storeId,
      booking: active[0],
      bookings: active,
      categories,
      items,
    });
  } catch (error) {
    console.error('food menu:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

/** 下單 */
router.post(
  '/orders',
  auth,
  [
    body('bookingId').isMongoId().withMessage('請提供有效預約'),
    body('items').isArray({ min: 1 }).withMessage('請選擇餐點'),
    body('notes').optional().trim().isLength({ max: 300 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(errMsg(errors));

      const result = await placeFoodOrder({
        userId: req.user._id,
        bookingId: req.body.bookingId,
        items: req.body.items,
        notes: req.body.notes,
      });

      res.status(201).json({
        message: '訂餐成功',
        order: result.order,
        balance: result.balance,
        notifyResult: result.notifyResult,
      });
    } catch (error) {
      const status = error.status || (error.message === '餘額不足' ? 400 : 500);
      if (status < 500) return res.status(status).json({ message: error.message });
      console.error('place food order:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

/** 我的訂餐紀錄 */
router.get('/orders/mine', auth, async (req, res) => {
  try {
    const orders = await FoodOrder.find({ user: req.user._id })
      .populate('store', 'name slug')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ orders });
  } catch (error) {
    console.error('my food orders:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Admin: categories ───────────────────────────────────

router.get('/admin/categories', [auth, adminAuth], async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.store;
    const filter = {};
    if (storeId) {
      if (guardStore(req, res, storeId)) return;
      filter.store = storeId;
    } else if (!req.tenantAccess?.isPlatformAdmin) {
      const allowed = (req.tenantAccess.managedStores || [])
        .filter((s) => assertStoreFeatureAccess(req.tenantAccess, s.id, FEATURE).ok)
        .map((s) => s.id);
      filter.store = { $in: allowed };
    }

    const categories = await FoodCategory.find(filter)
      .populate('store', 'name slug')
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ categories });
  } catch (error) {
    console.error('list food categories:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/admin/categories',
  [auth, adminAuth],
  [
    body('store').isMongoId().withMessage('請選擇店鋪'),
    body('name').trim().notEmpty().withMessage('類別名稱為必填'),
    body('description').optional().trim(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(errMsg(errors));
      if (guardStore(req, res, req.body.store)) return;

      const category = await FoodCategory.create({
        store: req.body.store,
        name: req.body.name.trim(),
        description: String(req.body.description || '').trim(),
        sortOrder: Number(req.body.sortOrder) || 0,
        isActive: req.body.isActive !== false && req.body.isActive !== 'false',
      });
      res.status(201).json({ category });
    } catch (error) {
      console.error('create food category:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.put(
  '/admin/categories/:id',
  [auth, adminAuth],
  async (req, res) => {
    try {
      const category = await FoodCategory.findById(req.params.id);
      if (!category) return res.status(404).json({ message: '類別不存在' });
      if (guardStore(req, res, category.store)) return;

      if (req.body.name != null) category.name = String(req.body.name).trim();
      if (req.body.description != null) category.description = String(req.body.description).trim();
      if (req.body.sortOrder != null) category.sortOrder = Number(req.body.sortOrder) || 0;
      if (req.body.isActive != null) {
        category.isActive = req.body.isActive === true || req.body.isActive === 'true';
      }
      await category.save();
      res.json({ category });
    } catch (error) {
      console.error('update food category:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.delete('/admin/categories/:id', [auth, adminAuth], async (req, res) => {
  try {
    const category = await FoodCategory.findById(req.params.id);
    if (!category) return res.status(404).json({ message: '類別不存在' });
    if (guardStore(req, res, category.store)) return;

    const itemCount = await FoodItem.countDocuments({ category: category._id });
    if (itemCount > 0) {
      return res.status(400).json({ message: `此類別尚有 ${itemCount} 項餐點，請先刪除或移走` });
    }
    await category.deleteOne();
    res.json({ message: '已刪除' });
  } catch (error) {
    console.error('delete food category:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Admin: items ────────────────────────────────────────

router.get('/admin/items', [auth, adminAuth], async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.store;
    const filter = {};
    if (storeId) {
      if (guardStore(req, res, storeId)) return;
      filter.store = storeId;
    } else if (!req.tenantAccess?.isPlatformAdmin) {
      const allowed = (req.tenantAccess.managedStores || [])
        .filter((s) => assertStoreFeatureAccess(req.tenantAccess, s.id, FEATURE).ok)
        .map((s) => s.id);
      filter.store = { $in: allowed };
    }
    if (req.query.category) filter.category = req.query.category;

    const items = await FoodItem.find(filter)
      .populate('store', 'name slug')
      .populate('category', 'name')
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    res.json({ items });
  } catch (error) {
    console.error('list food items:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/admin/items',
  [auth, adminAuth, foodUpload.single('image'), processFoodImage],
  async (req, res) => {
    try {
      const storeId = req.body.store;
      const categoryId = req.body.category;
      if (!storeId || !mongoose.isValidObjectId(storeId)) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: '請選擇店鋪' });
      }
      if (!categoryId || !mongoose.isValidObjectId(categoryId)) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: '請選擇類別' });
      }
      if (guardStore(req, res, storeId)) {
        if (req.file) deleteFile(req.file.path);
        return;
      }

      const category = await FoodCategory.findOne({ _id: categoryId, store: storeId });
      if (!category) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: '類別不存在或不屬於此店鋪' });
      }

      const name = String(req.body.name || '').trim();
      const price = Number(req.body.price);
      if (!name) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: '餐點名稱為必填' });
      }
      if (!Number.isFinite(price) || price < 0) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ message: '請輸入有效價錢' });
      }

      const image = req.file ? `food/${req.file.filename}` : '';
      const item = await FoodItem.create({
        store: storeId,
        category: categoryId,
        name,
        description: String(req.body.description || '').trim(),
        price,
        image,
        sortOrder: Number(req.body.sortOrder) || 0,
        isAvailable: req.body.isAvailable !== 'false' && req.body.isAvailable !== false,
      });
      res.status(201).json({ item });
    } catch (error) {
      if (req.file) deleteFile(req.file.path);
      console.error('create food item:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.put(
  '/admin/items/:id',
  [auth, adminAuth, foodUpload.single('image'), processFoodImage],
  async (req, res) => {
    try {
      const item = await FoodItem.findById(req.params.id);
      if (!item) {
        if (req.file) deleteFile(req.file.path);
        return res.status(404).json({ message: '餐點不存在' });
      }
      if (guardStore(req, res, item.store)) {
        if (req.file) deleteFile(req.file.path);
        return;
      }

      if (req.body.category) {
        const category = await FoodCategory.findOne({ _id: req.body.category, store: item.store });
        if (!category) {
          if (req.file) deleteFile(req.file.path);
          return res.status(400).json({ message: '類別不存在或不屬於此店鋪' });
        }
        item.category = category._id;
      }
      if (req.body.name != null) item.name = String(req.body.name).trim();
      if (req.body.description != null) item.description = String(req.body.description).trim();
      if (req.body.price != null) {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 0) {
          if (req.file) deleteFile(req.file.path);
          return res.status(400).json({ message: '請輸入有效價錢' });
        }
        item.price = price;
      }
      if (req.body.sortOrder != null) item.sortOrder = Number(req.body.sortOrder) || 0;
      if (req.body.isAvailable != null) {
        item.isAvailable = req.body.isAvailable === true || req.body.isAvailable === 'true';
      }
      if (req.file) {
        if (item.image) {
          deleteFile(path.join(__dirname, '../../uploads', item.image));
        }
        item.image = `food/${req.file.filename}`;
      }
      await item.save();
      res.json({ item });
    } catch (error) {
      if (req.file) deleteFile(req.file.path);
      console.error('update food item:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.delete('/admin/items/:id', [auth, adminAuth], async (req, res) => {
  try {
    const item = await FoodItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: '餐點不存在' });
    if (guardStore(req, res, item.store)) return;
    if (item.image) {
      deleteFile(path.join(__dirname, '../../uploads', item.image));
    }
    await item.deleteOne();
    res.json({ message: '已刪除' });
  } catch (error) {
    console.error('delete food item:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Admin: orders + notify settings ─────────────────────

router.get('/admin/orders', [auth, adminAuth], async (req, res) => {
  try {
    const storeId = req.query.storeId || req.query.store;
    const filter = {};
    if (storeId) {
      if (guardStore(req, res, storeId)) return;
      filter.store = storeId;
    } else if (!req.tenantAccess?.isPlatformAdmin) {
      const allowed = (req.tenantAccess.managedStores || [])
        .filter((s) => assertStoreFeatureAccess(req.tenantAccess, s.id, FEATURE).ok)
        .map((s) => s.id);
      filter.store = { $in: allowed };
    }
    if (req.query.status) filter.status = req.query.status;

    const orders = await FoodOrder.find(filter)
      .populate('user', 'name phone email')
      .populate('store', 'name slug')
      .populate('booking', 'startTime endTime date court')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ orders });
  } catch (error) {
    console.error('list food orders:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.patch('/admin/orders/:id/status', [auth, adminAuth], async (req, res) => {
  try {
    const order = await FoodOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: '訂單不存在' });
    if (guardStore(req, res, order.store)) return;

    const allowed = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    const status = String(req.body.status || '');
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: '無效狀態' });
    }

    // 取消已扣款訂單：退回積分
    if (status === 'cancelled' && order.status !== 'cancelled' && order.pointsChargedAt) {
      const UserBalance = require('../models/UserBalance');
      let bal = await UserBalance.findOne({ user: order.user });
      if (!bal) {
        bal = new UserBalance({ user: order.user, balance: 0 });
      }
      await bal.refund(
        order.totalPoints,
        `訂餐取消退款 · ${String(order._id).slice(-6)}`,
        order.booking,
        null,
        null,
        null,
        order._id
      );
      order.pointsChargedAt = null;
    }

    order.status = status;
    await order.save();
    res.json({ order });
  } catch (error) {
    console.error('update food order status:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/admin/notify-settings/:storeId', [auth, adminAuth], async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) {
      return res.status(400).json({ message: '無效店鋪' });
    }
    if (guardStore(req, res, storeId)) return;
    const store = await Store.findById(storeId).select('name foodOrderNotify').lean();
    if (!store) return res.status(404).json({ message: '店鋪不存在' });
    res.json({
      storeId: store._id,
      name: store.name,
      foodOrderNotify: store.foodOrderNotify || { enabled: false, notifyPhones: [] },
    });
  } catch (error) {
    console.error('get food notify settings:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/admin/notify-settings/:storeId', [auth, adminAuth], async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) {
      return res.status(400).json({ message: '無效店鋪' });
    }
    if (guardStore(req, res, storeId)) return;

    const enabled = req.body.enabled === true || req.body.enabled === 'true';
    const notifyPhones = parsePhones(req.body.notifyPhones);

    const store = await Store.findByIdAndUpdate(
      storeId,
      {
        $set: {
          foodOrderNotify: { enabled, notifyPhones },
        },
      },
      { new: true }
    ).select('name foodOrderNotify');

    if (!store) return res.status(404).json({ message: '店鋪不存在' });
    res.json({
      message: '已更新',
      foodOrderNotify: store.foodOrderNotify,
    });
  } catch (error) {
    console.error('update food notify settings:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
