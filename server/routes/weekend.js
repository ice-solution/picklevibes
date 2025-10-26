const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const weekendService = require('../services/weekendService');

const router = express.Router();

// @route   GET /api/weekend/config
// @desc    獲取週末設定
// @access  Private (Admin)
router.get('/config', [auth, adminAuth], (req, res) => {
  try {
    res.json({
      success: true,
      config: weekendService.config
    });
  } catch (error) {
    console.error('獲取週末設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   PUT /api/weekend/config
// @desc    更新週末設定
// @access  Private (Admin)
router.put('/config', [
  auth,
  adminAuth,
  body('weekendDays').optional().isArray().withMessage('週末天數必須是陣列'),
  body('includeFridayEvening').optional().isBoolean().withMessage('包含星期五晚上必須是布爾值'),
  body('fridayEveningHour').optional().isInt({ min: 0, max: 23 }).withMessage('星期五晚上開始時間必須在0-23之間')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { weekendDays, includeFridayEvening, fridayEveningHour } = req.body;
    
    const newConfig = {};
    if (weekendDays !== undefined) newConfig.weekendDays = weekendDays;
    if (includeFridayEvening !== undefined) newConfig.includeFridayEvening = includeFridayEvening;
    if (fridayEveningHour !== undefined) newConfig.fridayEveningHour = fridayEveningHour;

    weekendService.updateConfig(newConfig);

    res.json({
      success: true,
      message: '週末設定更新成功',
      config: weekendService.config
    });
  } catch (error) {
    console.error('更新週末設定錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/weekend/holidays
// @desc    添加國定假日
// @access  Private (Admin)
router.post('/holidays', [
  auth,
  adminAuth,
  body('dates').isArray().withMessage('日期必須是陣列'),
  body('dates.*').isISO8601().withMessage('日期格式必須正確')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { dates } = req.body;
    
    // 轉換為 YYYY-MM-DD 格式
    const formattedDates = dates.map(date => {
      return new Date(date).toISOString().split('T')[0];
    });

    weekendService.addHolidays(formattedDates);

    res.json({
      success: true,
      message: '國定假日添加成功',
      holidays: weekendService.config.holidays
    });
  } catch (error) {
    console.error('添加國定假日錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   DELETE /api/weekend/holidays
// @desc    移除國定假日
// @access  Private (Admin)
router.delete('/holidays', [
  auth,
  adminAuth,
  body('dates').isArray().withMessage('日期必須是陣列')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { dates } = req.body;
    
    weekendService.removeHolidays(dates);

    res.json({
      success: true,
      message: '國定假日移除成功',
      holidays: weekendService.config.holidays
    });
  } catch (error) {
    console.error('移除國定假日錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   POST /api/weekend/check
// @desc    檢查指定日期是否為週末
// @access  Private (Admin)
router.post('/check', [
  auth,
  adminAuth,
  body('date').isISO8601().withMessage('日期格式必須正確')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: errors.array()[0].msg 
      });
    }

    const { date } = req.body;
    const checkDate = new Date(date);
    
    const isWeekend = weekendService.isWeekend(checkDate);
    const weekendType = weekendService.getWeekendType(checkDate);
    const isHoliday = weekendService.isHoliday(checkDate);

    res.json({
      success: true,
      date: checkDate.toISOString().split('T')[0],
      isWeekend,
      weekendType,
      isHoliday,
      dayOfWeek: checkDate.getDay(),
      dayName: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][checkDate.getDay()]
    });
  } catch (error) {
    console.error('檢查週末錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
