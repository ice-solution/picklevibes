const express = require('express');
const { body, validationResult } = require('express-validator');
const Vlog = require('../models/Vlog');
const { auth, adminAuth } = require('../middleware/auth');
const { vlogUpload, processVlogImage, deleteFile } = require('../middleware/upload');

const router = express.Router();

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route   GET /api/vlogs/:id
// @desc    前台讀取 vlog（只回 published）
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const vlog = await Vlog.findById(req.params.id).lean();
    if (!vlog) return res.status(404).json({ message: 'Vlog 不存在' });

    if (!vlog.isPublished) return res.status(404).json({ message: 'Vlog 不存在' });

    res.json({ data: { vlog } });
  } catch (error) {
    console.error('讀取 vlog 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/vlogs/:id/preview
// @desc    管理員預覽未發布 vlog
// @access  Private(Admin)
router.get('/:id/preview', [auth, adminAuth], async (req, res) => {
  try {
    const vlog = await Vlog.findById(req.params.id).lean();
    if (!vlog) return res.status(404).json({ message: 'Vlog 不存在' });
    res.json({ data: { vlog } });
  } catch (error) {
    console.error('預覽 vlog 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/vlogs
// @desc    管理員列表（支援 q 搜尋）
// @access  Private(Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 20));

    const query = {};
    const s = String(q || '').trim();
    if (s) {
      const safe = escapeRegex(s);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { tags: { $regex: safe, $options: 'i' } },
        { 'seo.title': { $regex: safe, $options: 'i' } }
      ];
    }

    const total = await Vlog.countDocuments(query);
    const vlogs = await Vlog.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json({
      data: {
        vlogs,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total
        }
      }
    });
  } catch (error) {
    console.error('管理員讀取 vlogs 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/vlogs
// @desc    建立 vlog
// @access  Private(Admin)
router.post('/', [
  auth,
  adminAuth,
  body('title').trim().isLength({ min: 1, max: 120 }).withMessage('標題必須為 1-120 字'),
  body('tags').optional().isArray().withMessage('tags 必須為陣列'),
  body('tags.*').optional().isString().withMessage('tag 必須為文字'),
  body('seo').optional().isObject().withMessage('seo 必須為 object'),
  body('seo.title').optional().isString(),
  body('seo.description').optional().isString(),
  body('seo.keywords').optional().isString(),
  body('heroBannerUrl').optional().isString(),
  body('contentHtml').optional().isString(),
  body('isPublished').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const vlog = await Vlog.create({
      title: req.body.title,
      tags: req.body.tags || [],
      seo: req.body.seo || {},
      heroBannerUrl: req.body.heroBannerUrl || '',
      contentHtml: req.body.contentHtml || '',
      isPublished: !!req.body.isPublished,
      publishedAt: req.body.isPublished ? new Date() : null
    });

    res.status(201).json({ message: 'Vlog 已建立', data: { vlog } });
  } catch (error) {
    console.error('建立 vlog 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/vlogs/:id
// @desc    更新 vlog
// @access  Private(Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('title').optional().trim().isLength({ min: 1, max: 120 }).withMessage('標題必須為 1-120 字'),
  body('tags').optional().isArray().withMessage('tags 必須為陣列'),
  body('tags.*').optional().isString().withMessage('tag 必須為文字'),
  body('seo').optional().isObject().withMessage('seo 必須為 object'),
  body('seo.title').optional().isString(),
  body('seo.description').optional().isString(),
  body('seo.keywords').optional().isString(),
  body('heroBannerUrl').optional().isString(),
  body('contentHtml').optional().isString(),
  body('isPublished').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    const existing = await Vlog.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Vlog 不存在' });

    const nextPublished = req.body.isPublished !== undefined ? !!req.body.isPublished : existing.isPublished;

    if (req.body.title !== undefined) existing.title = req.body.title;
    if (req.body.tags !== undefined) existing.tags = req.body.tags;
    if (req.body.seo !== undefined) existing.seo = { ...existing.seo, ...req.body.seo };
    if (req.body.heroBannerUrl !== undefined) existing.heroBannerUrl = req.body.heroBannerUrl;
    if (req.body.contentHtml !== undefined) existing.contentHtml = req.body.contentHtml;

    if (existing.isPublished !== nextPublished) {
      existing.isPublished = nextPublished;
      existing.publishedAt = nextPublished ? new Date() : null;
    }

    await existing.save();
    res.json({ message: 'Vlog 已更新', data: { vlog: existing.toObject() } });
  } catch (error) {
    console.error('更新 vlog 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/vlogs/:id
// @desc    刪除 vlog
// @access  Private(Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const vlog = await Vlog.findByIdAndDelete(req.params.id);
    if (!vlog) return res.status(404).json({ message: 'Vlog 不存在' });

    // 盡力刪除 hero banner 檔案（若是本地 uploads）
    if (vlog.heroBannerUrl && vlog.heroBannerUrl.startsWith('/uploads/')) {
      const filePath = `uploads/${vlog.heroBannerUrl.replace('/uploads/', '')}`;
      await deleteFile(filePath);
    }

    res.json({ message: 'Vlog 已刪除' });
  } catch (error) {
    console.error('刪除 vlog 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/vlogs/upload-image
// @desc    上傳 vlog 圖片（editor / hero banner 共用）
// @access  Private(Admin)
router.post('/upload-image', [auth, adminAuth, vlogUpload.single('image'), processVlogImage], async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '請提供圖片檔案' });
    const url = `/uploads/vlogs/${req.file.filename}`;
    res.json({ data: { url } });
  } catch (error) {
    console.error('上傳 vlog 圖片錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;

