const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Store = require('../models/Store');
const Court = require('../models/Court');
const tuyaService = require('../services/tuyaService');

const router = express.Router();

function normalizeTuyaDevices(devices) {
  if (!Array.isArray(devices)) return [];
  return devices
    .map((d) => ({
      deviceId: String(d.deviceId || '').trim(),
      label: String(d.label || '設備').trim() || '設備',
      switchCode: String(d.switchCode || 'switch_1').trim() || 'switch_1',
      enabled: d.enabled !== false,
    }))
    .filter((d) => d.deviceId);
}

// @route   PUT /api/tuya/courts/:courtId/devices
// @desc    更新場地 Tuya 設備設定
// @access  Private (Admin)
router.put('/courts/:courtId/devices', [
  auth,
  adminAuth,
  body('enableTuyaAutomation').optional().isBoolean(),
  body('tuyaDevices').optional().isArray(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }

    const court = await Court.findById(req.params.courtId);
    if (!court) return res.status(404).json({ message: '場地不存在' });

    if (typeof req.body.enableTuyaAutomation === 'boolean') {
      court.enableTuyaAutomation = req.body.enableTuyaAutomation;
    }
    if (req.body.tuyaDevices) {
      court.tuyaDevices = normalizeTuyaDevices(req.body.tuyaDevices);
    }
    await court.save();

    res.json({
      message: '場地智能設備設定已更新',
      court: {
        _id: court._id,
        name: court.name,
        enableTuyaAutomation: court.enableTuyaAutomation,
        tuyaDevices: court.tuyaDevices,
      },
    });
  } catch (error) {
    console.error('更新場地 Tuya 設備錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤' });
  }
});

// @route   POST /api/tuya/courts/:courtId/test
// @desc    測試場地所有設備（可選 turnOn 實際開關）
// @access  Private (Admin)
router.post('/courts/:courtId/test', [auth, adminAuth], async (req, res) => {
  try {
    const court = await Court.findById(req.params.courtId);
    if (!court) return res.status(404).json({ message: '場地不存在' });

    const store = await Store.findById(court.store);
    if (!store) return res.status(404).json({ message: '店鋪不存在' });

    tuyaService.assertStoreTuyaReady(store);

    const devices = tuyaService.getActiveCourtDevices(court);
    if (!devices.length) {
      return res.status(400).json({ message: '請先啟用場地智能家居並新增至少一個設備' });
    }

    const { turnOn } = req.body;
    const results = [];

    for (const device of devices) {
      if (typeof turnOn === 'boolean') {
        const control = await tuyaService.setDeviceSwitch(store, {
          deviceId: device.deviceId,
          switchCode: device.switchCode,
          turnOn,
        });
        results.push({
          deviceId: device.deviceId,
          label: device.label,
          switchCode: device.switchCode,
          action: turnOn ? 'on' : 'off',
          success: true,
          control,
        });
      } else {
        const status = await tuyaService.getDeviceStatus(store, device.deviceId);
        results.push({
          deviceId: device.deviceId,
          label: device.label,
          switchCode: device.switchCode,
          action: 'status',
          status,
        });
      }
    }

    res.json({
      success: true,
      message: typeof turnOn === 'boolean'
        ? `已對 ${results.length} 個設備下達 ${turnOn ? '開啟' : '關閉'} 指令`
        : `已查詢 ${results.length} 個設備狀態`,
      results,
    });
  } catch (error) {
    console.error('測試場地 Tuya 設備錯誤:', error);
    res.status(500).json({ message: error.message || 'Tuya 測試失敗' });
  }
});

// @route   POST /api/tuya/devices/test
// @desc    測試單一設備（需傳 storeId + deviceId）
// @access  Private (Admin)
router.post('/devices/test', [
  auth,
  adminAuth,
  body('storeId').notEmpty().withMessage('請選擇店鋪'),
  body('deviceId').trim().notEmpty().withMessage('請填寫 Device ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }

    const store = await Store.findById(req.body.storeId);
    if (!store) return res.status(404).json({ message: '店鋪不存在' });

    tuyaService.assertStoreTuyaReady(store);

    const deviceId = String(req.body.deviceId).trim();
    const switchCode = String(req.body.switchCode || 'switch_1').trim();
    const { turnOn } = req.body;

    if (typeof turnOn === 'boolean') {
      const control = await tuyaService.setDeviceSwitch(store, { deviceId, switchCode, turnOn });
      return res.json({
        success: true,
        message: `設備已${turnOn ? '開啟' : '關閉'}`,
        control,
      });
    }

    const status = await tuyaService.getDeviceStatus(store, deviceId);
    res.json({
      success: true,
      message: '已查詢設備狀態',
      status,
    });
  } catch (error) {
    console.error('測試 Tuya 設備錯誤:', error);
    res.status(500).json({ message: error.message || 'Tuya 測試失敗' });
  }
});

module.exports = router;
