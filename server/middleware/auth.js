const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  canAccessAdminPanel,
  isSuperAdmin,
  isAdminPanelUser,
  serializeAdminUser,
} = require('../utils/adminAccess');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: '訪問被拒絕，請提供有效的令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('managedStores', 'name slug');

    if (!user) {
      return res.status(401).json({ message: '令牌無效，用戶不存在' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: '帳戶已被停用' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '令牌無效' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '令牌已過期，請重新登錄' });
    }

    console.error('認證中間件錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
};

/** 可進入後台：super_admin / admin / staff（含舊 role=admin） */
const adminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (!canAccessAdminPanel(req.user)) {
    return res.status(403).json({ message: '訪問被拒絕，需要管理員權限' });
  }
  next();
};

/** 僅 super_admin（含舊 role=admin） */
const superAdminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ message: '需要 Super Admin 權限' });
  }
  next();
};

/** 教練或任何後台角色 */
const coachOrAdminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (!isAdminPanelUser(req.user) && req.user.role !== 'coach') {
    return res.status(403).json({ message: '訪問被拒絕，需要教練或管理員權限' });
  }
  next();
};

module.exports = { auth, adminAuth, superAdminAuth, coachOrAdminAuth, serializeAdminUser };
