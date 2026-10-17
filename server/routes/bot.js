const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const { botAuth } = require('../middleware/botAuth');
const { getUserBalanceByPhone, getUserBalanceByEmail } = require('../services/botUserService');
const { searchAvailability } = require('../services/botAvailabilityService');
const { createBookingViaBot } = require('../services/botBookingService');
const { listStoresForBot, resolveStoreId } = require('../services/botStoreService');
const { listActivitiesForBot } = require('../services/botActivityService');

const router = express.Router();

const botLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, message: 'Bot API 請求過於頻繁，請稍後再試' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(botLimiter);
router.use(botAuth);

const timePattern = /^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/;

function handleServiceError(res, error) {
  const code = error.code || 'SERVER_ERROR';
  const statusMap = {
    USER_NOT_FOUND: 404,
    STORE_NOT_FOUND: 404,
    STORE_QUERY_REQUIRED: 400,
    STORE_INACTIVE: 400,
    COURT_NOT_FOUND: 404,
    COURT_UNAVAILABLE: 400,
    COURT_CLOSED: 400,
    PAST_DATE: 400,
    DATE_TOO_FAR: 400,
    TIME_CONFLICT: 400,
    DURATION_TOO_SHORT: 400,
    DURATION_TOO_LONG: 400,
    INVALID_TOTAL_PLAYERS: 400,
    INVALID_SPECIAL_REQUESTS: 400,
    INVALID_REDEEM_CODE: 400,
    INSUFFICIENT_BALANCE: 400,
    SOLO_COURT_NOT_FOUND: 500,
    SOLO_TIME_CONFLICT: 400,
  };

  const status = statusMap[code] || 500;
  return res.status(status).json({
    success: false,
    code,
    message: error.message || '服務器錯誤',
    ...(error.details ? { details: error.details } : {}),
  });
}

// @route   GET /api/bot/balance
// @desc    用電話查詢用戶積分
// @access  Bot API Key
router.get(
  '/balance',
  [
    query('phone').optional().trim(),
    query('email').optional().trim().isEmail().withMessage('請提供有效的 email'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const phone = String(req.query.phone || '').trim();
      const email = String(req.query.email || '').trim();

      if (!phone && !email) {
        return res.status(400).json({
          success: false,
          message: '請提供 phone 或 email',
        });
      }

      const data = phone
        ? await getUserBalanceByPhone(phone)
        : await getUserBalanceByEmail(email);
      res.json({ success: true, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  }
);

// @route   GET /api/bot/stores
// @desc    店鋪列表（含別名，供 LLM／n8n 對應自然語言店名）
// @access  Bot API Key
router.get('/stores', async (req, res) => {
  try {
    const data = await listStoresForBot();
    res.json({ success: true, data });
  } catch (error) {
    handleServiceError(res, error);
  }
});

// @route   GET /api/bot/stores/resolve
// @desc    用名稱／別名解析 storeId
// @access  Bot API Key
router.get(
  '/stores/resolve',
  [query('q').notEmpty().withMessage('請提供 q（店名、slug 或別名）')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }
      const data = await resolveStoreId(req.query.q);
      res.json({ success: true, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  }
);

// @route   GET /api/bot/activities
// @desc    活動中心即將開始／進行中活動（可選 store 別名篩選）
// @access  Bot API Key
router.get(
  '/activities',
  [
    query('store').optional().trim(),
    query('limit').optional().isInt({ min: 1, max: 30 }).withMessage('limit 必須是 1-30'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const data = await listActivitiesForBot({
        storeQuery: req.query.store || '',
        limit: req.query.limit,
      });
      res.json({ success: true, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  }
);

// @route   GET /api/bot/availability
// @desc    查詢指定店鋪、日期、時段的所有場地空缺
// @access  Bot API Key
router.get(
  '/availability',
  [
    query('store').notEmpty().withMessage('請提供 store（店鋪 ID）'),
    query('date').isISO8601().withMessage('請提供有效的 date（YYYY-MM-DD）'),
    query('startTime').matches(timePattern).withMessage('請提供有效的 startTime'),
    query('endTime').matches(timePattern).withMessage('請提供有效的 endTime'),
    query('courtType').optional().isIn(['competition', 'training', 'solo', 'dink', 'full_venue']).withMessage('courtType 無效'),
    query('phone').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array(),
        });
      }

      const { store, date, startTime, endTime, courtType, phone } = req.query;
      const data = await searchAvailability({
        storeId: store,
        date,
        startTime,
        endTime,
        courtType,
        phone,
      });

      res.json({ success: true, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  }
);

// @route   POST /api/bot/booking
// @desc    簡化預約（以電話識別用戶，回傳完整預約內容）
// @access  Bot API Key
router.post(
  '/booking',
  [
    body('phone').notEmpty().withMessage('請提供 phone'),
    body('court').isMongoId().withMessage('請提供有效的 court ID'),
    body('date').isISO8601().withMessage('請提供有效的 date'),
    body('startTime').matches(timePattern).withMessage('請提供有效的 startTime'),
    body('endTime').matches(timePattern).withMessage('請提供有效的 endTime'),
    body('totalPlayers').isInt({ min: 1, max: 8 }).withMessage('totalPlayers 必須是 1-8'),
    body('specialRequests').optional().trim().isLength({ max: 500 }),
    body('includeSoloCourt').optional().isBoolean(),
    body('redeemCodeId').optional().isMongoId(),
    body('source')
      .optional()
      .isIn(['web', 'admin', 'whatsapp_bot', 'bot', 'api', 'other'])
      .withMessage('source 無效'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: '輸入驗證失敗',
          errors: errors.array(),
        });
      }

      const data = await createBookingViaBot({
        ...req.body,
        source: req.body.source || 'whatsapp_bot',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      res.status(201).json({ success: true, data });
    } catch (error) {
      handleServiceError(res, error);
    }
  }
);

module.exports = router;
