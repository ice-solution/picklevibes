const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const Store = require('../models/Store');
const Court = require('../models/Court');
const { auth, adminAuth, platformAdminAuth } = require('../middleware/auth');
const path = require('path');
const { canAccessStore } = require('../utils/tenantAccess');
const { normalizeDomain } = require('../utils/tenantResolver');
const { HK_DISTRICTS, isValidDistrict } = require('../utils/hkDistricts');
const { storeLogoUpload, processStoreLogo, deleteFile } = require('../middleware/upload');

const router = express.Router();

// @route   GET /api/stores
// @desc    取得上線店鋪（預約選店用）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const stores = await Store.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug address phone district operatingHours sortOrder enableHikAccess');
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
    const filter = {};
    if (!req.tenantAccess?.isPlatformAdmin) {
      const ids = req.tenantAccess?.managedStoreIds || [];
      filter._id = { $in: ids };
    }
    const stores = await Store.find(filter).sort({ sortOrder: 1, name: 1 });
    res.json({ stores });
  } catch (error) {
    console.error('獲取店鋪列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/stores
// @desc    建立店鋪
// @access  Private (Admin)
router.post('/', [
  auth,
  platformAdminAuth,
  body('name').trim().notEmpty().withMessage('店鋪名稱不能為空'),
  body('slug').trim().notEmpty().withMessage('slug 不能為空'),
  body('address').trim().notEmpty().withMessage('地址不能為空'),
  body('district').optional({ nullable: true }).custom((v) => {
    if (!isValidDistrict(v)) throw new Error('請選擇有效的香港區域');
    return true;
  }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }
    const payload = { ...req.body, slug: String(req.body.slug).trim().toLowerCase() };
    if (!payload.district) payload.district = null;
    if (payload.allianceEnabled && !payload.district) {
      return res.status(400).json({ message: '加盟店鋪必須設定地區（香港 18 區）' });
    }
    if (payload.adminDomain) payload.adminDomain = normalizeDomain(payload.adminDomain);
    if (payload.consumerDomain) payload.consumerDomain = normalizeDomain(payload.consumerDomain);
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

// @route   POST /api/stores/:id/regenerate-open-api-key
// @desc    重新產生店鋪 Open API 金鑰（暫停：需 OPEN_API_ENABLED=true）
// @access  Private (Admin)
router.post('/:id/regenerate-open-api-key', [auth, platformAdminAuth], async (req, res) => {
  try {
    const { openApiEnabled } = require('../config/platformFeatures');
    if (!openApiEnabled) {
      return res.status(503).json({
        message: 'Open API 暫未開放',
        code: 'OPEN_API_DISABLED',
      });
    }
    const openApiKey = `pk_${crypto.randomBytes(24).toString('base64url')}`;
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { openApiKey, openApiEnabled: true },
      { new: true, runValidators: true }
    );
    if (!store) return res.status(404).json({ message: '店鋪不存在' });
    res.json({
      message: 'Open API 金鑰已重新產生',
      openApiKey,
      store,
    });
  } catch (error) {
    console.error('產生 Open API 金鑰錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/stores/:id
// @desc    更新店鋪
// @access  Private (Admin)
router.put('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const existing = await Store.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: '店鋪不存在' });
    if (!canAccessStore(req.tenantAccess, existing._id)) {
      return res.status(403).json({ message: '無權限編輯此店鋪' });
    }

    const update = { ...req.body };
    if (!req.tenantAccess?.isPlatformAdmin) {
      delete update.allianceEnabled;
      delete update.subscriptionPlan;
      delete update.adminDomain;
      delete update.consumerDomain;
      delete update.openApiKey;
      delete update.openApiEnabled;
    }
    if (update.slug) update.slug = String(update.slug).trim().toLowerCase();
    if (update.adminDomain !== undefined) {
      update.adminDomain = update.adminDomain ? normalizeDomain(update.adminDomain) : null;
    }
    if (update.consumerDomain !== undefined) {
      update.consumerDomain = update.consumerDomain ? normalizeDomain(update.consumerDomain) : null;
    }
    if (update.district !== undefined) {
      if (!isValidDistrict(update.district)) {
        return res.status(400).json({ message: '請選擇有效的香港區域' });
      }
      update.district = update.district || null;
    }
    if (update.allianceEnabled === true || (update.allianceEnabled === undefined && existing.allianceEnabled)) {
      const merged = { ...existing.toObject(), ...update };
      if (merged.allianceEnabled && !merged.district) {
        return res.status(400).json({ message: '加盟店鋪必須設定地區（香港 18 區）' });
      }
    }
    if (update.allianceEnabled === false && existing.allianceEnabled) {
      const hasDomains = update.adminDomain || update.consumerDomain || existing.adminDomain || existing.consumerDomain;
      if (hasDomains) {
        return res.status(400).json({
          message: '已設定 SaaS 域名的加盟店鋪不可直接退出聯盟，請先清除域名設定',
        });
      }
    }
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

// @route   POST /api/stores/:id/upload-logo
// @desc    上傳店鋪 Logo
// @access  Private (Admin)
router.post('/:id/upload-logo', [
  auth,
  adminAuth,
  storeLogoUpload.single('logo'),
  processStoreLogo,
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '請選擇要上傳的 Logo 圖片' });
    }

    const store = await Store.findById(req.params.id);
    if (!store) {
      await deleteFile(req.file.path);
      return res.status(404).json({ message: '店鋪不存在' });
    }
    if (!canAccessStore(req.tenantAccess, store._id)) {
      await deleteFile(req.file.path);
      return res.status(403).json({ message: '無權限編輯此店鋪' });
    }

    const oldLogoUrl = store.branding?.logoUrl || '';
    const logoUrl = `/uploads/stores/${req.file.filename}`;

    if (!store.branding) store.branding = {};
    store.branding.logoUrl = logoUrl;
    await store.save();

    if (oldLogoUrl.startsWith('/uploads/stores/')) {
      const oldPath = path.join(__dirname, '../..', oldLogoUrl);
      await deleteFile(oldPath);
    }

    res.json({
      message: 'Logo 上傳成功',
      logoUrl,
      store,
    });
  } catch (error) {
    console.error('上傳店鋪 Logo 錯誤:', error);
    if (req.file) {
      await deleteFile(req.file.path);
    }
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stores/by-slug/:slug
// @desc    以 slug 取得上線店鋪
// @access  Public
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const store = await Store.findOne({ slug, isActive: true })
      .select('name slug address phone district allianceEnabled branding operatingHours sortOrder enableHikAccess');
    if (!store) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    res.json({ store });
  } catch (error) {
    console.error('獲取店鋪錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/stores/:id
// @desc    單一店鋪
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store || !store.isActive) {
      return res.status(404).json({ message: '店鋪不存在' });
    }
    res.json({ store });
  } catch (error) {
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
