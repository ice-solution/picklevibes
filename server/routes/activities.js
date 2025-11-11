const express = require('express');
const { body, validationResult } = require('express-validator');
const Activity = require('../models/Activity');
const ActivityRegistration = require('../models/ActivityRegistration');
const UserBalance = require('../models/UserBalance');
const User = require('../models/User');
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
// @desc    獲取所有活動列表
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { isActive: true };
    if (status) {
      query.status = status;
    }
    
    const activities = await Activity.find(query)
      .populate('organizer', 'name email')
      .populate('coaches', 'name email')
      .sort({ startDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
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

    // 使用上傳的圖片路徑，如果沒有上傳則使用默認值
    const posterPath = req.file ? `/uploads/activities/${req.file.filename}` : (poster || '');

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
  body('notes').optional().isLength({ max: 200 }).withMessage('備註不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { participantCount, contactInfo, notes } = req.body;
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
    const totalCost = activity.price * participantCount;

    // 檢查用戶積分餘額
    const userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance || userBalance.balance < totalCost) {
      return res.status(400).json({ 
        message: '積分餘額不足，請先充值' 
      });
    }

    // 扣除積分
    userBalance.balance -= totalCost;
    userBalance.totalSpent += totalCost;
    await userBalance.save();

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

    console.log(`🎯 用戶報名活動: ${req.user.name} 報名 ${activity.title}，人數: ${participantCount}，費用: ${totalCost}積分`);

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
      user: userId,
      status: 'registered'
    });

    if (existingRegistration) {
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
      userBalance.balance -= totalCost;
      userBalance.totalSpent += totalCost;
      await userBalance.save();
    }

    const finalEmail = contactInfo.email || user.email;
    const finalPhone = contactInfo.phone || user.phone;

    if (!finalEmail) {
      return res.status(400).json({ message: '請提供聯絡郵箱' });
    }

    if (!finalPhone) {
      return res.status(400).json({ message: '請提供聯絡電話' });
    }

    const registration = new ActivityRegistration({
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

    const updatedTotal = await recalcActivityParticipantCount(activityId);
    const availableAfter = Math.max(0, activity.maxParticipants - updatedTotal);

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
      userBalance.balance += registration.totalCost;
      userBalance.totalRecharged += registration.totalCost;
      await userBalance.save();
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

    const registrations = await ActivityRegistration.find(query)
      .populate({
        path: 'activity',
        select: 'title description startDate endDate location status poster'
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ActivityRegistration.countDocuments(query);

    res.json({
      registrations,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('獲取用戶報名記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
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
    });

    if (!registration) {
      return res.status(404).json({ message: '未找到報名記錄' });
    }

    // 檢查是否可以取消
    if (!registration.canCancel) {
      return res.status(400).json({ message: '報名已截止，無法取消' });
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
    const activity = await Activity.findById(activityId);
    if (activity) {
      activity.currentParticipants = Math.max(0, activity.currentParticipants - registration.participantCount);
      await activity.save();
    }

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
    
    // 如果有新上傳的圖片，使用新圖片路徑
    if (req.file) {
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

module.exports = router;
