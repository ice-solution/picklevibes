const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { body, validationResult } = require('express-validator');
const ApplicationForm = require('../models/ApplicationForm');
const ApplicationSubmission = require('../models/ApplicationSubmission');
const Store = require('../models/Store');
const { auth, adminAuth } = require('../middleware/auth');
const {
  applicationFormUpload,
  processApplicationFormImage,
} = require('../middleware/upload');

const router = express.Router();

/** 與前端固定路由衝突的 slug 保留字 */
const RESERVED_SLUGS = new Set([
  'about',
  'admin',
  'admin-v2',
  'api',
  'activities',
  'booking',
  'bookings',
  'cart',
  'checkout',
  'coach',
  'courts',
  'dashboard',
  'faq',
  'forgot-password',
  'forms',
  'apply',
  'login',
  'maintenance',
  'my-activities',
  'my-bookings',
  'orders',
  'payment-result',
  'privacy',
  'profile',
  'recharge',
  'recharge-success',
  'register',
  'reset-password',
  'shop',
  'store',
  'terms',
  'vips',
  'vlog',
  'uploads',
]);

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function normalizeFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((f, idx) => {
      const fieldName = String(f.fieldName || f.name || `field_${idx + 1}`)
        .trim()
        .replace(/\s+/g, '_');
      const type = ['text', 'email', 'tel', 'textarea', 'select'].includes(f.type)
        ? f.type
        : 'text';
      const options = Array.isArray(f.options)
        ? f.options
            .filter((o) => o && (o.value || o.label))
            .map((o) => ({
              value: String(o.value || o.label || '').trim(),
              label: String(o.label || o.value || '').trim(),
            }))
        : [];
      return {
        fieldName,
        label: String(f.label || fieldName).trim(),
        type,
        required: !!f.required,
        placeholder: String(f.placeholder || '').trim(),
        options: type === 'select' ? options : [],
        order: Number.isFinite(Number(f.order)) ? Number(f.order) : idx,
      };
    })
    .filter((f) => f.fieldName && f.label);
}

async function assertSlugAvailable(slug, excludeId = null) {
  if (!slug || slug.length < 2) {
    const err = new Error('slug 至少 2 個字元');
    err.status = 400;
    throw err;
  }
  if (RESERVED_SLUGS.has(slug)) {
    const err = new Error('此 slug 為系統保留字，請換一個');
    err.status = 400;
    throw err;
  }
  const storeClash = await Store.findOne({ slug }).select('_id').lean();
  if (storeClash) {
    const err = new Error('此 slug 已被店鋪使用，請換一個');
    err.status = 400;
    throw err;
  }
  const q = { slug };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    q._id = { $ne: excludeId };
  }
  const formClash = await ApplicationForm.findOne(q).select('_id').lean();
  if (formClash) {
    const err = new Error('此 slug 已被其他申請表使用');
    err.status = 400;
    throw err;
  }
}

function publicFormPayload(form) {
  return {
    id: String(form._id),
    title: form.title,
    slug: form.slug,
    description: form.description || '',
    bannerUrl: form.bannerUrl || '',
    isActive: form.isActive,
    closedMessage: form.closedMessage,
    thankYouTitle: form.thankYouTitle,
    thankYouMessage: form.thankYouMessage,
    agreement: form.agreement || { enabled: false },
    fields: (form.fields || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((f) => ({
        fieldName: f.fieldName,
        label: f.label,
        type: f.type,
        required: !!f.required,
        placeholder: f.placeholder || '',
        options: f.options || [],
      })),
    store: form.store
      ? {
          id: String(form.store._id || form.store),
          name: form.store.name,
          slug: form.store.slug,
        }
      : null,
  };
}

// ─── Public ───────────────────────────────────────────────

router.get('/public/:slug', async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    const form = await ApplicationForm.findOne({ slug })
      .populate('store', 'name slug isActive')
      .lean();
    if (!form) {
      return res.status(404).json({ message: '申請表不存在' });
    }
    if (!form.store || form.store.isActive === false) {
      return res.status(404).json({ message: '申請表不存在' });
    }
    if (!form.isActive) {
      return res.status(403).json({
        message: form.closedMessage || '此申請表目前已關閉',
        closed: true,
        title: form.title,
        closedMessage: form.closedMessage,
        bannerUrl: form.bannerUrl || '',
        store: form.store
          ? { name: form.store.name, slug: form.store.slug }
          : null,
      });
    }
    res.json({ form: publicFormPayload(form) });
  } catch (error) {
    console.error('public form get:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/public/:slug/submit', async (req, res) => {
  try {
    const slug = slugify(req.params.slug);
    const form = await ApplicationForm.findOne({ slug });
    if (!form) {
      return res.status(404).json({ message: '申請表不存在' });
    }
    if (!form.isActive) {
      return res.status(403).json({
        message: form.closedMessage || '此申請表目前已關閉',
        closed: true,
      });
    }

    const store = await Store.findById(form.store).select('isActive').lean();
    if (!store || store.isActive === false) {
      return res.status(404).json({ message: '申請表不存在' });
    }

    const body = req.body?.data && typeof req.body.data === 'object' ? req.body.data : req.body || {};
    const data = {};
    for (const field of form.fields || []) {
      const raw = body[field.fieldName];
      const value = raw == null ? '' : String(raw).trim();
      if (field.required && !value) {
        return res.status(400).json({ message: `請填寫「${field.label}」` });
      }
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return res.status(400).json({ message: `「${field.label}」格式不正確` });
      }
      if (field.type === 'select' && value) {
        const allowed = (field.options || []).map((o) => o.value);
        if (allowed.length && !allowed.includes(value)) {
          return res.status(400).json({ message: `「${field.label}」選項無效` });
        }
      }
      data[field.fieldName] = value;
    }

    if (form.agreement?.enabled) {
      if (!req.body?.agreed && !body.agreed) {
        return res.status(400).json({ message: '請先同意條款' });
      }
    }

    const contactName =
      data.name || data.full_name || data.fullName || data.姓名 || '';
    const contactEmail = data.email || data.Email || data.電郵 || '';
    const contactPhone = data.phone || data.tel || data.mobile || data.電話 || '';

    const submission = await ApplicationSubmission.create({
      form: form._id,
      store: form.store,
      data,
      contactName,
      contactEmail,
      contactPhone,
    });

    res.status(201).json({
      ok: true,
      submissionId: submission._id,
      thankYouTitle: form.thankYouTitle,
      thankYouMessage: form.thankYouMessage,
    });
  } catch (error) {
    console.error('public form submit:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Admin ────────────────────────────────────────────────

router.use(auth, adminAuth);

router.post(
  '/upload-banner',
  applicationFormUpload.single('banner'),
  processApplicationFormImage,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '請選擇圖片' });
      }
      const url = `/uploads/application-forms/${req.file.filename}`;
      res.json({ success: true, url });
    } catch (error) {
      console.error('upload application form banner:', error);
      res.status(500).json({ message: '上傳失敗' });
    }
  }
);

router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.store) {
      if (!mongoose.isValidObjectId(req.query.store)) {
        return res.status(400).json({ message: '無效店鋪 ID' });
      }
      filter.store = req.query.store;
    }
    const forms = await ApplicationForm.find(filter)
      .populate('store', 'name slug')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ forms });
  } catch (error) {
    console.error('list forms:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post(
  '/',
  [
    body('store').notEmpty().withMessage('請選擇店鋪'),
    body('title').trim().notEmpty().withMessage('請輸入標題'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
      }

      const storeId = req.body.store;
      if (!mongoose.isValidObjectId(storeId)) {
        return res.status(400).json({ message: '無效店鋪 ID' });
      }
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ message: '店鋪不存在' });

      let slug = slugify(req.body.slug || req.body.title);
      if (!slug) slug = `form-${Date.now().toString(36)}`;
      await assertSlugAvailable(slug);

      const form = await ApplicationForm.create({
        store: store._id,
        title: String(req.body.title).trim(),
        slug,
        description: req.body.description || '',
        bannerUrl: typeof req.body.bannerUrl === 'string' ? req.body.bannerUrl.trim() : '',
        isActive: req.body.isActive !== false,
        closedMessage: req.body.closedMessage || undefined,
        thankYouTitle: req.body.thankYouTitle || undefined,
        thankYouMessage: req.body.thankYouMessage || undefined,
        agreement: {
          enabled: !!req.body.agreement?.enabled,
          label: req.body.agreement?.label || '我已閱讀並同意相關條款',
          content: req.body.agreement?.content || '',
        },
        fields: normalizeFields(req.body.fields),
      });

      const populated = await ApplicationForm.findById(form._id).populate('store', 'name slug');
      res.status(201).json({ form: populated });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      if (error.code === 11000) return res.status(400).json({ message: 'slug 已存在' });
      console.error('create form:', error);
      res.status(500).json({ message: '服務器錯誤' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id).populate('store', 'name slug');
    if (!form) return res.status(404).json({ message: '申請表不存在' });
    res.json({ form });
  } catch (error) {
    console.error('get form:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id);
    if (!form) return res.status(404).json({ message: '申請表不存在' });

    if (req.body.title != null) form.title = String(req.body.title).trim();
    if (req.body.description != null) form.description = String(req.body.description);
    if (req.body.bannerUrl !== undefined) {
      form.bannerUrl = typeof req.body.bannerUrl === 'string' ? req.body.bannerUrl.trim() : '';
    }
    if (req.body.closedMessage != null) form.closedMessage = String(req.body.closedMessage);
    if (req.body.thankYouTitle != null) form.thankYouTitle = String(req.body.thankYouTitle);
    if (req.body.thankYouMessage != null) form.thankYouMessage = String(req.body.thankYouMessage);
    if (req.body.isActive != null) form.isActive = !!req.body.isActive;
    if (req.body.fields != null) form.fields = normalizeFields(req.body.fields);
    if (req.body.agreement != null) {
      form.agreement = {
        enabled: !!req.body.agreement.enabled,
        label: req.body.agreement.label || form.agreement?.label || '我已閱讀並同意相關條款',
        content: req.body.agreement.content ?? form.agreement?.content ?? '',
      };
    }
    if (req.body.slug != null && String(req.body.slug).trim()) {
      const next = slugify(req.body.slug);
      if (next !== form.slug) {
        await assertSlugAvailable(next, form._id);
        form.slug = next;
      }
    }
    if (req.body.store && mongoose.isValidObjectId(req.body.store)) {
      const store = await Store.findById(req.body.store);
      if (!store) return res.status(404).json({ message: '店鋪不存在' });
      form.store = store._id;
    }

    await form.save();
    const populated = await ApplicationForm.findById(form._id).populate('store', 'name slug');
    res.json({ form: populated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.code === 11000) return res.status(400).json({ message: 'slug 已存在' });
    console.error('update form:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id);
    if (!form) return res.status(404).json({ message: '申請表不存在' });
    form.isActive = req.body.isActive != null ? !!req.body.isActive : !form.isActive;
    await form.save();
    res.json({ form });
  } catch (error) {
    console.error('toggle form:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/:id/submissions', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id).select('_id').lean();
    if (!form) return res.status(404).json({ message: '申請表不存在' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      ApplicationSubmission.find({ form: form._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ApplicationSubmission.countDocuments({ form: form._id }),
    ]);

    res.json({
      submissions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (error) {
    console.error('list submissions:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

/** 匯出全部提交為 XLSX（欄位用中文 label） */
router.get('/:id/submissions/export', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id).lean();
    if (!form) return res.status(404).json({ message: '申請表不存在' });

    const fields = (form.fields || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    const submissions = await ApplicationSubmission.find({ form: form._id })
      .sort({ createdAt: -1 })
      .lean();

    const headers = ['提交時間', ...fields.map((f) => f.label || f.fieldName)];
    const rows = submissions.map((s) => {
      const row = {
        提交時間: s.createdAt
          ? new Date(s.createdAt).toLocaleString('zh-HK', { hour12: false })
          : '',
      };
      for (const f of fields) {
        const key = f.label || f.fieldName;
        row[key] = s.data?.[f.fieldName] != null ? String(s.data[f.fieldName]) : '';
      }
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}], {
      header: headers,
    });
    if (!rows.length) {
      XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '提交記錄');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const safeTitle = String(form.title || 'application')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
      .slice(0, 40);
    const filename = `申請表_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    res.send(buffer);
  } catch (error) {
    console.error('export submissions xlsx:', error);
    res.status(500).json({ message: '匯出失敗' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: '無效 ID' });
    }
    const form = await ApplicationForm.findById(req.params.id);
    if (!form) return res.status(404).json({ message: '申請表不存在' });
    await ApplicationSubmission.deleteMany({ form: form._id });
    await ApplicationForm.deleteOne({ _id: form._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete form:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
module.exports.RESERVED_SLUGS = RESERVED_SLUGS;
module.exports.slugify = slugify;
