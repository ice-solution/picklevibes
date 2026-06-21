const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Recharge = require('../models/Recharge');
const Store = require('../models/Store');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');
const emailService = require('../services/emailService');
const {
  isBookingEligibleForSettle,
  suggestedSettlePoints,
  settleBookingWithPoints,
} = require('../services/bookingSettleService');

const router = express.Router();

async function resolveManualAdjustStoreCourt(storeId, courtId) {
  const store = await Store.findById(storeId);
  if (!store) {
    const err = new Error('店鋪不存在');
    err.status = 404;
    throw err;
  }
  if (!courtId) return { store, court: null };

  const court = await Court.findById(courtId);
  if (!court) {
    const err = new Error('場地不存在');
    err.status = 404;
    throw err;
  }
  if (String(court.store) !== String(store._id)) {
    const err = new Error('場地不屬於所選店鋪');
    err.status = 400;
    throw err;
  }
  return { store, court };
}

function isBookingEligibleForManualDeduct(booking, linkedBookingIds) {
  return isBookingEligibleForSettle(booking) && !linkedBookingIds.has(String(booking._id));
}

function suggestedDeductPoints(booking) {
  return suggestedSettlePoints(booking);
}

async function resolveBookingForManualDeduct(bookingId, userId) {
  const booking = await Booking.findById(bookingId)
    .populate('store', 'name slug')
    .populate({ path: 'court', select: 'name store', populate: { path: 'store', select: 'name slug' } });

  if (!booking) {
    const err = new Error('預約不存在');
    err.status = 404;
    throw err;
  }
  if (String(booking.user) !== String(userId)) {
    const err = new Error('預約不屬於此用戶');
    err.status = 400;
    throw err;
  }

  const existingLink = await Recharge.findOne({
    booking: bookingId,
    pointsDeducted: true,
    status: 'completed',
  });
  if (existingLink) {
    const err = new Error('此預約已有手動扣積分記錄');
    err.status = 400;
    throw err;
  }

  if (!isBookingEligibleForManualDeduct(booking, new Set())) {
    const err = new Error('此預約不可再扣積分（可能已付款或已取消）');
    err.status = 400;
    throw err;
  }

  const storeDoc = booking.store?._id
    ? booking.store
    : booking.court?.store?._id
      ? booking.court.store
      : await Store.findById(booking.store || booking.court?.store);
  if (!storeDoc) {
    const err = new Error('無法解析預約所屬店鋪');
    err.status = 400;
    throw err;
  }

  return {
    booking,
    store: storeDoc,
    court: booking.court?._id ? booking.court : null,
  };
}

// @route   GET /api/users
// @desc    獲取所有用戶列表 (僅管理員)
// @access  Private (Admin)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 10, role, membershipLevel, search, searchType } = req.query;
    
    const query = {};
    if (role) query.role = role;
    if (membershipLevel) query.membershipLevel = membershipLevel;

    const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 添加搜索功能
    if (search) {
      const safeSearch = escapeRegex(search);
      if (searchType) {
        // 指定搜索類型
        if (searchType === 'name') {
          query.name = { $regex: safeSearch, $options: 'i' }; // 不區分大小寫的模糊搜索
        } else if (searchType === 'email') {
          query.email = { $regex: safeSearch, $options: 'i' }; // 不區分大小寫的模糊搜索
        } else if (searchType === 'phone') {
          query.phone = { $regex: safeSearch, $options: 'i' }; // 不區分大小寫的模糊搜索
        }
      } else {
        // 沒有指定搜索類型時，同時搜索姓名、郵箱與電話
        query.$or = [
          { name: { $regex: safeSearch, $options: 'i' } },
          { email: { $regex: safeSearch, $options: 'i' } },
          { phone: { $regex: safeSearch, $options: 'i' } }
        ];
      }
    }
    
    const users = await User.find(query)
      .select('-password') // 排除密碼
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // 為每個用戶添加積分信息
    const usersWithBalance = await Promise.all(users.map(async (user) => {
      const balance = await UserBalance.findOne({ user: user._id });
      return {
        ...user.toObject(),
        balance: balance ? balance.balance : 0,
        totalRecharged: balance ? balance.totalRecharged : 0,
        totalSpent: balance ? balance.totalSpent : 0
      };
    }));
    
    const total = await User.countDocuments(query);
    
    res.json({
      users: usersWithBalance,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取用戶列表錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/stats
// @desc    獲取用戶統計信息 (僅管理員)
// @access  Private (Admin)
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const coachUsers = await User.countDocuments({ role: 'coach' });
    const vipUsers = await User.countDocuments({ membershipLevel: 'vip' });
    
    // 按會員等級統計
    const membershipStats = await User.aggregate([
      {
        $group: {
          _id: '$membershipLevel',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 按角色統計
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      totalUsers,
      activeUsers,
      adminUsers,
      coachUsers,
      vipUsers,
      membershipStats,
      roleStats
    });
  } catch (error) {
    console.error('獲取用戶統計錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id
// @desc    獲取單個用戶詳情 (僅管理員)
// @access  Private (Admin)
router.get('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取用戶積分信息
    const balance = await UserBalance.findOne({ user: user._id });
    const userWithBalance = {
      ...user.toObject(),
      balance: balance ? balance.balance : 0,
      totalRecharged: balance ? balance.totalRecharged : 0,
      totalSpent: balance ? balance.totalSpent : 0,
      recentTransactions: balance ? balance.transactions.slice(-10).reverse() : []
    };
    
    res.json({ user: userWithBalance });
  } catch (error) {
    console.error('獲取用戶詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/profile
// @desc    管理員修改用戶資料（姓名、電話）
// @access  Private (Admin)
router.put('/:id/profile', [
  auth,
  adminAuth,
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在2-50個字符之間'),
  body('phone').optional().trim().matches(/^[0-9+\-\s()]+$/).withMessage('請輸入有效的電話號碼')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name, phone } = req.body;
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    await user.save();
    res.json({
      message: '用戶資料已更新',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('更新用戶資料錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/role
// @desc    更新用戶角色 (僅管理員)
// @access  Private (Admin)
router.put('/:id/role', [
  auth,
  adminAuth,
  body('role').isIn(['user', 'admin', 'coach']).withMessage('角色必須是 user、admin 或 coach')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { role } = req.body;
    const userId = req.params.id;
    
    // 不能修改自己的角色
    if (userId === req.user.id) {
      return res.status(400).json({ message: '不能修改自己的角色' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新角色
    user.role = role;
    await user.save();
    
    res.json({
      message: '用戶角色更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('更新用戶角色錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/membership
// @desc    更新用戶會員等級 (僅管理員)
// @access  Private (Admin)
router.put('/:id/membership', [
  auth,
  adminAuth,
  body('membershipLevel').isIn(['basic', 'premium', 'vip']).withMessage('會員等級必須是 basic、premium 或 vip')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { membershipLevel } = req.body;
    const userId = req.params.id;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新會員等級
    user.membershipLevel = membershipLevel;
    await user.save();
    
    res.json({
      message: '用戶會員等級更新成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel
      }
    });
  } catch (error) {
    console.error('更新用戶會員等級錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/status
// @desc    更新用戶狀態 (啟用/禁用) (僅管理員)
// @access  Private (Admin)
router.put('/:id/status', [
  auth,
  adminAuth,
  body('isActive').isBoolean().withMessage('狀態必須是布爾值')
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
    const userId = req.params.id;
    
    // 不能禁用自己
    if (userId === req.user.id && !isActive) {
      return res.status(400).json({ message: '不能禁用自己的帳戶' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 更新狀態
    user.isActive = isActive;
    await user.save();
    
    res.json({
      message: `用戶已${isActive ? '啟用' : '禁用'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipLevel: user.membershipLevel,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('更新用戶狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/users/:id/manual-recharge
// @desc    管理員手動為用戶充值積分 (僅管理員)
// @access  Private (Admin)
router.post('/:id/manual-recharge', [
  auth,
  adminAuth,
  body('points').isInt({ min: 1 }).withMessage('充值積分必須是正整數'),
  body('reason').trim().isLength({ min: 1, max: 200 }).withMessage('充值原因必須在1-200個字符之間'),
  body('storeId').notEmpty().withMessage('請選擇歸屬店鋪'),
  body('courtId').optional({ nullable: true }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { points, reason, storeId, courtId } = req.body;
    const userId = req.params.id;
    
    const { store, court } = await resolveManualAdjustStoreCourt(storeId, courtId || null);
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取或創建用戶餘額記錄
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId });
    }
    
    // 創建充值記錄（模擬完整支付流程）
    const recharge = new Recharge({
      user: userId,
      points: points,
      amount: points, // 1積分 = 1港幣
      status: 'completed', // 直接完成
      paymentIntentId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 生成唯一ID
      description: `管理員手動充值 - ${reason}`,
      store: store._id,
      court: court?._id || null,
      adjustedBy: req.user._id,
      payment: {
        status: 'paid',
        method: 'manual',
        paidAt: new Date(),
        transactionId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      pointsAdded: true, // 手動充值直接標記為已添加
      pointsDeducted: false
    });
    await recharge.save();
    
    // 增加用戶積分
    await userBalance.addBalance(
      points, 
      `管理員手動充值 - ${reason} (管理員: ${req.user.name})`
    );
    
    // 更新充值記錄的關聯
    const latestTransaction = userBalance.transactions[userBalance.transactions.length - 1];
    if (latestTransaction) {
      latestTransaction.relatedBooking = null; // 手動充值不關聯預約
    }
    
    res.json({
      message: '手動充值成功',
      recharge: {
        id: recharge._id,
        points: points,
        amount: points,
        reason: reason,
        store: { id: store._id, name: store.name },
        court: court ? { id: court._id, name: court.name } : null,
        adminName: req.user.name,
        completedAt: recharge.payment.paidAt
      },
      userBalance: {
        balance: userBalance.balance,
        totalRecharged: userBalance.totalRecharged,
        totalSpent: userBalance.totalSpent
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('手動充值錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id/deductible-bookings
// @desc    獲取可關聯手動扣積分的預約列表 (僅管理員)
// @access  Private (Admin)
router.get('/:id/deductible-bookings', [auth, adminAuth], async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    const linkedBookingIds = new Set(
      (await Recharge.distinct('booking', {
        booking: { $ne: null },
        pointsDeducted: true,
        status: 'completed',
      })).map(String)
    );

    const bookings = await Booking.find({
      user: userId,
      status: { $in: ['pending', 'confirmed', 'completed'] },
    })
      .populate('store', 'name slug')
      .populate({ path: 'court', select: 'name number type store', populate: { path: 'store', select: 'name slug' } })
      .sort({ date: -1, startTime: -1 })
      .limit(80)
      .lean();

    const deductibleBookings = bookings
      .filter((b) => isBookingEligibleForManualDeduct(b, linkedBookingIds))
      .map((b) => {
        const storeName = b.store?.name || b.court?.store?.name || '未指定店鋪';
        const courtName = b.court?.name || '';
        const dateStr = new Intl.DateTimeFormat('zh-HK', {
          timeZone: 'Asia/Hong_Kong',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(b.date));
        const suggested = suggestedDeductPoints(b);
        return {
          _id: b._id,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
          status: b.status,
          store: b.store || b.court?.store || null,
          court: b.court,
          pricing: b.pricing,
          payment: b.payment,
          suggestedPoints: suggested,
          label: `${dateStr} ${b.startTime}–${b.endTime} ${courtName}（${storeName}）${suggested > 0 ? ` · ${suggested}分` : ''}`,
        };
      });

    res.json({ bookings: deductibleBookings });
  } catch (error) {
    console.error('獲取可扣積分預約錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/users/:id/manual-deduct
// @desc    管理員手動扣除用戶積分 (僅管理員)
// @access  Private (Admin)
router.post('/:id/manual-deduct', [
  auth,
  adminAuth,
  body('points').isInt({ min: 1 }).withMessage('扣除積分必須是正整數'),
  body('reason').trim().isLength({ min: 1, max: 200 }).withMessage('扣除原因必須在1-200個字符之間'),
  body('bookingId').optional({ nullable: true }),
  body('storeId').optional({ nullable: true }),
  body('courtId').optional({ nullable: true }),
  body('bypassRestrictions').optional().isBoolean().withMessage('bypassRestrictions必須是布爾值')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { points, reason, bookingId, storeId, courtId, bypassRestrictions = false } = req.body;
    const userId = req.params.id;

    if (!bypassRestrictions && !bookingId && !storeId) {
      return res.status(400).json({ message: '請選擇關聯預約或歸屬店鋪' });
    }

    let store;
    let court = null;
    let booking = null;

    if (bookingId) {
      const resolved = await resolveBookingForManualDeduct(bookingId, userId);
      booking = resolved.booking;
      store = resolved.store;
      court = resolved.court;
    } else if (storeId) {
      const resolved = await resolveManualAdjustStoreCourt(storeId, courtId || null);
      store = resolved.store;
      court = resolved.court;
    }
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    let userBalance = null;
    let deductRecord = null;

    // 如果不是管理員 bypass，才檢查用戶積分記錄
    if (!bypassRestrictions) {
      if (bookingId) {
        const result = await settleBookingWithPoints({
          bookingId,
          targetUserId: userId,
          points,
          reason,
          adminUser: req.user,
          allowReassign: false,
        });
        return res.json({
          message: '手動扣除成功',
          deduct: {
            id: result.deductRecord._id,
            points,
            reason,
            booking: { id: result.booking._id },
            store: result.booking.store
              ? { id: result.booking.store._id, name: result.booking.store.name }
              : null,
            court: result.booking.court
              ? { id: result.booking.court._id, name: result.booking.court.name }
              : null,
            adminName: req.user.name,
            completedAt: result.deductRecord.payment.paidAt,
          },
          userBalance: result.userBalance,
        });
      }

      // 獲取用戶餘額記錄
      userBalance = await UserBalance.findOne({ user: userId });
      if (!userBalance) {
        return res.status(400).json({ message: '用戶沒有積分記錄' });
      }
      
      // 檢查餘額是否足夠
      if (userBalance.balance < points) {
        return res.status(400).json({ 
          message: `餘額不足！當前餘額：${userBalance.balance}，嘗試扣除：${points}` 
        });
      }
      
      // 扣除用戶積分
      await userBalance.deductBalance(
        points, 
        `管理員手動扣除 - ${reason} (管理員: ${req.user.name})`
      );
      
      // 創建扣除記錄（用於審計）
      deductRecord = new Recharge({
        user: userId,
        points: points,
        amount: points, // 1積分 = 1港幣
        status: 'completed', // 直接完成
        paymentIntentId: `manual_deduct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // 生成唯一ID
        description: booking
          ? `預約扣積分 - ${reason}`
          : `管理員手動扣除 - ${reason}`,
        store: store._id,
        court: court?._id || null,
        booking: booking?._id || null,
        adjustedBy: req.user._id,
        payment: {
          status: 'paid',
          method: 'manual',
          paidAt: new Date(),
          transactionId: `manual_deduct_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        pointsAdded: false, // 扣除操作
        pointsDeducted: true // 標記為扣除
      });
      await deductRecord.save();

      if (booking) {
        booking.payment.method = 'points';
        booking.payment.pointsDeducted = points;
        booking.payment.originalPrice = booking.pricing?.totalPrice || points;
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        booking.noUserBalanceDebited = false;
        booking.pricing.pointsDeducted = points;
        await booking.save();
      }
    } else {
      // 管理員 bypass 模式：只記錄但不實際扣除積分
      console.log(`🎯 管理員繞過積分扣除: ${user.name} - ${points}分 (${reason}) [BYPASS模式]`);
    }
    
    console.log(`🎯 管理員手動扣除積分: ${user.name} - ${points}分 (${reason})`);
    
    res.json({
      message: bypassRestrictions ? '手動扣除成功 (已繞過積分檢查)' : '手動扣除成功',
      deduct: {
        id: bypassRestrictions ? null : deductRecord._id,
        points: points,
        reason: reason,
        booking: booking ? { id: booking._id } : null,
        store: store ? { id: store._id, name: store.name } : null,
        court: court ? { id: court._id, name: court.name } : null,
        adminName: req.user.name,
        completedAt: bypassRestrictions ? new Date() : deductRecord.payment.paidAt
      },
      userBalance: bypassRestrictions ? null : {
        balance: userBalance.balance,
        totalRecharged: userBalance.totalRecharged,
        totalSpent: userBalance.totalSpent
      }
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error('手動扣除錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id/balance-history
// @desc    獲取用戶積分歷史記錄 (僅管理員)
// @access  Private (Admin)
router.get('/:id/balance-history', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const userId = req.params.id;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取用戶餘額記錄
    const userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      return res.json({
        balance: 0,
        totalRecharged: 0,
        totalSpent: 0,
        transactions: [],
        pagination: { current: 1, pages: 0, total: 0, limit: limitNum }
      });
    }
    
    // 過濾交易類型
    let transactions = userBalance.transactions.slice();
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 分頁
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    res.json({
      balance: userBalance.balance,
      totalRecharged: userBalance.totalRecharged,
      totalSpent: userBalance.totalSpent,
      transactions: paginatedTransactions,
      pagination: {
        current: pageNum,
        pages: Math.ceil(transactions.length / limitNum),
        total: transactions.length,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error('獲取積分歷史錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/:id/recharge-records
// @desc    獲取用戶充值記錄 (僅管理員)
// @access  Private (Admin)
router.get('/:id/recharge-records', [auth, adminAuth], async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = req.params.id;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 構建查詢條件
    const query = { user: userId };
    if (status) {
      query.status = status;
    }
    
    // 獲取充值記錄
    const rechargeRecords = await Recharge.find(query)
      .populate('redeemCode', 'code name')
      .populate('store', 'name slug')
      .populate('court', 'name number')
      .populate('booking', 'date startTime endTime')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Recharge.countDocuments(query);
    
    res.json({
      rechargeRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('獲取充值記錄錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/recharge-records/:rechargeId/status
// @desc    更新充值記錄狀態 (僅管理員)
// @access  Private (Admin)
router.put('/:id/recharge-records/:rechargeId/status', [
  auth,
  adminAuth,
  body('status').isIn(['pending', 'completed', 'failed', 'cancelled']).withMessage('無效的狀態值'),
  body('reason').optional().trim().isLength({ max: 200 }).withMessage('原因不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }
    
    const { status, reason } = req.body;
    const { id: userId, rechargeId } = req.params;
    
    // 檢查用戶是否存在
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 獲取充值記錄
    const recharge = await Recharge.findById(rechargeId);
    if (!recharge) {
      return res.status(404).json({ message: '充值記錄不存在' });
    }
    
    // 檢查是否屬於該用戶
    if (recharge.user.toString() !== userId) {
      return res.status(403).json({ message: '無權限操作此充值記錄' });
    }
    
    const oldStatus = recharge.status;
    const oldPaymentStatus = recharge.payment.status;
    
    // 更新狀態
    recharge.status = status;
    recharge.payment.status = status === 'completed' ? 'paid' : 
                            status === 'failed' ? 'failed' : 
                            status === 'cancelled' ? 'refunded' : 'pending';
    
    if (status === 'completed' && oldStatus !== 'completed') {
      recharge.payment.paidAt = new Date();
    } else if (status === 'cancelled' && oldStatus !== 'cancelled') {
      recharge.payment.refundedAt = new Date();
    }
    
    // 確保 paymentIntentId 存在（如果沒有則生成一個）
    if (!recharge.paymentIntentId) {
      recharge.paymentIntentId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    await recharge.save();
    
    // 處理積分變更
    let userBalance = await UserBalance.findOne({ user: userId });
    if (!userBalance) {
      userBalance = new UserBalance({ user: userId });
    }
    
    // 如果從非完成狀態變為完成狀態，且尚未添加過積分
    if (status === 'completed' && oldStatus !== 'completed' && !recharge.pointsAdded) {
      await userBalance.addBalance(
        recharge.points, 
        `充值確認 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsAdded = true;
      recharge.pointsDeducted = false; // 重置扣除標記
    }
    // 如果從完成狀態變為取消狀態，且尚未扣除過積分
    else if (status === 'cancelled' && oldStatus === 'completed' && !recharge.pointsDeducted) {
      await userBalance.deductBalance(
        recharge.points, 
        `充值取消 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsDeducted = true;
      recharge.pointsAdded = false; // 重置添加標記
    }
    // 如果從取消狀態變為完成狀態，且尚未重新添加過積分
    else if (status === 'completed' && oldStatus === 'cancelled' && !recharge.pointsAdded) {
      await userBalance.addBalance(
        recharge.points, 
        `充值重新確認 - ${recharge.description}${reason ? ` (${reason})` : ''}`
      );
      recharge.pointsAdded = true;
      recharge.pointsDeducted = false; // 重置扣除標記
    }
    // 如果變為失敗狀態，重置所有標記
    else if (status === 'failed') {
      recharge.pointsAdded = false;
      recharge.pointsDeducted = false;
    }
    
    // 保存更新後的記錄
    await recharge.save();
    
    res.json({
      message: '充值狀態更新成功',
      recharge: {
        id: recharge._id,
        status: recharge.status,
        paymentStatus: recharge.payment.status,
        points: recharge.points,
        amount: recharge.amount,
        updatedAt: recharge.updatedAt
      },
      userBalance: {
        balance: userBalance.balance,
        totalRecharged: userBalance.totalRecharged,
        totalSpent: userBalance.totalSpent
      }
    });
  } catch (error) {
    console.error('更新充值狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/users/:id
// @desc    刪除用戶 (僅管理員)
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const userId = req.params.id;
    
    // 不能刪除自己
    if (userId === req.user.id) {
      return res.status(400).json({ message: '不能刪除自己的帳戶' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    await User.findByIdAndDelete(userId);
    
    res.json({
      message: '用戶刪除成功',
      deletedUser: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('刪除用戶錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/users/:id/membership
// @desc    設置用戶會員等級 (僅管理員)
// @access  Private (Admin)
router.put('/:id/membership', [auth, adminAuth], async (req, res) => {
  try {
    const userId = req.params.id;
    const { membershipLevel, days = 180 } = req.body; // 默認180天
    
    // 驗證會員等級
    if (!['basic', 'vip'].includes(membershipLevel)) {
      return res.status(400).json({ message: '無效的會員等級' });
    }
    
    // 驗證 VIP 期限
    if (membershipLevel === 'vip' && (!days || days < 1 || days > 365)) {
      return res.status(400).json({ message: 'VIP 期限必須在 1-365 天之間' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }
    
    // 如果設置為VIP，計算到期日期
    if (membershipLevel === 'vip') {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
      
      user.membershipLevel = 'vip';
      user.membershipExpiry = expiryDate;
      
      console.log(`👤 管理員更新用戶 ${user.name} 為 VIP 會員，期限: ${days} 天`);
    } else {
      user.membershipLevel = 'basic';
      user.membershipExpiry = null;
      
      console.log(`👤 管理員更新用戶 ${user.name} 為普通會員`);
    }
    
    await user.save();
    
    res.json({
      message: `用戶會員等級已更新為 ${membershipLevel === 'vip' ? `VIP會員 (${days}天)` : '普通會員'}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        membershipLevel: user.membershipLevel,
        membershipExpiry: user.membershipExpiry
      }
    });
  } catch (error) {
    console.error('更新會員等級錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/users/check-membership
// @desc    手動觸發：VIP 餘 1 整日續期 + 過期降級（與每日排程相同邏輯）
// @access  Private (Admin)
router.get('/check-membership', [auth, adminAuth], async (req, res) => {
  try {
    const { runDailyMembershipJobs } = require('../utils/membershipChecker');
    const result = await runDailyMembershipJobs();

    res.json({
      message: `會員任務完成：續期 ${result.renewedCount ?? 0} 人，過期降級 ${result.expiredCount ?? 0} 人`,
      renewedCount: result.renewedCount ?? 0,
      expiredCount: result.expiredCount ?? 0,
      totalVipUsers: result.totalVipUsers
    });
  } catch (error) {
    console.error('檢查會員狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/users/create
// @desc    管理員創建新用戶
// @access  Private (Admin)
router.post('/create', [
  auth, 
  adminAuth,
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在2-50個字符之間'),
  body('email').isEmail().withMessage('請提供有效的電子郵件地址'),
  body('password')
    .isLength({ min: 8 }).withMessage('密碼至少需要8個字符')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('密碼必須包含至少一個字母和一個數字'),
  body('phone').matches(/^[0-9]+$/).withMessage('電話號碼只能包含數字'),
  body('role').optional().isIn(['user', 'admin', 'coach']).withMessage('無效的角色'),
  body('membershipLevel').optional().isIn(['basic', 'vip']).withMessage('無效的會員等級'),
  body('vipDays').optional().isInt({ min: 1, max: 365 }).withMessage('VIP 期限必須在 1-365 天之間')
], async (req, res) => {
  try {
    // 驗證輸入
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { 
      name, 
      email, 
      password, 
      phone, 
      role = 'user', 
      membershipLevel = 'basic',
      vipDays = 30,
      sendWelcomeEmail = true
    } = req.body;

    // 檢查用戶是否已存在
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        message: '該電子郵件地址已被使用' 
      });
    }

    // 創建新用戶
    const userData = {
      name,
      email,
      password,
      phone,
      role,
      membershipLevel
    };

    // 如果設置為 VIP，計算到期日期
    if (membershipLevel === 'vip') {
      const now = new Date();
      const expiryDate = new Date(now.getTime() + (vipDays * 24 * 60 * 60 * 1000));
      userData.membershipExpiry = expiryDate;
    }

    const user = new User(userData);
    await user.save();

    // 為新用戶創建積分記錄
    const userBalance = new UserBalance({
      user: user._id,
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0
    });
    await userBalance.save();

    console.log(`👤 管理員創建新用戶: ${user.name} (${user.email}), 角色: ${user.role}, 會員等級: ${user.membershipLevel}`);

    // 發送歡迎郵件（如果選擇發送）
    if (sendWelcomeEmail) {
      try {
        const welcomeEmailData = {
          name: user.name,
          email: user.email,
          password: password, // 使用原始密碼（未加密）
          role: user.role,
          membershipLevel: user.membershipLevel,
          membershipExpiry: user.membershipExpiry
        };
        
        await emailService.sendWelcomeEmail(welcomeEmailData);
        console.log(`📧 歡迎郵件已發送給新用戶: ${user.email}`);
      } catch (emailError) {
        console.error('❌ 發送歡迎郵件失敗:', emailError.message);
        // 不影響用戶創建，只記錄錯誤
      }
    } else {
      console.log(`📧 管理員選擇不發送歡迎郵件給新用戶: ${user.email}`);
    }

    res.status(201).json({
      message: '用戶創建成功',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        membershipLevel: user.membershipLevel,
        membershipExpiry: user.membershipExpiry,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('創建用戶錯誤:', error);
    res.status(500).json({ 
      message: '服務器錯誤，請稍後再試' 
    });
  }
});

module.exports = router;
