const express = require('express');
const { body, validationResult } = require('express-validator');
const Activity = require('../models/Activity');
const ActivityRegistration = require('../models/ActivityRegistration');
const UserBalance = require('../models/UserBalance');
const User = require('../models/User');
const RedeemCode = require('../models/RedeemCode');
const RedeemUsage = require('../models/RedeemUsage');
const emailService = require('../services/emailService');
const { auth, adminAuth } = require('../middleware/auth');
const { activityUpload, processActivityImage, deleteFile } = require('../middleware/upload');

const router = express.Router();

/**
 * 將 datetime-local 格式的字符串轉換為正確的 Date 對象
 * datetime-local 格式: "2024-11-15T15:00" (本地時間，無時區)
 * 問題：datetime-local 提交的是本地時間字符串，但可能被當作 UTC 處理
 * 解決：將字符串明確解析為香港時區（UTC+8）的本地時間
 */
function parseLocalDateTime(dateTimeString) {
  if (!dateTimeString) return null;
  
  // 如果已經是完整的 ISO 格式（包含時區），直接解析
  if (dateTimeString.includes('Z') || dateTimeString.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateTimeString);
  }
  
  // datetime-local 格式: "2024-11-15T15:00"
  // 這個字符串沒有時區信息，會被 JavaScript 解釋為本地時區
  // 為了確保正確，我們需要明確指定這是香港時區（UTC+8）的時間
  // 然後轉換為 UTC 存儲
  
  // 方法：將 "2024-11-15T15:00" 轉換為 "2024-11-15T15:00+08:00"（香港時區）
  // 然後讓 JavaScript 正確解析
  const hkTimeString = dateTimeString + '+08:00';
  return new Date(hkTimeString);
}

async function recalcActivityParticipantCount(activityId) {
  const registrations = await ActivityRegistration.find({
    activity: activityId,
    status: 'registered'
  }).select('participantCount');

  const totalRegistered = registrations.reduce((sum, reg) => sum + reg.participantCount, 0);

  await Activity.findByIdAndUpdate(activityId, {
    currentParticipants: totalRegistered
  });

  return totalRegistered;
}

// @route   GET /api/activities
// @desc    獲取所有活動列表（排序：最接近今天的在前，較後的在下，已完結的放最後）
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { isActive: true };
    if (status) {
      query.status = status;
    }

    const now = new Date();
    // 排序邏輯：未結束的活動按 startDate 升序（最近的在最前），已結束的放最後、按 endDate 降序（剛結束的在前）
    const aggResult = await Activity.aggregate([
      { $match: query },
      {
        $addFields: {
          isEnded: { $lt: ['$endDate', now] },
          sortKey: {
            $cond: {
              if: { $lt: ['$endDate', now] },
              then: { $add: [1e15, { $subtract: [now, '$endDate'] }] },
              else: '$startDate'
            }
          }
        }
      },
      { $sort: { sortKey: 1 } },
      { $skip: (parseInt(page, 10) - 1) * parseInt(limit, 10) },
      { $limit: parseInt(limit, 10) },
      { $project: { _id: 1 } }
    ]);
    const orderedIds = aggResult.map((doc) => doc._id);

    const activities = await Activity.find({ _id: { $in: orderedIds } })
      .populate('organizer', 'name email')
      .populate('coaches', 'name email');

    // 還原為排序後順序（find 不保證 $in 的順序）
    const idToOrder = new Map(orderedIds.map((id, i) => [id.toString(), i]));
    activities.sort((a, b) => (idToOrder.get(a._id.toString()) ?? 0) - (idToOrder.get(b._id.toString()) ?? 0));

    const total = await Activity.countDocuments(query);
    
    // 為每個活動添加用戶報名狀態
    const activitiesWithRegistration = await Promise.all(
      activities.map(async (activity) => {
        // 獲取該活動的報名記錄
        const registrations = await ActivityRegistration.find({ 
          activity: activity._id, 
          status: 'registered' 
        });
        
        const totalRegistered = registrations.reduce((sum, reg) => sum + reg.participantCount, 0);
        
        // 檢查當前用戶是否已報名
        let userRegistration = null;
        if (req.user) {
          const userReg = registrations.find(reg => reg.user.toString() === req.user.id);
          if (userReg) {
            userRegistration = {
              id: userReg._id,
              participantCount: userReg.participantCount,
              totalCost: userReg.totalCost,
              createdAt: userReg.createdAt
            };
          }
        }
        
        return {
          ...activity.toObject(),
          totalRegistered,
          availableSpots: activity.maxParticipants - totalRegistered,
          userRegistration,
          canRegister: activity.canRegister,
          isExpired: activity.isExpired,
          isFull: activity.isFull
        };
      })
    );
    
    res.json({
      activities: activitiesWithRegistration,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('獲取活動列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/activities/coach
// @desc    獲取教練負責的活動列表
// @access  Private (Coach only)
router.get('/coach', auth, async (req, res) => {
  try {
    // 檢查用戶是否為教練
    if (req.user.role !== 'coach') {
      return res.status(403).json({ message: '只有教練可以訪問此功能' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { 
      isActive: true,
      coach: req.user.id 
    };
    
    if (status) {
      query.status = status;
    }
    
    const activities = await Activity.find(query)
      .populate('organizer', 'name email')
      .populate('coach', 'name email')
      .sort({ startDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Activity.countDocuments(query);
    
    res.json({
      activities,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('獲取教練活動列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/activities/coach-courses
// @desc    獲取教練課程 - 只返回當前用戶作為教練的活動
// @access  Private (Coach only)
router.get('/coach-courses', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 查找當前用戶作為教練的活動
    const activities = await Activity.find({
      coaches: userId
    })
    .populate('coaches', 'name email')
    .sort({ startDate: 1 });

    // 計算每個活動的報名人數
    const activitiesWithStats = await Promise.all(
      activities.map(async (activity) => {
        const totalRegistered = await ActivityRegistration.countDocuments({
          activity: activity._id
        });

        return {
          ...activity.toObject(),
          totalRegistered,
          availableSpots: activity.maxParticipants - totalRegistered
        };
      })
    );

    res.json(activitiesWithStats);
  } catch (error) {
    console.error('獲取教練課程錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   GET /api/activities/user/registrations
// @desc    獲取用戶的活動報名記錄
// @access  Private
router.get('/user/registrations', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    console.log(`🔍 查詢用戶報名記錄: userId=${req.user.id}, status=${status || 'all'}, query:`, JSON.stringify(query));

    // 先檢查總數
    const total = await ActivityRegistration.countDocuments(query);
    console.log(`📊 數據庫中總共有 ${total} 條符合條件的報名記錄`);

    const registrations = await ActivityRegistration.find(query)
      .populate({
        path: 'activity',
        select: 'title description startDate endDate location status poster isActive'
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    console.log(`📊 查詢到 ${registrations.length} 條報名記錄`);
    
    // 詳細日誌每條記錄
    registrations.forEach((reg, index) => {
      console.log(`  [${index + 1}] Registration ID: ${reg._id}, Activity: ${reg.activity ? reg.activity._id : 'NULL'}, Status: ${reg.status}`);
    });
    
    // 檢查是否有 activity 為 null 的記錄
    const nullActivityCount = registrations.filter(reg => !reg.activity).length;
    if (nullActivityCount > 0) {
      console.warn(`⚠️ 有 ${nullActivityCount} 條記錄的活動不存在或已被刪除`);
    }

    // 返回所有記錄，包括活動已被刪除的（前端可以處理顯示）
    const validRegistrations = registrations;

    res.json({
      registrations: validRegistrations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('獲取用戶報名記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/activities/:id
// @desc    獲取單個活動詳情
// @access  Public (with optional auth)
router.get('/:id/registrations', [auth, adminAuth], async (req, res) => {
  try {
    const activityId = req.params.id;
    const activity = await Activity.findById(activityId).select('title maxParticipants currentParticipants');

    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const registrations = await ActivityRegistration.find({ activity: activityId })
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    const totalRegistered = registrations
      .filter(reg => reg.status === 'registered')
      .reduce((sum, reg) => sum + reg.participantCount, 0);

    res.json({
      registrations: registrations.map(reg => ({
        _id: reg._id,
        user: reg.user ? {
          _id: reg.user._id,
          name: reg.user.name,
          email: reg.user.email,
          phone: reg.user.phone
        } : null,
        participantCount: reg.participantCount,
        totalCost: reg.totalCost,
        status: reg.status,
        paymentStatus: reg.paymentStatus,
        contactInfo: reg.contactInfo,
        notes: reg.notes,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt
      })),
      stats: {
        totalRegistered,
        availableSpots: Math.max(0, activity.maxParticipants - totalRegistered),
        maxParticipants: activity.maxParticipants,
        currentParticipants: activity.currentParticipants || totalRegistered
      }
    });
  } catch (error) {
    console.error('獲取活動報名列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate('organizer', 'name email phone')
      .populate('coaches', 'name email');
    
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }
    
    // 獲取報名統計
    const registrations = await ActivityRegistration.find({ 
      activity: activity._id, 
      status: 'registered' 
    });
    
    const totalRegistered = registrations.reduce((sum, reg) => sum + reg.participantCount, 0);
    
    // 檢查當前用戶是否已報名 - 使用參加者列表對比
    let userRegistration = null;
    if (req.user) {
      // 從參加者列表中查找當前用戶
      const userReg = registrations.find(reg => reg.user.toString() === req.user.id);
      if (userReg) {
        userRegistration = {
          id: userReg._id,
          participantCount: userReg.participantCount,
          totalCost: userReg.totalCost,
          createdAt: userReg.createdAt
        };
      }
    }
    
    res.json({
      ...activity.toObject(),
      totalRegistered,
      availableSpots: activity.maxParticipants - totalRegistered,
      userRegistration: userRegistration ? {
        id: userRegistration._id,
        participantCount: userRegistration.participantCount,
        totalCost: userRegistration.totalCost,
        createdAt: userRegistration.createdAt
      } : null,
      canRegister: activity.canRegister,
      isExpired: activity.isExpired,
      isFull: activity.isFull
    });
  } catch (error) {
    console.error('獲取活動詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/activities
// @desc    創建新活動（僅管理員）
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  activityUpload.single('poster'),
  processActivityImage,
  body('title').trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('活動描述必須在1-1000個字符之間'),
  body('maxParticipants').isInt({ min: 1, max: 100 }).withMessage('人數限制必須在1-100之間'),
  body('price').isFloat({ min: 0 }).withMessage('費用不能為負數'),
  body('startDate').isISO8601().withMessage('請提供有效的開始時間'),
  body('endDate').isISO8601().withMessage('請提供有效的結束時間'),
  body('registrationDeadline').isISO8601().withMessage('請提供有效的報名截止時間'),
  body('location').trim().isLength({ min: 1 }).withMessage('活動地點不能為空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const {
      title,
      description,
      maxParticipants,
      price,
      startDate,
      endDate,
      registrationDeadline,
      location,
      requirements,
      coaches
    } = req.body;

    // 處理教練 ID 陣列 - 支援 FormData 陣列格式
    let coachIds = [];
    if (coaches) {
      if (Array.isArray(coaches)) {
        coachIds = coaches.map(coach => {
          if (typeof coach === 'string') {
            return coach;
          } else if (typeof coach === 'object' && coach._id) {
            return coach._id;
          }
          return null;
        }).filter(id => id !== null);
      } else if (typeof coaches === 'string') {
        coachIds = [coaches];
      }
    }
    
    // 處理 FormData 中的 coaches[0], coaches[1] 等格式
    const coachKeys = Object.keys(req.body).filter(key => key.startsWith('coaches['));
    if (coachKeys.length > 0) {
      coachIds = coachKeys.map(key => req.body[key]).filter(id => id);
    }

    // 使用上傳的圖片路徑（同時包含縮略圖）
    const posterPath = req.activityImages
      ? `/uploads/activities/${req.activityImages.fullFilename}`
      : (req.file ? `/uploads/activities/${req.file.filename}` : (poster || ''));
    const posterThumbPath = req.activityImages
      ? `/uploads/activities/${req.activityImages.thumbFilename}`
      : null;

    // 驗證時間邏輯 - 使用 parseLocalDateTime 正確處理時區
    const now = new Date();
    const start = parseLocalDateTime(startDate);
    const end = parseLocalDateTime(endDate);
    const deadline = parseLocalDateTime(registrationDeadline);

    if (deadline >= start) {
      return res.status(400).json({ 
        message: '報名截止時間必須早於活動開始時間' 
      });
    }

    if (start >= end) {
      return res.status(400).json({ 
        message: '活動開始時間必須早於結束時間' 
      });
    }

    const activity = new Activity({
      title,
      description,
      poster: posterPath,
      posterThumb: posterThumbPath,
      maxParticipants,
      price,
      startDate: start,
      endDate: end,
      registrationDeadline: deadline,
      location,
      requirements,
      organizer: req.user.id,
      coaches: coachIds
    });

    await activity.save();

    console.log(`🎯 管理員創建新活動: ${activity.title} (${activity._id})`);

    res.status(201).json({
      message: '活動創建成功',
      activity
    });
  } catch (error) {
    console.error('創建活動錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   POST /api/activities/:id/register
// @desc    用戶報名活動
// @access  Private
router.post('/:id/register', [
  auth,
  body('participantCount').isInt({ min: 1, max: 10 }).withMessage('參加人數必須在1-10之間'),
  body('contactInfo.email').isEmail().withMessage('請提供有效的電子郵件地址'),
  body('contactInfo.phone').matches(/^[0-9+\-\s()]+$/).withMessage('請提供有效的電話號碼'),
  body('notes').optional().isLength({ max: 200 }).withMessage('備註不能超過200個字符'),
  body('redeemCodeId').optional().isMongoId().withMessage('請提供有效的兌換碼ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { participantCount, contactInfo, notes, redeemCodeId } = req.body;
    const activityId = req.params.id;
    const userId = req.user.id;

    // 檢查活動是否存在
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    // 檢查活動是否可報名
    if (!activity.canRegister) {
      if (activity.isExpired) {
        return res.status(400).json({ message: '活動報名已截止' });
      }
      if (activity.isFull) {
        return res.status(400).json({ message: '活動人數已滿' });
      }
      return res.status(400).json({ message: '活動不可報名' });
    }

    // 檢查用戶是否已報名
    const existingRegistration = await ActivityRegistration.findOne({
      activity: activityId,
      user: userId
    });

    if (existingRegistration) {
      return res.status(400).json({ message: '您已經報名此活動' });
    }

    // 檢查剩餘名額
    const currentRegistrations = await ActivityRegistration.find({
      activity: activityId,
      status: 'registered'
    });

    const totalRegistered = currentRegistrations.reduce((sum, reg) => sum + reg.participantCount, 0);
    const availableSpots = activity.maxParticipants - totalRegistered;

    if (participantCount > availableSpots) {
      return res.status(400).json({ 
        message: `人數已到上限，剩餘名額：${availableSpots}人` 
      });
    }

    // 計算總費用
    const baseCost = activity.price * participantCount;
    let totalCost = baseCost;
    let discountAmount = 0;
    let redeemCode = null;

    // 處理兌換碼
    if (redeemCodeId) {
      redeemCode = await RedeemCode.findById(redeemCodeId);
      
      if (!redeemCode || !redeemCode.isValid()) {
        return res.status(400).json({ message: '兌換碼無效或已過期' });
      }

      // 檢查適用範圍（僅以此為準）
      if (!redeemCode.applicableTypes.includes('all') && 
          !redeemCode.applicableTypes.includes('activity')) {
        return res.status(400).json({ message: '此兌換碼不適用於活動報名' });
      }

      // 檢查最低消費金額
      if (baseCost < redeemCode.minAmount) {
        return res.status(400).json({ 
          message: `此兌換碼需要最低消費 HK$${redeemCode.minAmount}` 
        });
      }

      // 檢查用戶是否可以使用
      const userUsageCount = await RedeemUsage.countDocuments({
        redeemCode: redeemCodeId,
        user: userId
      });
      
      if (userUsageCount >= redeemCode.userUsageLimit) {
        return res.status(400).json({ message: '您已超過此兌換碼的使用次數限制' });
      }

      // 計算折扣
      discountAmount = redeemCode.calculateDiscount(baseCost);
      totalCost = baseCost - discountAmount;
    }

    // 檢查用戶積分餘額
    const userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance || userBalance.balance < totalCost) {
      return res.status(400).json({ 
        message: '積分餘額不足，請先充值' 
      });
    }

    // 扣除積分並記錄交易
    await userBalance.deductBalance(
      totalCost,
      `活動報名 - ${activity.title}${discountAmount > 0 ? ` (已使用兌換碼，折扣 ${discountAmount} 積分)` : ''}`,
      null
    );

    // 如果使用了兌換碼，記錄使用並更新統計
    if (redeemCode && discountAmount > 0) {
      const redeemUsage = new RedeemUsage({
        redeemCode: redeemCodeId,
        user: userId,
        orderType: 'activity',
        orderId: activityId,
        originalAmount: baseCost,
        discountAmount: discountAmount,
        finalAmount: totalCost,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      await redeemUsage.save();

      // 更新兌換碼統計
      redeemCode.totalUsed += 1;
      redeemCode.totalDiscount += discountAmount;
      await redeemCode.save();
    }

    // 創建報名記錄
    const registration = new ActivityRegistration({
      activity: activityId,
      user: userId,
      participantCount,
      totalCost,
      contactInfo,
      notes
    });

    await registration.save();

    // 更新活動當前報名人數
    activity.currentParticipants = totalRegistered + participantCount;
    await activity.save();

    // 發送報名確認電郵
    try {
      const activityData = activity.toObject ? activity.toObject() : activity;
      const registrationData = {
        _id: registration._id,
        participantCount,
        totalCost,
        contactInfo,
        notes,
        createdAt: registration.createdAt
      };

      await emailService.sendActivityRegistrationEmail(
        {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone
        },
        activityData,
        registrationData
      );
    } catch (emailError) {
      console.error('發送活動報名確認電郵失敗:', emailError);
    }

    console.log(`🎯 用戶報名活動: ${req.user.name} 報名 ${activity.title}，人數: ${participantCount}，原價: ${baseCost}積分，${discountAmount > 0 ? `折扣: ${discountAmount}積分，` : ''}實付: ${totalCost}積分`);

    res.status(201).json({
      message: '報名成功',
      registration: {
        id: registration._id,
        activity: activity.title,
        participantCount,
        totalCost,
        contactInfo,
        notes,
        createdAt: registration.createdAt
      }
    });
  } catch (error) {
    console.error('報名活動錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   POST /api/activities/:id/admin/registrations
// @desc    管理員為活動新增參加者
// @access  Private (Admin)
router.post('/:id/admin/registrations', [
  auth,
  adminAuth,
  body('userId').trim().notEmpty().withMessage('請選擇用戶'),
  body('participantCount').isInt({ min: 1, max: 10 }).withMessage('參加人數必須在1-10之間'),
  body('contactInfo.email').optional().isEmail().withMessage('請提供有效的電子郵件地址'),
  body('contactInfo.phone').optional().matches(/^[0-9+\-\s()]+$/).withMessage('請提供有效的電話號碼'),
  body('deductPoints').optional().isBoolean(),
  body('notes').optional().isLength({ max: 200 }).withMessage('備註不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0].msg
      });
    }

    const activityId = req.params.id;
    const {
      userId,
      participantCount,
      contactInfo = {},
      notes,
      deductPoints = false
    } = req.body;

    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    const existingRegistration = await ActivityRegistration.findOne({
      activity: activityId,
      user: userId
    });

    if (existingRegistration && existingRegistration.status === 'registered') {
      return res.status(400).json({ message: '該用戶已是此活動的參加者' });
    }

    const currentRegistrations = await ActivityRegistration.find({
      activity: activityId,
      status: 'registered'
    });

    const totalRegistered = currentRegistrations.reduce((sum, reg) => sum + reg.participantCount, 0);
    const availableSpots = activity.maxParticipants - totalRegistered;

    if (participantCount > availableSpots) {
      return res.status(400).json({
        message: `人數已到上限，剩餘名額：${availableSpots}人`
      });
    }

    const totalCost = activity.price * participantCount;

    let userBalance = null;
    if (deductPoints) {
      userBalance = await UserBalance.findOne({ user: userId });
      if (!userBalance || userBalance.balance < totalCost) {
        return res.status(400).json({ message: '用戶積分不足，無法扣除積分' });
      }
      await userBalance.deductBalance(
        totalCost,
        `活動報名 - ${activity.title}（管理員手動添加）`,
        null
      );
    }

    const finalEmail = contactInfo.email || user.email;
    const finalPhone = contactInfo.phone || user.phone;

    if (!finalEmail) {
      return res.status(400).json({ message: '請提供聯絡郵箱' });
    }

    if (!finalPhone) {
      return res.status(400).json({ message: '請提供聯絡電話' });
    }

    let registration;
    if (existingRegistration && existingRegistration.status !== 'registered') {
      existingRegistration.participantCount = participantCount;
      existingRegistration.totalCost = totalCost;
      existingRegistration.contactInfo = {
        email: finalEmail,
        phone: finalPhone
      };
      existingRegistration.notes = notes || '管理員手動重新添加';
      existingRegistration.status = 'registered';
      existingRegistration.paymentStatus = deductPoints ? 'paid' : 'pending';
      existingRegistration.cancelledAt = null;
      existingRegistration.cancellationReason = null;
      registration = await existingRegistration.save();
    } else {
      registration = new ActivityRegistration({
        activity: activityId,
        user: userId,
        participantCount,
        totalCost,
        contactInfo: {
          email: finalEmail,
          phone: finalPhone
        },
        notes: notes || '管理員手動添加',
        paymentStatus: deductPoints ? 'paid' : 'pending'
      });

      await registration.save();
    }

    const updatedTotal = await recalcActivityParticipantCount(activityId);
    const availableAfter = Math.max(0, activity.maxParticipants - updatedTotal);

  // 發送報名確認電郵
  try {
    const activityData = activity.toObject ? activity.toObject() : activity;
    const registrationData = {
      _id: registration._id,
      participantCount,
      totalCost,
      contactInfo: {
        email: finalEmail,
        phone: finalPhone
      },
      notes: registration.notes,
      createdAt: registration.createdAt
    };

    await emailService.sendActivityRegistrationEmail(
      {
        name: user.name,
        email: finalEmail,
        phone: finalPhone
      },
      activityData,
      registrationData
    );
  } catch (emailError) {
    console.error('管理員新增參加者後發送確認電郵失敗:', emailError);
  }

    await registration.populate('user', 'name email phone');

    res.status(201).json({
      message: '已新增活動參加者',
      registration: {
        _id: registration._id,
        user: registration.user,
        participantCount: registration.participantCount,
        totalCost: registration.totalCost,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        contactInfo: registration.contactInfo,
        notes: registration.notes,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt
      },
      stats: {
        totalRegistered: updatedTotal,
        availableSpots: availableAfter,
        maxParticipants: activity.maxParticipants
      }
    });
  } catch (error) {
    console.error('管理員新增活動參加者錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PATCH /api/activities/:activityId/admin/registrations/:registrationId/cancel
// @desc    管理員移除活動參加者
// @access  Private (Admin)
router.patch('/:activityId/admin/registrations/:registrationId/cancel', [
  auth,
  adminAuth,
  body('reason').optional().isLength({ max: 200 }).withMessage('原因不能超過200個字符'),
  body('refundPoints').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array()[0].msg
      });
    }

    const { activityId, registrationId } = req.params;
    const { reason, refundPoints = false } = req.body;

    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const registration = await ActivityRegistration.findOne({
      _id: registrationId,
      activity: activityId
    }).populate('user', 'name email phone');

    if (!registration) {
      return res.status(404).json({ message: '報名記錄不存在' });
    }

    if (registration.status !== 'registered') {
      return res.status(400).json({ message: '該報名記錄已處理' });
    }

    let refundedAmount = 0;
    if (refundPoints && registration.paymentStatus === 'paid') {
      const registrationUserId = registration.user?._id || registration.user;
      if (!registrationUserId) {
        return res.status(400).json({ message: '找不到用戶，無法退款' });
      }

      let userBalance = await UserBalance.findOne({ user: registrationUserId });
      if (!userBalance) {
        userBalance = new UserBalance({ user: registrationUserId });
      }
      await userBalance.refund(
        registration.totalCost,
        `活動報名退款 - ${activity.title}`,
        null
      );
      registration.paymentStatus = 'refunded';
      refundedAmount = registration.totalCost;
    }

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    registration.cancellationReason = reason || '管理員手動移除';
    await registration.save();

    const updatedTotal = await recalcActivityParticipantCount(activityId);
    const availableAfter = Math.max(0, activity.maxParticipants - updatedTotal);

    res.json({
      message: '已移除活動參加者',
      registration: {
        _id: registration._id,
        user: registration.user,
        participantCount: registration.participantCount,
        totalCost: registration.totalCost,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        contactInfo: registration.contactInfo,
        notes: registration.notes,
        cancelledAt: registration.cancelledAt,
        cancellationReason: registration.cancellationReason
      },
      stats: {
        totalRegistered: updatedTotal,
        availableSpots: availableAfter,
        maxParticipants: activity.maxParticipants,
        refundedAmount
      }
    });
  } catch (error) {
    console.error('管理員移除活動參加者錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/activities/:id/register
// @desc    取消活動報名
// @access  Private
router.delete('/:id/register', auth, async (req, res) => {
  try {
    const activityId = req.params.id;
    const userId = req.user.id;

    const registration = await ActivityRegistration.findOne({
      activity: activityId,
      user: userId,
      status: 'registered'
    }).populate('activity');

    if (!registration) {
      return res.status(404).json({ message: '未找到報名記錄' });
    }

    // 檢查是否可以取消 - 檢查活動開始時間
    const activity = await Activity.findById(activityId);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }
    
    const now = new Date();
    const activityStart = new Date(activity.startDate);
    if (now >= activityStart) {
      return res.status(400).json({ message: '活動已開始，無法取消' });
    }

    // 退還積分
    const userBalance = await UserBalance.findOne({ user: userId });
    if (userBalance) {
      userBalance.balance += registration.totalCost;
      userBalance.totalSpent -= registration.totalCost;
      await userBalance.save();
    }

    // 取消報名
    await registration.cancel('用戶主動取消');

    // 更新活動當前報名人數
    activity.currentParticipants = Math.max(0, activity.currentParticipants - registration.participantCount);
    await activity.save();

    console.log(`🎯 用戶取消活動報名: ${req.user.name} 取消 ${activity.title}，退還: ${registration.totalCost}積分`);

    res.json({
      message: '取消報名成功，積分已退還',
      refundedAmount: registration.totalCost
    });
  } catch (error) {
    console.error('取消報名錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   PUT /api/activities/:id
// @desc    更新活動（僅管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  activityUpload.single('poster'),
  processActivityImage,
  body('title').optional().trim().isLength({ min: 1, max: 100 }).withMessage('活動標題必須在1-100個字符之間'),
  body('description').optional().trim().isLength({ min: 1, max: 1000 }).withMessage('活動描述必須在1-1000個字符之間'),
  body('maxParticipants').optional().isInt({ min: 1, max: 100 }).withMessage('人數限制必須在1-100之間'),
  body('price').optional().isFloat({ min: 0 }).withMessage('費用不能為負數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const updates = req.body;
    
    // 如果有新上傳的圖片，使用新圖片與縮略圖路徑
    if (req.activityImages) {
      updates.poster = `/uploads/activities/${req.activityImages.fullFilename}`;
      updates.posterThumb = `/uploads/activities/${req.activityImages.thumbFilename}`;
    } else if (req.file) {
      updates.poster = `/uploads/activities/${req.file.filename}`;
    }
    
    // 處理教練 ID 陣列 - 支援 FormData 陣列格式
    if (updates.coaches) {
      if (Array.isArray(updates.coaches)) {
        updates.coaches = updates.coaches.map(coach => {
          if (typeof coach === 'string') {
            return coach;
          } else if (typeof coach === 'object' && coach._id) {
            return coach._id;
          }
          return null;
        }).filter(id => id !== null);
      } else if (typeof updates.coaches === 'string') {
        updates.coaches = [updates.coaches];
      }
    }
    
    // 處理 FormData 中的 coaches[0], coaches[1] 等格式
    const coachKeys = Object.keys(req.body).filter(key => key.startsWith('coaches['));
    if (coachKeys.length > 0) {
      updates.coaches = coachKeys.map(key => req.body[key]).filter(id => id);
    }
    
    // 處理日期時間字段 - 使用 parseLocalDateTime 正確處理時區
    const dateTimeFields = ['startDate', 'endDate', 'registrationDeadline'];
    dateTimeFields.forEach(field => {
      if (updates[field] !== undefined) {
        updates[field] = parseLocalDateTime(updates[field]);
      }
    });
    
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        activity[key] = updates[key];
      }
    });

    await activity.save();

    console.log(`🎯 管理員更新活動: ${activity.title} (${activity._id})`);

    res.json({
      message: '活動更新成功',
      activity
    });
  } catch (error) {
    console.error('更新活動錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   DELETE /api/activities/:id
// @desc    刪除活動（僅管理員）
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    // 軟刪除
    activity.isActive = false;
    await activity.save();
    
    // 刪除活動相關的圖片文件
    if (activity.poster) {
      const imagePath = path.join(__dirname, '../../uploads/activities', path.basename(activity.poster));
      await deleteFile(imagePath);
    }

    console.log(`🎯 管理員刪除活動: ${activity.title} (${activity._id})`);

    res.json({ message: '活動刪除成功' });
  } catch (error) {
    console.error('刪除活動錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

// @route   POST /api/activities/:activityId/admin/registrations/:registrationId/notify
// @desc    管理員向活動參加者發送提醒電郵
// @access  Private (Admin)
router.post('/:activityId/admin/registrations/:registrationId/notify', [
  auth,
  adminAuth
], async (req, res) => {
  try {
    const { activityId, registrationId } = req.params;

    const activity = await Activity.findById(activityId)
      .populate('coaches', 'name email')
      .lean();
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const registration = await ActivityRegistration.findOne({
      _id: registrationId,
      activity: activityId
    }).populate('user', 'name email phone');

    if (!registration) {
      return res.status(404).json({ message: '報名記錄不存在' });
    }

    if (registration.status !== 'registered') {
      return res.status(400).json({ message: '僅可向已報名的參加者發送提醒' });
    }

    const finalEmail = registration.contactInfo?.email || registration.user?.email;
    if (!finalEmail) {
      return res.status(400).json({ message: '找不到聯絡電郵，無法發送提醒' });
    }

    const finalPhone = registration.contactInfo?.phone || registration.user?.phone || '';

    try {
      await emailService.sendActivityReminderEmail(
        {
          name: registration.user?.name || '尊貴的用戶',
          email: finalEmail,
          phone: finalPhone
        },
        activity,
        {
          _id: registration._id,
          participantCount: registration.participantCount,
          totalCost: registration.totalCost,
          notes: registration.notes,
          createdAt: registration.createdAt,
          contactInfo: {
            email: finalEmail,
            phone: finalPhone
          }
        }
      );
    } catch (emailError) {
      console.error('發送活動提醒電郵失敗:', emailError);
      return res.status(500).json({ message: '提醒電郵發送失敗' });
    }

    res.json({ message: '提醒電郵已發送給參加者' });
  } catch (error) {
    console.error('管理員發送活動提醒電郵錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/activities/:id/admin/registrations/notify-all
// @desc    管理員向活動所有參加者批量發送提醒電郵
// @access  Private (Admin)
router.post('/:id/admin/registrations/notify-all', [
  auth,
  adminAuth
], async (req, res) => {
  try {
    const activityId = req.params.id;

    const activity = await Activity.findById(activityId)
      .populate('coaches', 'name email')
      .lean();
    if (!activity) {
      return res.status(404).json({ message: '活動不存在' });
    }

    const registrations = await ActivityRegistration.find({
      activity: activityId,
      status: 'registered'
    }).populate('user', 'name email phone');

    if (registrations.length === 0) {
      return res.status(400).json({ message: '目前沒有已報名的參加者' });
    }

    let successCount = 0;
    const failedRecipients = [];

    for (const registration of registrations) {
      const finalEmail = registration.contactInfo?.email || registration.user?.email;
      if (!finalEmail) {
        failedRecipients.push({
          registrationId: registration._id,
          reason: '缺少聯絡電郵'
        });
        continue;
      }

      const finalPhone = registration.contactInfo?.phone || registration.user?.phone || '';

      try {
        await emailService.sendActivityReminderEmail(
          {
            name: registration.user?.name || '尊貴的用戶',
            email: finalEmail,
            phone: finalPhone
          },
          activity,
          {
            _id: registration._id,
            participantCount: registration.participantCount,
            totalCost: registration.totalCost,
            notes: registration.notes,
            createdAt: registration.createdAt,
            contactInfo: {
              email: finalEmail,
              phone: finalPhone
            }
          }
        );
        successCount += 1;
      } catch (emailError) {
        console.error(`發送活動提醒電郵失敗 (${registration._id}):`, emailError);
        failedRecipients.push({
          registrationId: registration._id,
          reason: emailError.message || '未知錯誤'
        });
      }
    }

    res.json({
      message: `提醒電郵已發送完成。成功 ${successCount} 位，失敗 ${failedRecipients.length} 位。`,
      successCount,
      failed: failedRecipients
    });
  } catch (error) {
    console.error('管理員批量發送活動提醒電郵錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
