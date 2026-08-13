const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { loadTenantAccess } = require('../utils/tenantAccess');
const { assertNotShareholderWrite } = require('../utils/tenantPermissions');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: '訪問被拒絕，請提供有效的令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

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

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) return next();

    req.user = user;
    req.tenantAccess = await loadTenantAccess(user);
  } catch {
    // 忽略無效 token
  }
  next();
};

function extractStoreIdFromRequest(req) {
  return (
    req.body?.storeId ||
    req.body?.store ||
    req.query?.storeId ||
    req.query?.store ||
    req.params?.storeId ||
    null
  );
}

const adminAuth = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }

  req.tenantAccess = await loadTenantAccess(req.user);

  if (req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'staff' && (req.tenantAccess.managedStoreIds || []).length > 0) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const gate = assertNotShareholderWrite(req.tenantAccess, extractStoreIdFromRequest(req));
      if (!gate.ok) {
        return res.status(gate.status).json({ message: gate.message });
      }
    }
    return next();
  }

  return res.status(403).json({ message: '訪問被拒絕，需要管理員權限' });
};

const platformAdminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: '訪問被拒絕，需要平台管理員權限' });
  }
  next();
};

const coachOrAdminAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '訪問被拒絕，請先登錄' });
  }
  if (!['admin', 'coach'].includes(req.user.role)) {
    return res.status(403).json({ message: '訪問被拒絕，需要教練或管理員權限' });
  }
  next();
};

module.exports = { auth, optionalAuth, adminAuth, platformAdminAuth, coachOrAdminAuth };
