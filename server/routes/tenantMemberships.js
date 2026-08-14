const express = require('express');
const { body, validationResult } = require('express-validator');
const TenantMembership = require('../models/TenantMembership');
const User = require('../models/User');
const UserBalance = require('../models/UserBalance');
const Store = require('../models/Store');
const { auth, platformAdminAuth } = require('../middleware/auth');

const router = express.Router();

const ALL_STORES = '__all__';

function collectStoreTokens(storeId, storeIds) {
  const tokens = [];
  const push = (value) => {
    if (value == null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    tokens.push(String(value).trim());
  };
  push(storeId);
  push(storeIds);
  return [...new Set(tokens.filter(Boolean))];
}

async function resolveStoreIds(storeId, storeIds) {
  const tokens = collectStoreTokens(storeId, storeIds);
  if (!tokens.length) {
    const err = new Error('請選擇至少一間店鋪');
    err.status = 400;
    throw err;
  }
  if (tokens.some((t) => t === ALL_STORES || t.toLowerCase() === 'all')) {
    const stores = await Store.find({}).select('_id');
    return stores.map((s) => s._id);
  }
  return tokens;
}

function assignedAllStores(storeId, storeIds) {
  return collectStoreTokens(storeId, storeIds).some(
    (t) => t === ALL_STORES || t.toLowerCase() === 'all'
  );
}

async function assignUserToStores(user, storeId, role = 'staff', storeIds) {
  const ids = await resolveStoreIds(storeId, storeIds);
  if (!ids.length) {
    const err = new Error('沒有可指派的店鋪');
    err.status = 400;
    throw err;
  }
  const memberships = [];
  for (const id of ids) {
    memberships.push(await assignUserToStore(user, id, role));
  }
  return memberships;
}

async function assignUserToStore(user, storeId, role = 'staff') {
  const store = await Store.findById(storeId);
  if (!store) {
    const err = new Error('店鋪不存在');
    err.status = 404;
    throw err;
  }

  if (user.role === 'admin') {
    const err = new Error('平台超級管理員已可使用全部後台，無需指派店鋪。若應改為店長／店員，請先到用戶管理把角色改為一般用戶');
    err.status = 400;
    throw err;
  }
  if (user.role === 'coach') {
    const err = new Error('教練帳號無法指派為店鋪員工，請建立專用店鋪帳號');
    err.status = 400;
    throw err;
  }

  let membership = await TenantMembership.findOne({ user: user._id, store: storeId });
  if (membership) {
    membership.role = role;
    membership.isActive = true;
    await membership.save();
  } else {
    membership = await TenantMembership.create({
      user: user._id,
      store: storeId,
      role,
      isActive: true,
    });
  }

  if (user.role !== 'staff') {
    user.role = 'staff';
    await user.save();
  }

  await membership.populate([
    { path: 'user', select: 'name email phone role' },
    { path: 'store', select: 'name slug' },
  ]);

  return membership;
}

/** GET /api/tenant-memberships/lookup-user?email= — 指派前查詢球友帳號（僅 role=user） */
router.get('/lookup-user', [auth, platformAdminAuth], async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: '請提供 email' });
    }

    const user = await User.findOne({ email }).select('name email phone role isActive');
    if (!user) {
      return res.json({ found: false, user: null });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        message:
          '此帳號是平台超級管理員，已可使用全部後台，無需指派為店鋪員工。若此人應改為店長／店員／股東，請先到「用戶管理」把角色改為一般用戶，再回來指派。',
      });
    }
    if (user.role === 'coach') {
      return res.status(400).json({
        message: '教練帳號無法指派為店鋪員工，請使用「建立店鋪帳號」',
      });
    }

    res.json({
      found: true,
      user,
      alreadyStaff: user.role === 'staff',
    });
  } catch (error) {
    console.error('lookup tenant user 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** POST /api/tenant-memberships/create-account — 建立新店鋪員工帳號並指派 */
router.post('/create-account', [
  auth,
  platformAdminAuth,
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('姓名必須在 2–50 字'),
  body('email').isEmail().withMessage('請提供有效 email'),
  body('password')
    .isLength({ min: 8 }).withMessage('密碼至少 8 字')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/).withMessage('密碼須包含字母與數字'),
  body('phone').matches(/^[0-9]+$/).withMessage('電話只能包含數字'),
  body('storeId').optional(),
  body('storeIds').optional(),
  body('role').optional().isIn(['manager', 'staff', 'shareholder']).withMessage('role 無效'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, password, phone, storeId, storeIds, role = 'staff' } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        message: '此 email 已存在。若為球友請用「指派現有球友」；若為店鋪員工請至列表編輯',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone,
      role: 'staff',
      membershipLevel: 'basic',
    });

    await UserBalance.create({
      user: user._id,
      balance: 0,
      totalRecharged: 0,
      totalSpent: 0,
    });

    const memberships = await assignUserToStores(user, storeId, role, storeIds);

    res.status(201).json({
      message: assignedAllStores(storeId, storeIds) || memberships.length > 1
        ? `店鋪帳號已建立，並指派至 ${memberships.length} 間店鋪`
        : '店鋪帳號已建立並完成指派',
      membership: memberships[0],
      memberships,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
    console.error('建立店鋪帳號錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** GET /api/tenant-memberships — 平台管理員列出指派 */
router.get('/', [auth, platformAdminAuth], async (req, res) => {
  try {
    const filter = {};
    if (req.query.storeId) filter.store = req.query.storeId;
    if (req.query.userId) filter.user = req.query.userId;

    const memberships = await TenantMembership.find(filter)
      .populate('user', 'name email phone role isActive')
      .populate('store', 'name slug')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ memberships });
  } catch (error) {
    console.error('列出 tenant memberships 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** POST /api/tenant-memberships — 指派店鋪員工 */
router.post('/', [
  auth,
  platformAdminAuth,
  body('userId').notEmpty().withMessage('userId 為必填'),
  body('storeId').optional(),
  body('storeIds').optional(),
  body('role').optional().isIn(['manager', 'staff', 'shareholder']).withMessage('role 無效'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { userId, storeId, storeIds, role = 'staff' } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: '用戶不存在' });

    const memberships = await assignUserToStores(user, storeId, role, storeIds);

    res.status(201).json({
      message: assignedAllStores(storeId, storeIds) || memberships.length > 1
        ? `已指派至 ${memberships.length} 間店鋪`
        : '店鋪員工已指派',
      membership: memberships[0],
      memberships,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message, code: error.code });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: '此用戶已指派至該店鋪' });
    }
    console.error('指派 tenant membership 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** PATCH /api/tenant-memberships/:id */
router.patch('/:id', [auth, platformAdminAuth], async (req, res) => {
  try {
    const update = {};
    if (req.body.role) update.role = req.body.role;
    if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;

    const membership = await TenantMembership.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    )
      .populate('user', 'name email phone role')
      .populate('store', 'name slug');

    if (!membership) return res.status(404).json({ message: '指派紀錄不存在' });
    res.json({ message: '已更新', membership });
  } catch (error) {
    console.error('更新 tenant membership 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

/** DELETE /api/tenant-memberships/:id */
router.delete('/:id', [auth, platformAdminAuth], async (req, res) => {
  try {
    const membership = await TenantMembership.findByIdAndDelete(req.params.id);
    if (!membership) return res.status(404).json({ message: '指派紀錄不存在' });

    const remaining = await TenantMembership.countDocuments({
      user: membership.user,
      isActive: true,
    });
    if (remaining === 0) {
      const user = await User.findById(membership.user);
      if (user && user.role === 'staff') {
        user.role = 'user';
        await user.save();
      }
    }

    res.json({ message: '已移除店鋪指派' });
  } catch (error) {
    console.error('刪除 tenant membership 錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
