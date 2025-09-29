const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult, query } = require('express-validator');
const Court = require('../models/Court');
const Booking = require('../models/Booking');
const { auth, adminAuth } = require('../middleware/auth');

// 為批量 API 創建專門的速率限制
const batchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分鐘
  max: 30, // 批量 API 每分鐘30個請求
  message: '批量請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false
});

const router = express.Router();

// 計算時間長度（分鐘）
function calculateDuration(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startTotalMin = startHour * 60 + startMin;
  const endTotalMin = endHour * 60 + endMin;
  
  return endTotalMin - startTotalMin;
}

// @route   GET /api/courts
// @desc    獲取所有場地
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { type, available } = req.query;
    
    let query = { isActive: true };
    
    if (type) {
      query.type = type;
    }
    
    const courts = await Court.find(query).sort({ number: 1 });
    
    // 如果請求可用場地，過濾掉維護中的場地
    if (available === 'true') {
      const availableCourts = courts.filter(court => court.isAvailable());
      return res.json({ courts: availableCourts });
    }
    
    res.json({ courts });
  } catch (error) {
    console.error('獲取場地錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   GET /api/courts/:id
// @desc    獲取單個場地詳情
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    
    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }
    
    res.json({ court });
  } catch (error) {
    console.error('獲取場地詳情錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/courts/:id/availability/batch
// @desc    批量檢查場地時間段可用性
// @access  Public
router.post('/:id/availability/batch', batchLimiter, async (req, res) => {
  try {
    const court = await Court.findById(req.params.id);
    
    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }
    
    const { date, timeSlots } = req.body;
    
    if (!date || !timeSlots || !Array.isArray(timeSlots)) {
      return res.status(400).json({ 
        message: '請提供日期和時間段陣列' 
      });
    }
    
    // 檢查場地是否可用
    if (!court.isAvailable()) {
      const unavailableSlots = timeSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        reason: '場地正在維護中'
      }));
      return res.json({ 
        date,
        courtId: req.params.id,
        timeSlots: unavailableSlots
      });
    }
    
    // 檢查場地是否在營業時間內開放
    const bookingDate = new Date(date);
    if (!court.isOpenAt(bookingDate)) {
      const unavailableSlots = timeSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: false,
        reason: '場地在該時間段不開放'
      }));
      return res.json({ 
        date,
        courtId: req.params.id,
        timeSlots: unavailableSlots
      });
    }
    
    // 批量檢查時間衝突
    const availabilityResults = await Promise.all(
      timeSlots.map(async (slot) => {
        try {
          const hasConflict = await Booking.checkTimeConflict(
            req.params.id, 
            date, 
            slot.startTime, 
            slot.endTime
          );
          
          if (hasConflict) {
            return {
              startTime: slot.startTime,
              endTime: slot.endTime,
              available: false,
              reason: '該時間段已被預約'
            };
          }
          
          // 計算價格
          const duration = calculateDuration(slot.startTime, slot.endTime);
          const basePrice = court.getPriceForTime(slot.startTime, bookingDate);
          const totalPrice = Math.round(basePrice * (duration / 60));
          
          // 判斷是否為高峰時段（用於顯示）
          const hour = parseInt(slot.startTime.split(':')[0]);
          const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
          const isPeakHour = isWeekend || (hour >= 18 && hour < 23);
          
          return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            available: true,
            pricing: {
              basePrice,
              totalPrice,
              duration,
              isPeakHour
            }
          };
        } catch (error) {
          console.error(`檢查時間段 ${slot.startTime}-${slot.endTime} 可用性錯誤:`, error);
          return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            available: false,
            reason: '檢查可用性時發生錯誤'
          };
        }
      })
    );
    
    res.json({
      date,
      courtId: req.params.id,
      timeSlots: availabilityResults
    });
    
  } catch (error) {
    console.error('批量檢查場地可用性錯誤:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// @route   GET /api/courts/:id/availability
// @desc    檢查場地可用性
// @access  Public
router.get('/:id/availability', [
  query('date').isISO8601().withMessage('請提供有效的日期格式'),
  query('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的開始時間'),
  query('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('請提供有效的結束時間')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { date, startTime, endTime } = req.query;
    const court = await Court.findById(req.params.id);
    
    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }
    
    // 檢查場地是否可用
    if (!court.isAvailable()) {
      return res.json({ 
        available: false, 
        reason: '場地正在維護中' 
      });
    }
    
    // 檢查場地是否在營業時間內開放
    const bookingDate = new Date(date);
    if (!court.isOpenAt(bookingDate)) {
      return res.json({ 
        available: false, 
        reason: '場地在該時間段不開放' 
      });
    }
    
    // 檢查時間衝突
    const hasConflict = await Booking.checkTimeConflict(
      req.params.id, 
      date, 
      startTime, 
      endTime
    );
    
    if (hasConflict) {
      return res.json({ 
        available: false, 
        reason: '該時間段已被預約' 
      });
    }
    
    // 計算價格
    const basePrice = court.getPriceForTime(startTime, new Date(date));
    const duration = (parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1])) - 
                    (parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]));
    const totalPrice = (basePrice * duration) / 60;
    
    // 判斷是否為高峰時段（用於顯示）
    const hour = parseInt(startTime.split(':')[0]);
    const isWeekend = bookingDate.getDay() === 0 || bookingDate.getDay() === 6;
    const isPeakHour = isWeekend || (hour >= 18 && hour < 23);
    
    res.json({ 
      available: true,
      pricing: {
        basePrice,
        totalPrice,
        duration: duration,
        isPeakHour
      }
    });
  } catch (error) {
    console.error('檢查場地可用性錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   POST /api/courts
// @desc    創建新場地（管理員）
// @access  Private (Admin)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().isLength({ min: 1, max: 50 }).withMessage('場地名稱必須在1-50個字符之間'),
  body('number').isInt({ min: 1 }).withMessage('場地編號必須是正整數'),
  body('type').isIn(['indoor', 'outdoor', 'dink']).withMessage('場地類型必須是 indoor, outdoor 或 dink'),
  body('capacity').isInt({ min: 2, max: 8 }).withMessage('場地容量必須在2-8人之間'),
  body('pricing.peakHour').isFloat({ min: 0 }).withMessage('高峰時段價格不能為負數'),
  body('pricing.offPeak').isFloat({ min: 0 }).withMessage('非高峰時段價格不能為負數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const court = new Court(req.body);
    await court.save();

    res.status(201).json({
      message: '場地創建成功',
      court
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: '場地編號已存在' });
    }
    
    console.error('創建場地錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/courts/:id
// @desc    更新場地信息（管理員）
// @access  Private (Admin)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().isLength({ min: 1, max: 50 }).withMessage('場地名稱必須在1-50個字符之間'),
  body('capacity').optional().isInt({ min: 2, max: 8 }).withMessage('場地容量必須在2-8人之間'),
  body('pricing.peakHour').optional().isFloat({ min: 0 }).withMessage('高峰時段價格不能為負數'),
  body('pricing.offPeak').optional().isFloat({ min: 0 }).withMessage('非高峰時段價格不能為負數')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const court = await Court.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }

    res.json({
      message: '場地更新成功',
      court
    });
  } catch (error) {
    console.error('更新場地錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   DELETE /api/courts/:id
// @desc    刪除場地（管理員）
// @access  Private (Admin)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const court = await Court.findByIdAndDelete(req.params.id);

    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }

    res.json({ message: '場地刪除成功' });
  } catch (error) {
    console.error('刪除場地錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

// @route   PUT /api/courts/:id/maintenance
// @desc    設置場地維護狀態（管理員）
// @access  Private (Admin)
router.put('/:id/maintenance', [
  auth,
  adminAuth,
  body('isUnderMaintenance').isBoolean().withMessage('維護狀態必須是布爾值'),
  body('maintenanceStart').optional().isISO8601().withMessage('維護開始時間格式無效'),
  body('maintenanceEnd').optional().isISO8601().withMessage('維護結束時間格式無效'),
  body('maintenanceReason').optional().trim().isLength({ max: 200 }).withMessage('維護原因不能超過200個字符')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: '輸入驗證失敗',
        errors: errors.array()
      });
    }

    const { isUnderMaintenance, maintenanceStart, maintenanceEnd, maintenanceReason } = req.body;
    
    const court = await Court.findByIdAndUpdate(
      req.params.id,
      {
        'maintenance.isUnderMaintenance': isUnderMaintenance,
        'maintenance.maintenanceStart': maintenanceStart ? new Date(maintenanceStart) : undefined,
        'maintenance.maintenanceEnd': maintenanceEnd ? new Date(maintenanceEnd) : undefined,
        'maintenance.maintenanceReason': maintenanceReason
      },
      { new: true, runValidators: true }
    );

    if (!court) {
      return res.status(404).json({ message: '場地不存在' });
    }

    res.json({
      message: '場地維護狀態更新成功',
      court
    });
  } catch (error) {
    console.error('更新場地維護狀態錯誤:', error);
    res.status(500).json({ message: '服務器錯誤，請稍後再試' });
  }
});

module.exports = router;
