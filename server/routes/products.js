const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { auth, adminAuth } = require('../middleware/auth');
const { createUploadConfig, processImage, deleteFile } = require('../middleware/upload');
const path = require('path');

const router = express.Router();

// 產品圖片上傳配置
const productUpload = createUploadConfig('products', 'product');
const processProductImage = processImage(1200, 1200);

// @route   GET /api/products
// @desc    獲取所有產品列表（公開）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, page = 1, limit = 20, search } = req.query;
    
    const query = { isActive: true };
    
    if (category) {
      query.category = category;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const products = await Product.find(query)
      .populate('category', 'name')
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(query);
    
    res.json({
      products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取產品列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/products/:id
// @desc    獲取單個產品詳情
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name description');
    
    if (!product) {
      return res.status(404).json({ message: '產品不存在' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('獲取產品錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/products
// @desc    創建產品（僅管理員）
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  productUpload.array('images', 5),
  processProductImage,
  body('name').trim().notEmpty().withMessage('產品名稱為必填項目'),
  body('description').optional().trim(),
  body('details').optional().trim(),
  body('category').isMongoId().withMessage('請提供有效的分類ID'),
  body('price').isFloat({ min: 0 }).withMessage('價格必須大於等於0'),
  body('discountPrice').optional().isFloat({ min: 0 }).withMessage('折扣價格必須大於等於0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('庫存必須是非負整數'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須是非負整數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 刪除已上傳的圖片
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          deleteFile(file.path);
        });
      }
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    // 檢查分類是否存在
    const category = await Category.findById(req.body.category);
    if (!category) {
      // 刪除已上傳的圖片
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          deleteFile(file.path);
        });
      }
      return res.status(404).json({ message: '分類不存在' });
    }

    // 處理圖片路徑
    const images = req.files ? req.files.map(file => {
      // 返回相對於 uploads 目錄的路徑
      const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
      return relativePath.replace(/\\/g, '/'); // 統一使用正斜杠
    }) : [];

    if (images.length === 0) {
      return res.status(400).json({ message: '至少需要上傳一張圖片' });
    }

    // 驗證折扣價格
    if (req.body.discountPrice && parseFloat(req.body.discountPrice) >= parseFloat(req.body.price)) {
      // 刪除已上傳的圖片
      images.forEach(imagePath => {
        const fullPath = path.join(__dirname, '../../uploads', imagePath);
        deleteFile(fullPath);
      });
      return res.status(400).json({ message: '折扣價格必須小於原價' });
    }

    const productData = {
      ...req.body,
      images,
      price: parseFloat(req.body.price),
      discountPrice: req.body.discountPrice ? parseFloat(req.body.discountPrice) : null,
      stock: req.body.stock ? parseInt(req.body.stock) : 0,
      sortOrder: req.body.sortOrder ? parseInt(req.body.sortOrder) : 0
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: '產品創建成功',
      product
    });
  } catch (error) {
    // 刪除已上傳的圖片
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        deleteFile(file.path);
      });
    }
    console.error('創建產品錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/products/:id
// @desc    更新產品（僅管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  productUpload.array('images', 5),
  processProductImage,
  body('name').optional().trim().notEmpty().withMessage('產品名稱不能為空'),
  body('description').optional().trim(),
  body('details').optional().trim(),
  body('category').optional().isMongoId().withMessage('請提供有效的分類ID'),
  body('price').optional().isFloat({ min: 0 }).withMessage('價格必須大於等於0'),
  body('discountPrice').optional().isFloat({ min: 0 }).withMessage('折扣價格必須大於等於0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('庫存必須是非負整數'),
  body('sortOrder').optional().isInt({ min: 0 }).withMessage('排序必須是非負整數'),
  body('isActive').optional().isBoolean().withMessage('狀態必須是布林值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 刪除已上傳的圖片
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          deleteFile(file.path);
        });
      }
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      // 刪除已上傳的圖片
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          deleteFile(file.path);
        });
      }
      return res.status(404).json({ message: '產品不存在' });
    }

    // 如果更新分類，檢查分類是否存在
    if (req.body.category) {
      const category = await Category.findById(req.body.category);
      if (!category) {
        // 刪除已上傳的圖片
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            deleteFile(file.path);
          });
        }
        return res.status(404).json({ message: '分類不存在' });
      }
    }

    // 處理新上傳的圖片
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => {
        const relativePath = path.relative(path.join(__dirname, '../../uploads'), file.path);
        return relativePath.replace(/\\/g, '/');
      });

      // 如果提供了新圖片，替換舊圖片
      if (req.body.replaceImages === 'true') {
        // 刪除舊圖片
        product.images.forEach(imagePath => {
          const fullPath = path.join(__dirname, '../../uploads', imagePath);
          deleteFile(fullPath);
        });
        req.body.images = newImages;
      } else {
        // 追加新圖片
        req.body.images = [...product.images, ...newImages];
      }
    }

    // 驗證折扣價格
    const price = req.body.price ? parseFloat(req.body.price) : product.price;
    if (req.body.discountPrice) {
      const discountPrice = parseFloat(req.body.discountPrice);
      if (discountPrice >= price) {
        // 刪除已上傳的圖片
        if (req.files && req.files.length > 0) {
          req.files.forEach(file => {
            deleteFile(file.path);
          });
        }
        return res.status(400).json({ message: '折扣價格必須小於原價' });
      }
    }

    // 更新產品
    const updateData = { ...req.body };
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.discountPrice !== undefined) {
      updateData.discountPrice = updateData.discountPrice ? parseFloat(updateData.discountPrice) : null;
    }
    if (updateData.stock !== undefined) updateData.stock = parseInt(updateData.stock);
    if (updateData.sortOrder !== undefined) updateData.sortOrder = parseInt(updateData.sortOrder);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: '產品更新成功',
      product: updatedProduct
    });
  } catch (error) {
    // 刪除已上傳的圖片
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        deleteFile(file.path);
      });
    }
    console.error('更新產品錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/products/:id
// @desc    刪除產品（僅管理員）
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: '產品不存在' });
    }

    // 刪除產品圖片
    product.images.forEach(imagePath => {
      const fullPath = path.join(__dirname, '../../uploads', imagePath);
      deleteFile(fullPath);
    });

    await Product.findByIdAndDelete(req.params.id);

    res.json({ message: '產品刪除成功' });
  } catch (error) {
    console.error('刪除產品錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;






