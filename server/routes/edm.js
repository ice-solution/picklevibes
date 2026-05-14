const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { body, validationResult, query } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');
const EdmCampaign = require('../models/EdmCampaign');
const EdmSendLog = require('../models/EdmSendLog');
const EdmTemplate = require('../models/EdmTemplate');
const EdmMailingList = require('../models/EdmMailingList');
const { plainTextToEmailHtml } = require('../utils/edmTemplate');
const {
  resolveEdmRecipientEmails,
  previewRoleRecipients,
  ALLOWED_ROLES,
  MAX_MANUAL_SAVED_LIST,
  MAX_USER_IDS
} = require('../utils/edmRecipients');
const { mergeEdmContentFromTemplate, mailingListToResolveBody } = require('../utils/edmFromResources');

const router = express.Router();

const edmSendLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { message: 'EDM 發送過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false
});

function normalizeMailingListInput(body) {
  const listMode = String(body.listMode || '').trim();
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim().slice(0, 500);
  if (!name) {
    const e = new Error('請輸入列表名稱');
    e.status = 400;
    throw e;
  }
  if (!['manual', 'userIds', 'roles'].includes(listMode)) {
    const e = new Error('listMode 須為 manual、userIds 或 roles');
    e.status = 400;
    throw e;
  }
  const out = { name, description, listMode };
  if (listMode === 'manual') {
    const raw = body.emails != null ? body.emails : body.recipients;
    const arr = Array.isArray(raw) ? raw : String(raw || '').split(/[\n,;]+/);
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = [...new Set(arr.map((s) => String(s).trim().toLowerCase()).filter((e) => re.test(e)))];
    if (!emails.length) {
      const e = new Error('請提供至少一個有效電郵');
      e.status = 400;
      throw e;
    }
    if (emails.length > MAX_MANUAL_SAVED_LIST) {
      const e = new Error(`手動列表最多 ${MAX_MANUAL_SAVED_LIST} 個電郵`);
      e.status = 400;
      throw e;
    }
    out.emails = emails;
    out.userIds = [];
    out.roles = [];
  } else if (listMode === 'userIds') {
    const raw = Array.isArray(body.userIds) ? body.userIds : [];
    const ids = [...new Set(raw.map((id) => String(id).trim()).filter((id) => mongoose.isValidObjectId(id)))];
    if (!ids.length) {
      const e = new Error('請提供至少一個有效用戶 ID');
      e.status = 400;
      throw e;
    }
    if (ids.length > MAX_USER_IDS) {
      const e = new Error(`最多 ${MAX_USER_IDS} 位用戶`);
      e.status = 400;
      throw e;
    }
    out.userIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    out.emails = [];
    out.roles = [];
  } else {
    const raw = Array.isArray(body.roles) ? body.roles : [];
    const roles = [...new Set(raw.map((r) => String(r).trim()).filter((r) => ALLOWED_ROLES.includes(r)))];
    if (!roles.length) {
      const e = new Error('請選擇至少一個角色（user / coach / admin）');
      e.status = 400;
      throw e;
    }
    out.roles = roles;
    out.emails = [];
    out.userIds = [];
    out.defaultRoleBatchOffset = Math.max(0, parseInt(body.defaultRoleBatchOffset, 10) || 0);
    out.defaultRoleBatchLimit = Math.min(2000, Math.max(1, parseInt(body.defaultRoleBatchLimit, 10) || 500));
  }
  return out;
}

// --- EDM 範本（可重用） ---

router.get(
  '/templates',
  auth,
  adminAuth,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 30);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        EdmTemplate.find()
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .lean(),
        EdmTemplate.countDocuments()
      ]);
      res.json({ data: { items, total, page, limit } });
    } catch (e) {
      console.error('EDM templates list:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

router.get('/templates/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
    const doc = await EdmTemplate.findById(id).populate('createdBy', 'name email').lean();
    if (!doc) return res.status(404).json({ message: '找不到範本' });
    res.json({ data: { template: doc } });
  } catch (e) {
    console.error('EDM template get:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.post(
  '/templates',
  auth,
  adminAuth,
  [
    body('name').trim().isLength({ min: 1, max: 120 }).withMessage('範本名稱 1–120 字'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('主旨 1–200 字'),
    body('headline').optional().trim().isLength({ max: 200 }),
    body('preheader').optional().trim().isLength({ max: 300 }),
    body('bodyHtml').optional().isString().isLength({ max: 200000 }),
    body('bodyText').optional().isString().isLength({ max: 50000 }),
    body('ctaUrl').optional().isString().isLength({ max: 2048 }),
    body('ctaLabel').optional().isString().isLength({ max: 80 }),
    body('footerNote').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      const bodyHtmlRaw = req.body.bodyHtml != null ? String(req.body.bodyHtml).trim() : '';
      const bodyText = req.body.bodyText != null ? String(req.body.bodyText).trim() : '';
      let bodyHtml = bodyHtmlRaw;
      if (!bodyHtml && bodyText) bodyHtml = plainTextToEmailHtml(bodyText);
      if (!bodyHtml) return res.status(400).json({ message: '請提供 bodyHtml 或 bodyText' });
      const doc = await EdmTemplate.create({
        createdBy: req.user._id,
        name: req.body.name.trim(),
        description: req.body.description?.trim() || '',
        subject: req.body.subject.trim(),
        headline: req.body.headline?.trim() || '',
        preheader: req.body.preheader?.trim() || '',
        bodyHtml,
        bodyText: bodyText || '',
        ctaUrl: req.body.ctaUrl?.trim() || '',
        ctaLabel: req.body.ctaLabel?.trim() || '',
        footerNote: req.body.footerNote?.trim() || ''
      });
      res.status(201).json({ data: { template: doc.toObject() } });
    } catch (e) {
      console.error('EDM template create:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

router.patch(
  '/templates/:id',
  auth,
  adminAuth,
  [
    body('name').optional().trim().isLength({ min: 1, max: 120 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('subject').optional().trim().isLength({ min: 1, max: 200 }),
    body('headline').optional().trim().isLength({ max: 200 }),
    body('preheader').optional().trim().isLength({ max: 300 }),
    body('bodyHtml').optional().isString().isLength({ max: 200000 }),
    body('bodyText').optional().isString().isLength({ max: 50000 }),
    body('ctaUrl').optional().isString().isLength({ max: 2048 }),
    body('ctaLabel').optional().isString().isLength({ max: 80 }),
    body('footerNote').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
      const doc = await EdmTemplate.findById(id);
      if (!doc) return res.status(404).json({ message: '找不到範本' });
      const patch = {};
      for (const k of ['name', 'description', 'subject', 'headline', 'preheader', 'ctaUrl', 'ctaLabel', 'footerNote']) {
        if (req.body[k] !== undefined) patch[k] = String(req.body[k]).trim();
      }
      if (req.body.bodyText !== undefined) patch.bodyText = String(req.body.bodyText).trim();
      if (req.body.bodyHtml !== undefined) patch.bodyHtml = String(req.body.bodyHtml).trim();
      if (patch.bodyHtml === '' && (patch.bodyText !== undefined || doc.bodyText)) {
        const bt = patch.bodyText !== undefined ? patch.bodyText : doc.bodyText;
        if (bt) patch.bodyHtml = plainTextToEmailHtml(bt);
      }
      Object.assign(doc, patch);
      if (!String(doc.bodyHtml || '').trim() && !String(doc.bodyText || '').trim()) {
        return res.status(400).json({ message: '範本須保留 bodyHtml 或 bodyText' });
      }
      if (!String(doc.bodyHtml || '').trim() && String(doc.bodyText || '').trim()) {
        doc.bodyHtml = plainTextToEmailHtml(doc.bodyText);
      }
      await doc.save();
      res.json({ data: { template: doc.toObject() } });
    } catch (e) {
      console.error('EDM template patch:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

router.delete('/templates/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
    const r = await EdmTemplate.deleteOne({ _id: id });
    if (!r.deletedCount) return res.status(404).json({ message: '找不到範本' });
    res.json({ message: '已刪除' });
  } catch (e) {
    console.error('EDM template delete:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// --- 發送列表（可重用） ---

router.get(
  '/mailing-lists',
  auth,
  adminAuth,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 30);
      const skip = (page - 1) * limit;
      const [items, total] = await Promise.all([
        EdmMailingList.find()
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .select('-emails')
          .lean(),
        EdmMailingList.countDocuments()
      ]);
      res.json({ data: { items, total, page, limit } });
    } catch (e) {
      console.error('EDM mailing-lists list:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

router.get('/mailing-lists/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
    const doc = await EdmMailingList.findById(id).populate('createdBy', 'name email').lean();
    if (!doc) return res.status(404).json({ message: '找不到發送列表' });
    let populatedUsers = [];
    if (doc.listMode === 'userIds' && Array.isArray(doc.userIds) && doc.userIds.length) {
      const User = require('../models/User');
      const users = await User.find({ _id: { $in: doc.userIds } })
        .select('name email role')
        .limit(500)
        .lean();
      populatedUsers = users;
    }
    res.json({ data: { list: doc, populatedUsers } });
  } catch (e) {
    console.error('EDM mailing-list get:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.post('/mailing-lists', auth, adminAuth, async (req, res) => {
  try {
    let normalized;
    try {
      normalized = normalizeMailingListInput(req.body);
    } catch (e) {
      return res.status(e.status || 400).json({ message: e.message });
    }
    const doc = await EdmMailingList.create({
      ...normalized,
      createdBy: req.user._id
    });
    res.status(201).json({ data: { list: doc.toObject() } });
  } catch (e) {
    console.error('EDM mailing-list create:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.patch('/mailing-lists/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
    const doc = await EdmMailingList.findById(id);
    if (!doc) return res.status(404).json({ message: '找不到發送列表' });
    const merged = { ...doc.toObject(), ...req.body, listMode: req.body.listMode || doc.listMode };
    let normalized;
    try {
      normalized = normalizeMailingListInput(merged);
    } catch (e) {
      return res.status(e.status || 400).json({ message: e.message });
    }
    doc.set(normalized);
    await doc.save();
    res.json({ data: { list: doc.toObject() } });
  } catch (e) {
    console.error('EDM mailing-list patch:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

router.delete('/mailing-lists/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });
    const r = await EdmMailingList.deleteOne({ _id: id });
    if (!r.deletedCount) return res.status(404).json({ message: '找不到發送列表' });
    res.json({ message: '已刪除' });
  } catch (e) {
    console.error('EDM mailing-list delete:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/edm/campaigns
// @desc    EDM 寄送活動列表（不含大段 HTML）
// @access  Private(Admin)
router.get(
  '/campaigns',
  auth,
  adminAuth,
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        EdmCampaign.find()
          .select('-bodyHtml -bodyText')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('createdBy', 'name email')
          .lean(),
        EdmCampaign.countDocuments()
      ]);

      res.json({ data: { items, total, page, limit } });
    } catch (e) {
      console.error('EDM campaigns list 錯誤:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

// @route   GET /api/edm/campaigns/:id
// @desc    單次 EDM 活動詳情（含內容快照）
// @access  Private(Admin)
router.get('/campaigns/:id', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });

    const campaign = await EdmCampaign.findById(id).populate('createdBy', 'name email').lean();
    if (!campaign) return res.status(404).json({ message: '找不到紀錄' });

    res.json({ data: { campaign } });
  } catch (e) {
    console.error('EDM campaign detail 錯誤:', e);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/edm/campaigns/:id/recipients
// @desc    該次發送每位收件人之紀錄（分頁）
// @access  Private(Admin)
router.get(
  '/campaigns/:id/recipients',
  auth,
  adminAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 500 }),
    query('status').optional().isIn(['sent', 'failed'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'ID 無效' });

      const exists = await EdmCampaign.exists({ _id: id });
      if (!exists) return res.status(404).json({ message: '找不到紀錄' });

      const page = parseInt(req.query.page, 10) || 1;
      const limit = Math.min(500, parseInt(req.query.limit, 10) || 50);
      const skip = (page - 1) * limit;
      const filter = { campaign: id };
      if (req.query.status === 'sent' || req.query.status === 'failed') {
        filter.status = req.query.status;
      }

      const [items, total] = await Promise.all([
        EdmSendLog.find(filter)
          .sort({ sentAt: 1, email: 1 })
          .skip(skip)
          .limit(limit)
          .populate('user', 'name email')
          .lean(),
        EdmSendLog.countDocuments(filter)
      ]);

      res.json({ data: { items, total, page, limit } });
    } catch (e) {
      console.error('EDM campaign recipients 錯誤:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

// @route   GET /api/edm/recipients-preview
// @desc    預覽依角色篩選的收件人（有序：email 升序），不發信
// @access  Private(Admin)
router.get(
  '/recipients-preview',
  auth,
  adminAuth,
  [
    query('roles').isString().isLength({ min: 1 }).withMessage('請提供 roles'),
    query('offset').optional().isInt({ min: 0, max: 1000000 }),
    query('limit').optional().isInt({ min: 1, max: 2000 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      const roles = String(req.query.roles || '')
        .split(',')
        .map((s) => s.trim())
        .filter((r) => ALLOWED_ROLES.includes(r));
      if (!roles.length) {
        return res.status(400).json({ message: `roles 須為以下之一或多個（逗號分隔）：${ALLOWED_ROLES.join(', ')}` });
      }

      const offset = parseInt(req.query.offset, 10) || 0;
      const limit = parseInt(req.query.limit, 10) || 50;
      const data = await previewRoleRecipients({ roles, offset, limit });
      res.json({ data });
    } catch (e) {
      const status = e.status || 500;
      if (status !== 500) return res.status(status).json({ message: e.message });
      console.error('EDM preview 錯誤:', e);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

// @route   POST /api/edm/send
// @desc    發送 EDM：可選 templateId / mailingListId 重用資源；亦可沿用內聯收件與內容
// @access  Private(Admin)
router.post(
  '/send',
  edmSendLimiter,
  auth,
  adminAuth,
  [
    body('templateId').optional({ values: 'falsy' }).isMongoId().withMessage('範本 ID 無效'),
    body('mailingListId').optional({ values: 'falsy' }).isMongoId().withMessage('發送列表 ID 無效'),
    body('recipientMode').optional().isIn(['manual', 'userIds', 'roles']).withMessage('recipientMode 無效'),
    body('roleBatchOffset').optional().isInt({ min: 0, max: 1000000 }),
    body('roleBatchLimit').optional().isInt({ min: 1, max: 2000 }),
    body('subject').optional().trim().isLength({ min: 1, max: 200 }).withMessage('主旨最多 200 字'),
    body('headline').optional().trim().isLength({ max: 200 }).withMessage('標題最多 200 字'),
    body('preheader').optional().trim().isLength({ max: 300 }).withMessage('預覽摘要最多 300 字'),
    body('bodyHtml').optional().isString().isLength({ max: 200000 }).withMessage('bodyHtml 過長'),
    body('bodyText').optional().isString().isLength({ max: 50000 }).withMessage('bodyText 過長'),
    body('ctaUrl').optional().isString().isLength({ max: 2048 }),
    body('ctaLabel').optional().isString().isLength({ max: 80 }),
    body('footerNote').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });

      let templateDoc = null;
      if (req.body.templateId) {
        if (!mongoose.isValidObjectId(String(req.body.templateId))) {
          return res.status(400).json({ message: '範本 ID 無效' });
        }
        templateDoc = await EdmTemplate.findById(req.body.templateId).lean();
        if (!templateDoc) return res.status(404).json({ message: '找不到 EDM 範本' });
      }

      let mailingListDoc = null;
      if (req.body.mailingListId) {
        if (!mongoose.isValidObjectId(String(req.body.mailingListId))) {
          return res.status(400).json({ message: '發送列表 ID 無效' });
        }
        mailingListDoc = await EdmMailingList.findById(req.body.mailingListId).lean();
        if (!mailingListDoc) return res.status(404).json({ message: '找不到發送列表' });
      }

      let resolveBody;
      try {
        resolveBody = mailingListDoc ? mailingListToResolveBody(mailingListDoc, req.body) : req.body;
      } catch (e) {
        return res.status(e.status || 400).json({ message: e.message });
      }

      if (!mailingListDoc && !String(resolveBody.recipientMode || '').trim()) {
        return res.status(400).json({ message: '請提供 mailingListId，或選擇收件模式並填寫收件資料' });
      }

      let emails;
      let userIdByEmail;
      let recipientMeta;
      try {
        const resolved = await resolveEdmRecipientEmails(resolveBody);
        emails = resolved.emails;
        userIdByEmail = resolved.userIdByEmail || {};
        recipientMeta = resolved.meta;
      } catch (e) {
        const status = e.status || 400;
        return res.status(status).json({ message: e.message || '收件人解析失敗' });
      }

      if (!emails.length) {
        return res.status(400).json({ message: '沒有可發送的電郵地址（請確認用戶已啟用且設有 email）' });
      }

      const content = mergeEdmContentFromTemplate(templateDoc, req.body);
      if (!String(content.subject || '').trim()) {
        return res.status(400).json({ message: '請提供主旨，或選擇 EDM 範本' });
      }

      let bodyHtml = String(content.bodyHtml || '').trim();
      const bodyText = String(content.bodyText || '').trim();
      if (!bodyHtml && bodyText) {
        bodyHtml = plainTextToEmailHtml(bodyText);
      }
      if (!bodyHtml) {
        return res.status(400).json({ message: '請提供 bodyHtml／bodyText，或選擇含內文的 EDM 範本' });
      }

      const subject = String(content.subject).trim();
      const headline = String(content.headline || '').trim() || subject;
      const preheader = String(content.preheader || '').trim();
      const ctaUrl = String(content.ctaUrl || '').trim();
      const ctaLabel = String(content.ctaLabel || '').trim();
      const footerNote = String(content.footerNote || '').trim();

      const recipientMode = String(resolveBody.recipientMode || 'manual').trim();
      const metaSnapshot = {
        ...(recipientMeta || {}),
        ...(templateDoc
          ? { edmTemplateId: String(templateDoc._id), edmTemplateName: templateDoc.name }
          : {}),
        ...(mailingListDoc
          ? { edmMailingListId: String(mailingListDoc._id), edmMailingListName: mailingListDoc.name }
          : {})
      };

      const campaign = await EdmCampaign.create({
        createdBy: req.user._id,
        status: 'sending',
        subject,
        headline,
        preheader,
        bodyHtml,
        bodyText: bodyText || '',
        ctaUrl,
        ctaLabel,
        footerNote,
        recipientMode: ['manual', 'userIds', 'roles'].includes(recipientMode) ? recipientMode : 'manual',
        recipientMeta: metaSnapshot,
        edmTemplate: templateDoc ? templateDoc._id : null,
        edmMailingList: mailingListDoc ? mailingListDoc._id : null,
        edmTemplateName: templateDoc ? templateDoc.name : '',
        edmMailingListName: mailingListDoc ? mailingListDoc.name : '',
        targetCount: emails.length
      });

      let result;
      try {
        result = await emailService.sendEdmNewsletter({
          recipients: emails,
          subject,
          headline,
          preheader: preheader || undefined,
          bodyHtml,
          bodyText: bodyText || undefined,
          ctaUrl: ctaUrl || undefined,
          ctaLabel: ctaLabel || undefined,
          footerNote: footerNote || undefined,
          campaignId: campaign._id,
          userIdByEmail
        });
      } catch (sendErr) {
        console.error('EDM send 例外:', sendErr);
        await EdmCampaign.findByIdAndUpdate(campaign._id, {
          status: 'failed',
          sentCount: 0,
          failedCount: emails.length,
          completedAt: new Date()
        });
        return res.status(500).json({ message: sendErr.message || '發送失敗' });
      }

      const campStatus =
        result.sent === 0 && emails.length > 0 ? 'failed' : result.failed > 0 ? 'partial' : 'completed';

      await EdmCampaign.findByIdAndUpdate(campaign._id, {
        status: campStatus,
        sentCount: result.sent,
        failedCount: result.failed,
        completedAt: new Date()
      });

      if (result.error && result.sent === 0 && (result.errors || []).length === 0) {
        return res.status(500).json({ message: result.error, campaignId: String(campaign._id) });
      }

      const statusCode = result.failed > 0 ? 207 : 200;
      res.status(statusCode).json({
        message: 'EDM 已處理',
        data: {
          campaignId: String(campaign._id),
          total: emails.length,
          recipientMeta: metaSnapshot,
          recipientsThisBatch: emails,
          sent: result.sent,
          failed: result.failed,
          errors: result.errors || []
        }
      });
    } catch (error) {
      console.error('EDM send 錯誤:', error);
      res.status(500).json({ message: '服務器錯誤，請稍後再試' });
    }
  }
);

module.exports = router;
