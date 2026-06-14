const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, superAdminAuth } = require('../middleware/auth');
const { getMaintenanceStatus, setMaintenanceStatus } = require('../middleware/maintenance');
const router = express.Router();

// @route   GET /api/maintenance/status
// @desc    獲取維護狀態
// @access  Public
router.get('/status', (req, res) => {
  const status = getMaintenanceStatus();
  res.json({
    ...status,
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/maintenance/toggle
// @desc    切換維護模式（僅管理員）
// @access  Private (Admin)
router.post('/toggle', [
  auth,
  superAdminAuth,
  body('message').optional().isString().isLength({ min: 1, max: 200 }).withMessage('維護訊息必須在1-200個字符之間')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { message } = req.body;
    const currentStatus = getMaintenanceStatus();
    
    // 切換維護模式
    const newMode = !currentStatus.maintenanceMode;
    setMaintenanceStatus(newMode, message);
    
    const newStatus = getMaintenanceStatus();
    console.log(`🔧 維護模式 ${newStatus.maintenanceMode ? '開啟' : '關閉'}${message ? ` - ${newStatus.message}` : ''}`);
    
    res.json({
      message: `維護模式已${newStatus.maintenanceMode ? '開啟' : '關閉'}`,
      ...newStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('切換維護模式錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/maintenance/set-message
// @desc    設置維護訊息（僅管理員）
// @access  Private (Admin)
router.post('/set-message', [
  auth,
  superAdminAuth,
  body('message').isString().isLength({ min: 1, max: 200 }).withMessage('維護訊息必須在1-200個字符之間')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { message } = req.body;
    const currentStatus = getMaintenanceStatus();
    setMaintenanceStatus(currentStatus.maintenanceMode, message);
    
    const newStatus = getMaintenanceStatus();
    console.log(`🔧 維護訊息已更新: ${newStatus.message}`);
    
    res.json({
      message: '維護訊息已更新',
      ...newStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('設置維護訊息錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
