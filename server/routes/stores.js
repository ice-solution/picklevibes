const express = require('express');
const { body, validationResult } = require('express-validator');
const Store = require('../models/Store');
const Court = require('../models/Court');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/** 平台管理員或該店員工可查看停用店鋪（前台公開列表仍只顯示上線店） */
function canSeeInactiveStore(req, store) {
  if (!store || !req.user) return false;
  if (req.user.role === 'admin') return true;
  if (req.user.role === 'staff' && req.tenantAccess) {
    const ids = req.tenantAccess.managedStoreIds || [];
    return ids.some((id) => String(id) === String(store._id));
  }
  return false;
}

// @route   GET /api/stores
// @desc    取得上線店鋪（預約選店用）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug address phone operatingHours sortOrder enableHikAccess');
    res.json({ stores });
  } catch (error) {
    console.error('獲取店鋪列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stores/admin/all
// @desc    管理員取得全部店鋪
// @access  Private (Admin)
router.get('/admin/all', [auth, adminAuth], async (req, res) => {
  try {
    let query = {};
    // 店鋪員工：只回傳自己管理的店
    if (req.tenantAccess && !req.tenantAccess.isPlatformAdmin) {
      const ids = req.tenantAccess.managedStoreIds || [];
      query = { _id: { $in: ids } };
    }
    const stores = await Store.find(query).sort({ sortOrder: 1, name: 1 });
    res.json({ stores });
  } catch (error) {
    console.error('獲取店鋪列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stores/by-slug/:slug
// @desc    以 slug 取得店鋪（店鋪後台用）
// @access  Public
router.get('/by-slug/:slug', optionalAuth, async (req, res) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const forLogin = req.query.forLogin === '1' || req.query.forLogin === 'true';
    const store = await Store.findOne({ slug })
      .select('name slug address phone operatingHours sortOrder enableHikAccess isActive');
    if (!store) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    if (!store.isActive && !forLogin && !canSeeInactiveStore(req, store)) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    res.json({ store });
  } catch (error) {
    console.error('獲取店鋪錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/stores
// @desc    建立店鋪
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().notEmpty().withMessage('店鋪名稱不能為空'),
  body('slug').trim().notEmpty().withMessage('slug 不能為空'),
  body('address').trim().notEmpty().withMessage('地址不能為空'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }
    const payload = { ...req.body, slug: String(req.body.slug).trim().toLowerCase() };
    const store = await Store.create(payload);
    res.status(201).json({ message: '店鋪建立成功', store });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'slug 已存在' });
    }
    console.error('建立店鋪錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/stores/:id
// @desc    更新店鋪
// @access  Private (Admin)
router.put('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.slug) update.slug = String(update.slug).trim().toLowerCase();
    const store = await Store.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!store) return res.status(404).json({ message: '店鋪不存在' });
    res.json({ message: '店鋪更新成功', store });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'slug 已存在' });
    }
    console.error('更新店鋪錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stores/:id
// @desc    單一店鋪
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    if (!store.isActive && !canSeeInactiveStore(req, store)) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    res.json({ store });
  } catch (error) {
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
