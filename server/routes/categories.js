const express = require('express');
const { body, validationResult } = require('express-validator');
const Category = require('../models/Category');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/categories
// @desc    獲取所有分類（公開）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 });
    
    res.json(categories);
  } catch (error) {
    console.error('獲取分類列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/categories/:id
// @desc    獲取單個分類
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: '分類不存在' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('獲取分類錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/categories
// @desc    創建分類（僅管理員）
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().notEmpty().withMessage('分類名稱為必填項目'),
  body('description').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須是非負整數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const category = new Category(req.body);
    await category.save();

    res.status(201).json({
      message: '分類創建成功',
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: '分類名稱已存在' });
    }
    console.error('創建分類錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/categories/:id
// @desc    更新分類（僅管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().notEmpty().withMessage('分類名稱不能為空'),
  body('description').optional().trim(),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須是非負整數'),
  body('isActive').optional().isBoolean().withMessage('狀態必須是布林值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: '分類不存在' });
    }

    res.json({
      message: '分類更新成功',
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: '分類名稱已存在' });
    }
    console.error('更新分類錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/categories/:id
// @desc    刪除分類（僅管理員）
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: '分類不存在' });
    }

    // 檢查是否有產品使用此分類
    const Product = require('../models/Product');
    const productCount = await Product.countDocuments({ category: req.params.id });
    
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `無法刪除分類，仍有 ${productCount} 個產品使用此分類` 
      });
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ message: '分類刪除成功' });
  } catch (error) {
    console.error('刪除分類錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;






