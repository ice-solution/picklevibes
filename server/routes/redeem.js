const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');
const RedeemBatchJob = require('../models/RedeemBatchJob');
const { consumeRedeemCodeOnce } = require('../services/redeemUsageService');
const {
  normalizeTemplate,
  scheduleRedeemBatchJob,
  SYNC_MAX_QUANTITY,
  BULK_MIN_QUANTITY,
  BULK_MAX_QUANTITY,
} = require('../services/redeemBatchGenerator');
const { auth, adminAuth } = require('../middleware/auth');
const {
  applyStoreScope,
  checkDocumentStoreAccess,
  resolveStoreForCreate,
} = require('../utils/tenantAccess');

const { assertRedeemCodePricingSlotAllowed } = require('../utils/redeemBookingContext');
const { normalizeApplicablePricingSlots } = require('../utils/redeemPricingSlots');

const router = express.Router();
const COMMISSION_RATE_VALUES = ['0', '5', '10', 0, 5, 10];

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchQ(qRaw) {
  if (qRaw == null) return null;
  const q = String(qRaw).trim();
  if (!q) return null;
  // 避免過長 regex 造成效能問題
  return q.slice(0, 64);
}

function sanitizeRedeemPayload(body) {
  const data = { ...body };
  if (Array.isArray(data.applicablePricingSlots)) {
    data.applicablePricingSlots = normalizeApplicablePricingSlots(data.applicablePricingSlots);
  }
  return data;
}

function denyStoreAccess(res, check) {
  return res.status(check.status).json({ message: check.message });
}

async function assertRedeemCodeAccess(req, redeemCode) {
  if (!redeemCode) {
    return { ok: false, status: 404, message: '兌換碼不存在' };
  }
  return checkDocumentStoreAccess(req.tenantAccess, redeemCode.store);
}

async function assertRedeemBatchAccess(req, batchId) {
  const sample = await RedeemCode.findOne({ batchId }).select('store').lean();
  if (!sample) {
    return { ok: false, status: 404, message: '找不到此批次' };
  }
  return checkDocumentStoreAccess(req.tenantAccess, sample.store);
}

function scopeRedeemQuery(query, tenantAccess) {
  return applyStoreScope(query, tenantAccess, 'store');
}

// 獨立兌換碼：6 位（字母+數字混合），至少包含一個字母與一個數字
const REDEEM_CODE_RANDOM_REGEX = /^[A-Z0-9]{6}$/;
function generateIndependentRedeemCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 避免容易混淆的 I/O
  const digits = '0123456789';

  // 6 位字元，從字母/數字池隨機取；後續會檢查是否至少含一個字母與一個數字
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const pickLetter = Math.random() < 0.5;
    code += pickLetter
      ? letters[Math.floor(Math.random() * letters.length)]
      : digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

async function generateUniqueIndependentRedeemCode(maxTries = 10) {
  for (let i = 0; i < maxTries; i += 1) {
    const code = generateIndependentRedeemCode();
    if (!REDEEM_CODE_RANDOM_REGEX.test(code)) continue;
    const hasLetter = /[A-Z]/.test(code);
    const hasDigit = /\d/.test(code);
    if (!hasLetter || !hasDigit) continue;
    // 確保 code 全域唯一
    // eslint-disable-next-line no-await-in-loop
    const exists = await RedeemCode.findOne({ code }).select('_id').lean();
    if (!exists) return code;
  }
  throw new Error('無法產生唯一兌換碼（請稍後再試）');
}

// @route   POST /api/redeem/validate
// @desc    驗證兌換碼
// @access  Private
router.post('/validate', [
  auth,
  body('code').trim().notEmpty().withMessage('兌換碼不能為空'),
  body('amount').isFloat({ min: 0 }).withMessage('金額必須大於等於0'),
  body('orderType').isIn(['booking', 'recharge', 'activity', 'product', 'eshop']).withMessage('訂單類型必須是 booking、recharge、activity、product 或 eshop'),
  body('restrictedCode').optional().trim(),
  body('courtId').optional().isMongoId().withMessage('請提供有效的場地ID'),
  body('date').optional().isISO8601().withMessage('請提供有效的日期'),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的開始時間'),
  body('pricingSlotName').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { code, amount, orderType, courtId, date, startTime, pricingSlotName } = req.body;

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

    // 使用限制僅以「適用範圍」(applicableTypes) 為準；restrictedCode 已不再使用，避免與適用範圍重複
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

    await assertRedeemCodePricingSlotAllowed(redeemCode, {
      orderType,
      courtId,
      date,
      startTime,
      pricingSlotName,
    });

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
    const status = error?.statusCode || 500;
    res.status(status).json({
      message: status === 500 ? '服務器錯誤，請稍後再試' : error.message,
    });
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

    const { usage } = await consumeRedeemCodeOnce({
      redeemCodeId,
      userId: req.user.id,
      orderType,
      orderId,
      originalAmount,
      discountAmount,
      finalAmount,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      message: '兌換碼使用成功',
      usage: {
        id: usage?._id || null,
        discountAmount,
        finalAmount
      }
    });

  } catch (error) {
    console.error('使用兌換碼錯誤:', error);
    const status = error?.statusCode || 500;
    res.status(status).json({ message: status === 500 ? '服務器錯誤，請稍後再試' : (error?.message || '兌換碼使用失敗') });
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
  body('isIndependentCode').optional().isBoolean().withMessage('isIndependentCode必須是布林值'),
  body('commissionRate').optional().isIn(COMMISSION_RATE_VALUES).withMessage('佣金比例只能選擇 0、5 或 10'),
  body('quantity').optional().isInt({ min: 1, max: SYNC_MAX_QUANTITY }).withMessage(`生成數量必須是 1-${SYNC_MAX_QUANTITY}（超過請使用背景批次）`),
  body('code').optional().trim().notEmpty().withMessage('兌換碼不能為空'),
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
  body('userUsageLimit').optional().isInt({ min: 1 }).withMessage('每用戶使用次數限制必須是正整數'),
  body('validUntil').isISO8601().withMessage('請提供有效的到期日期'),
  body('applicableTypes').optional().isArray().withMessage('適用類型必須是數組'),
  body('applicablePricingSlots').optional().isArray().withMessage('適用時段必須是數組'),
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

    const isIndependentCode = !!req.body.isIndependentCode;
    const commissionRate =
      req.body.commissionRate === '' || req.body.commissionRate == null
        ? null
        : Number(req.body.commissionRate);

    const quantity =
      req.body.quantity != null && String(req.body.quantity).trim() !== ''
        ? Math.max(1, Math.min(parseInt(req.body.quantity, 10) || 1, SYNC_MAX_QUANTITY))
        : 1;

    if (isIndependentCode && quantity > SYNC_MAX_QUANTITY) {
      return res.status(400).json({
        message: `一次同步最多建立 ${SYNC_MAX_QUANTITY} 個；請使用 POST /api/redeem/admin/batch-jobs 建立更多兌換碼`,
      });
    }

    const storeResult = resolveStoreForCreate(req.tenantAccess, req.body.store);
    if (!storeResult.ok) {
      return res.status(storeResult.status).json({ message: storeResult.message });
    }

    // 獨立兌換碼：一次生成 N 個唯一碼
    if (isIndependentCode) {
      const batchId = new mongoose.Types.ObjectId();
      const createdCodes = [];
      for (let i = 0; i < quantity; i += 1) {
        const generatedCode = await generateUniqueIndependentRedeemCode();

        const redeemCodeData = sanitizeRedeemPayload({
          ...req.body,
          code: generatedCode,
          batchId,
          isIndependentCode,
          commissionRate,
          store: storeResult.storeId,
          // 獨立兌換碼：強制每個碼只用一次（全域）與每用戶一次
          usageLimit: 1,
          userUsageLimit: 1,
          createdBy: req.user.id,
          validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date(),
        });

        const redeemCode = new RedeemCode(redeemCodeData);
        await redeemCode.save();
        createdCodes.push(redeemCode);
      }

      return res.status(201).json({
        message: '兌換碼批次創建成功',
        redeemCodes: createdCodes,
      });
    }

    // 非獨立兌換碼：沿用單碼建立邏輯
    const finalCode = req.body.code ? String(req.body.code).trim().toUpperCase() : null;
    if (!finalCode) {
      return res.status(400).json({ message: '兌換碼不能為空' });
    }

    const redeemCodeData = sanitizeRedeemPayload({
      ...req.body,
      code: finalCode,
      isIndependentCode,
      commissionRate,
      store: storeResult.storeId,
      usageLimit: req.body.usageLimit,
      userUsageLimit: req.body.userUsageLimit,
      createdBy: req.user.id,
      validFrom: req.body.validFrom ? new Date(req.body.validFrom) : new Date(),
    });

    const redeemCode = new RedeemCode(redeemCodeData);
    await redeemCode.save();

    return res.status(201).json({
      message: '兌換碼創建成功',
      redeemCode,
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
    const { page = 1, limit = 10, status, batchId, q: qRaw, store } = req.query;
    
    let query = {};
    if (status === 'active') {
      query.isActive = true;
      query.validFrom = { $lte: new Date() };
      query.validUntil = { $gte: new Date() };
    } else if (status === 'expired') {
      query.validUntil = { $lt: new Date() };
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    if (store && String(store).trim() !== '') {
      query.store = String(store).trim();
    }

    if (batchId && String(batchId).trim() !== '') {
      query.batchId = String(batchId).trim();
    } else if (req.query.standaloneOnly === 'true') {
      // 非群組列表：只顯示不屬於任何批次的兌換碼
      query.batchId = null;
    }

    const q = normalizeSearchQ(qRaw);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      query.$or = [
        { code: re },
        { name: re },
        { description: re },
      ];
    }

    query = scopeRedeemQuery(query, req.tenantAccess);
    
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

const redeemTemplateValidators = [
  body('name').trim().notEmpty().withMessage('兌換碼名稱不能為空'),
  body('type').isIn(['fixed', 'percentage']).withMessage('類型必須是 fixed 或 percentage'),
  body('value').isFloat({ min: 0 }).withMessage('折扣值必須大於等於0'),
  body('minAmount').optional().isFloat({ min: 0 }).withMessage('最低消費金額不能為負數'),
  body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('最大折扣金額不能為負數'),
  body('commissionRate').optional().isIn(COMMISSION_RATE_VALUES).withMessage('佣金比例只能選擇 0、5 或 10'),
  body('validUntil').isISO8601().withMessage('請提供有效的到期日期'),
  body('applicableTypes').optional().isArray().withMessage('適用類型必須是數組'),
  body('applicablePricingSlots').optional().isArray().withMessage('適用時段必須是數組'),
  body('restrictedCode').optional().trim(),
];

// @route   POST /api/redeem/admin/batch-jobs
// @desc    背景批次建立獨立兌換碼（>100 張，最多 10000）
// @access  Private (Admin)
router.post('/admin/batch-jobs', [
  auth,
  adminAuth,
  body('isIndependentCode').custom((v) => v === true || v === 'true').withMessage('背景批次僅支援獨立兌換碼'),
  body('quantity').isInt({ min: BULK_MIN_QUANTITY, max: BULK_MAX_QUANTITY })
    .withMessage(`背景批次數量必須是 ${BULK_MIN_QUANTITY}-${BULK_MAX_QUANTITY}`),
  ...redeemTemplateValidators,
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array(),
      });
    }

    const quantity = parseInt(req.body.quantity, 10);
    const batchId = new mongoose.Types.ObjectId();

    const storeResult = resolveStoreForCreate(req.tenantAccess, req.body.store);
    if (!storeResult.ok) {
      return res.status(storeResult.status).json({ message: storeResult.message });
    }

    const template = normalizeTemplate(
      { ...req.body, store: storeResult.storeId },
      req.user.id
    );

    const job = await RedeemBatchJob.create({
      batchId,
      quantity,
      template,
      createdBy: req.user.id,
      status: 'pending',
    });

    scheduleRedeemBatchJob(job._id);

    return res.status(202).json({
      message: '兌換碼批次建立任務已提交，將於後台處理',
      jobId: job._id,
      batchId,
      quantity,
      status: 'pending',
    });
  } catch (error) {
    console.error('提交兌換碼批次任務錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/batch-jobs/:jobId
// @desc    查詢背景批次任務狀態
// @access  Private (Admin)
router.get('/admin/batch-jobs/:jobId', [auth, adminAuth], async (req, res) => {
  try {
    const job = await RedeemBatchJob.findById(req.params.jobId)
      .select('-template')
      .lean();
    if (!job) {
      return res.status(404).json({ message: '找不到此任務' });
    }
    res.json({ job });
  } catch (error) {
    console.error('查詢兌換碼批次任務錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/batch/:batchId/export
// @desc    匯出批次兌換碼為 XLSX
// @access  Private (Admin)
router.get('/admin/batch/:batchId/export', [auth, adminAuth], async (req, res) => {
  try {
    const { batchId } = req.params;
    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ message: '無效的 batchId' });
    }

    const sample = await RedeemCode.findOne({ batchId }).select('name store').lean();
    if (!sample) {
      return res.status(404).json({ message: '找不到此批次' });
    }

    const exportAccess = checkDocumentStoreAccess(req.tenantAccess, sample.store);
    if (!exportAccess.ok) {
      return denyStoreAccess(res, exportAccess);
    }

    const codes = await RedeemCode.find({ batchId })
      .select('code name isActive totalUsed usageLimit validUntil createdAt')
      .sort({ code: 1 })
      .lean();

    const rows = codes.map((row) => ({
      兌換碼: row.code,
      名稱: row.name,
      狀態: row.isActive ? '啟用' : '禁用',
      已使用次數: row.totalUsed ?? 0,
      使用上限: row.usageLimit ?? 1,
      有效期至: row.validUntil ? new Date(row.validUntil).toISOString().slice(0, 10) : '',
      建立時間: row.createdAt ? new Date(row.createdAt).toISOString() : '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '兌換碼');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeName = String(sample.name || 'batch').replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40);
    const filename = `redeem-${safeName}-${String(batchId).slice(-6)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(buffer);
  } catch (error) {
    console.error('匯出批次兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/redeem/admin/groups
// @desc    以 batchId 群組顯示（僅管理員）
// @access  Private (Admin)
router.get('/admin/groups', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 10, status, q: qRaw } = req.query;

    const now = new Date();
    let match = { batchId: { $ne: null } };
    if (status === 'active') {
      match.isActive = true;
      match.validFrom = { $lte: now };
      match.validUntil = { $gte: now };
    } else if (status === 'expired') {
      match.validUntil = { $lt: now };
    } else if (status === 'inactive') {
      match.isActive = false;
    }

    if (req.query.store && String(req.query.store).trim() !== '') {
      match.store = String(req.query.store).trim();
    }

    const q = normalizeSearchQ(qRaw);
    if (q) {
      const re = new RegExp(escapeRegex(q), 'i');
      // 群組列表先以 name/description/code 先過濾（效率較好）
      match.$or = [
        { name: re },
        { description: re },
        { code: re },
      ];
    }

    match = scopeRedeemQuery(match, req.tenantAccess);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [groups, total] = await Promise.all([
      RedeemCode.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$batchId',
            name: { $first: '$name' },
            description: { $first: '$description' },
            type: { $first: '$type' },
            value: { $first: '$value' },
            minAmount: { $first: '$minAmount' },
            maxDiscount: { $first: '$maxDiscount' },
            usageLimit: { $first: '$usageLimit' },
            userUsageLimit: { $first: '$userUsageLimit' },
            isIndependentCode: { $first: '$isIndependentCode' },
            commissionRate: { $first: '$commissionRate' },
            validFrom: { $first: '$validFrom' },
            validUntil: { $first: '$validUntil' },
            isActive: { $first: '$isActive' },
            applicableTypes: { $first: '$applicableTypes' },
            applicablePricingSlots: { $first: '$applicablePricingSlots' },
            createdAt: { $first: '$createdAt' },
            totalCodes: { $sum: 1 },
            totalUsed: { $sum: '$totalUsed' },
            totalDiscount: { $sum: '$totalDiscount' },
          }
        },
        { $skip: skip },
        { $limit: limitNum },
      ]),
      RedeemCode.aggregate([
        { $match: match },
        { $group: { _id: '$batchId' } },
        { $count: 'count' }
      ]).then((rows) => rows?.[0]?.count || 0),
    ]);

    res.json({
      groups,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total,
      }
    });
  } catch (error) {
    console.error('獲取兌換碼群組列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/redeem/admin/batch/:batchId
// @desc    批次更新同一 batchId 的兌換碼（僅管理員）
// @access  Private (Admin)
router.put('/admin/batch/:batchId', [
  auth,
  adminAuth,
  body('name').optional().trim().notEmpty().withMessage('兌換碼名稱不能為空'),
  body('description').optional().trim(),
  body('type').optional().isIn(['fixed', 'percentage']).withMessage('類型必須是 fixed 或 percentage'),
  body('value').optional().isFloat({ min: 0 }).withMessage('折扣值必須大於等於0'),
  body('minAmount').optional().isFloat({ min: 0 }).withMessage('最低消費金額不能為負數'),
  body('maxDiscount').optional().isFloat({ min: 0 }).withMessage('最大折扣金額不能為負數'),
  body('commissionRate').optional().isIn(COMMISSION_RATE_VALUES).withMessage('佣金比例只能選擇 0、5 或 10'),
  body('validFrom').optional().isISO8601().withMessage('請提供有效的開始日期'),
  body('validUntil').optional().isISO8601().withMessage('請提供有效的到期日期'),
  body('isActive').optional().isBoolean().withMessage('狀態必須是布林值'),
  body('applicableTypes').optional().isArray().withMessage('適用類型必須是數組'),
  body('applicablePricingSlots').optional().isArray().withMessage('適用時段必須是數組'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { batchId } = req.params;
    if (!batchId || String(batchId).trim() === '') {
      return res.status(400).json({ message: 'batchId 不能為空' });
    }

    // 先找一筆確認 batch 存在
    const sample = await RedeemCode.findOne({ batchId }).select('_id isIndependentCode store').lean();
    if (!sample) {
      return res.status(404).json({ message: '找不到此批次' });
    }

    const batchAccess = checkDocumentStoreAccess(req.tenantAccess, sample.store);
    if (!batchAccess.ok) {
      return denyStoreAccess(res, batchAccess);
    }

    const update = sanitizeRedeemPayload({ ...req.body });

    // 正規化 commissionRate
    if (update.commissionRate === '' || update.commissionRate == null) {
      update.commissionRate = null;
    } else if (update.commissionRate != null) {
      update.commissionRate = Number(update.commissionRate);
    }

    // 正規化日期
    if (update.validFrom) update.validFrom = new Date(update.validFrom);
    if (update.validUntil) update.validUntil = new Date(update.validUntil);

    // 避免批次修改破壞「獨立兌換碼」一次性限制
    if (sample.isIndependentCode === true) {
      update.usageLimit = 1;
      update.userUsageLimit = 1;
      update.isIndependentCode = true;
    } else {
      // 不允許透過 batch endpoint 切換獨立/非獨立
      delete update.isIndependentCode;
      delete update.usageLimit;
      delete update.userUsageLimit;
    }

    // 不允許批次改 code / batchId / 統計欄位
    delete update.code;
    delete update.batchId;
    delete update.totalUsed;
    delete update.totalDiscount;
    delete update.createdBy;

    update.updatedAt = new Date();

    const result = await RedeemCode.updateMany(
      scopeRedeemQuery({ batchId }, req.tenantAccess),
      { $set: update },
      { runValidators: true }
    );

    res.json({
      message: '批次更新成功',
      matched: result.matchedCount ?? result.n ?? 0,
      modified: result.modifiedCount ?? result.nModified ?? 0
    });
  } catch (error) {
    console.error('批次更新兌換碼錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/redeem/admin/:id
// @desc    更新兌換碼 (僅管理員)
// @access  Private (Admin)
router.put('/admin/:id', [
  auth,
  adminAuth,
  body('isIndependentCode').optional().isBoolean().withMessage('isIndependentCode必須是布林值'),
  body('commissionRate').optional().isIn(COMMISSION_RATE_VALUES).withMessage('佣金比例只能選擇 0、5 或 10'),
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
  body('applicablePricingSlots').optional().isArray().withMessage('適用時段必須是數組'),
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

    const update = sanitizeRedeemPayload({ ...req.body });
    if (update.code) update.code = String(update.code).trim().toUpperCase();
    if (update.commissionRate === '' || update.commissionRate == null) {
      update.commissionRate = null;
    } else if (update.commissionRate != null) {
      update.commissionRate = Number(update.commissionRate);
    }

    // 独立兌换码：強制使用次數限制
    if (update.isIndependentCode === true) {
      update.usageLimit = 1;
      update.userUsageLimit = 1;
      // 若更新時未提供 code（前端也可能因勾選而不送），則改由系統生成獨立兌換碼
      if (!update.code) {
        update.code = await generateUniqueIndependentRedeemCode();
      }
    }

    const existing = await RedeemCode.findById(req.params.id).select('store').lean();
    if (!existing) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }

    const codeAccess = checkDocumentStoreAccess(req.tenantAccess, existing.store);
    if (!codeAccess.ok) {
      return denyStoreAccess(res, codeAccess);
    }

    const redeemCode = await RedeemCode.findByIdAndUpdate(
      req.params.id,
      update,
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

    const existing = await RedeemCode.findById(req.params.id).select('store').lean();
    if (!existing) {
      return res.status(404).json({ message: '兌換碼不存在' });
    }

    const statusAccess = checkDocumentStoreAccess(req.tenantAccess, existing.store);
    if (!statusAccess.ok) {
      return denyStoreAccess(res, statusAccess);
    }

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
    const baseQuery = scopeRedeemQuery({}, req.tenantAccess);
    
    // 總兌換碼數量
    const totalCodes = await RedeemCode.countDocuments(baseQuery);
    
    // 有效兌換碼數量
    const activeCodes = await RedeemCode.countDocuments({
      ...baseQuery,
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now }
    });
    
    // 總使用次數
    const totalUsageResult = await RedeemCode.aggregate([
      { $match: baseQuery },
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
      { $match: baseQuery },
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

    const usageAccess = checkDocumentStoreAccess(req.tenantAccess, redeemCode.store);
    if (!usageAccess.ok) {
      return denyStoreAccess(res, usageAccess);
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
