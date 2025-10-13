// 維護狀態存儲（實際應用中可以存儲到數據庫）
let maintenanceMode = false;
let maintenanceMessage = '系統維護中，請稍後再試';

// 獲取維護狀態
const getMaintenanceStatus = () => ({
  maintenanceMode,
  message: maintenanceMessage
});

// 設置維護狀態
const setMaintenanceStatus = (mode, message) => {
  maintenanceMode = mode;
  if (message) {
    maintenanceMessage = message;
  }
};

// 維護模式中間件（在認證之前）
const maintenanceMiddleware = (req, res, next) => {
  if (maintenanceMode) {
    // 如果是維護狀態 API 本身，則允許通過
    if (req.path === '/api/maintenance/status' || 
        req.path === '/api/maintenance/toggle' || 
        req.path === '/api/maintenance/set-message') {
      return next();
    }
    
    // 允許認證相關的 API 通過，以便前端可以檢查用戶身份
    if (req.path === '/api/auth/me' || 
        req.path === '/api/auth/login' || 
        req.path === '/api/auth/register') {
      return next();
    }
    
    // 只攔截其他 API 請求，不攔截前端頁面
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        message: '系統維護中',
        maintenanceMode: true,
        message: maintenanceMessage,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

// 維護模式中間件（在認證之後，用於檢查管理員）
const maintenanceAdminMiddleware = (req, res, next) => {
  if (maintenanceMode) {
    // 如果是維護狀態 API 本身，則允許通過
    if (req.path === '/api/maintenance/status' || 
        req.path === '/api/maintenance/toggle' || 
        req.path === '/api/maintenance/set-message') {
      return next();
    }
    
    // 允許認證相關的 API 通過
    if (req.path === '/api/auth/me' || 
        req.path === '/api/auth/login' || 
        req.path === '/api/auth/register') {
      return next();
    }
    
    // 如果是管理員且已認證，允許通過所有 API
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    
    // 攔截其他 API 請求
    if (req.path.startsWith('/api/')) {
      return res.status(503).json({
        message: '系統維護中',
        maintenanceMode: true,
        message: maintenanceMessage,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

module.exports = {
  maintenanceMiddleware,
  maintenanceAdminMiddleware,
  getMaintenanceStatus,
  setMaintenanceStatus
};
