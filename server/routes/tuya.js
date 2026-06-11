const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, adminAuth } = require('../middleware/auth');
const Store = require('../models/Store');
const Court = require('../models/Court');
const tuyaService = require('../services/tuyaService');
const tuyaSchedulerService = require('../services/tuyaSchedulerService');
const tuyaScheduler = require('../scheduler/tuyaScheduler');
const { normalizeTuyaDeviceList } = require('../utils/tuyaDevices');
const { resolveStoreZones } = require('../utils/tuyaZones');

const router = express.Router();

function normalizeTuyaDevices(devices) {
  return normalizeTuyaDeviceList(devices);
}

function normalizeZonesPayload(zones) {
  if (!Array.isArray(zones)) return [];
  return zones.map((z) => ({
    ...(z._id ? { _id: z._id } : {}),
    name: String(z.name || '控制區').trim() || '控制區',
    enabled: z.enabled !== false,
    devices: normalizeTuyaDevices(z.devices),
    courtIds: (z.courtIds || []).filter(Boolean),
  }));
}

// @route   GET /api/tuya/stores/:storeId/zones
// @desc    取得店鋪控制區與場地列表（Admin 設定用）
// @access  Private (Admin)
router.get('/stores/:storeId/zones', [auth, adminAuth], async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ message: '店鋪不存在' });

    const courts = await Court.find({ store: store._id })
      .sort({ number: 1 })
      .select('name number isActive enableTuyaAutomation');

    res.json({
      success: true,
      store: {
        _id: store._id,
        name: store.name,
        enableTuyaAutomation: store.enableTuyaAutomation,
      },
      tuyaZones: store.tuyaZones || [],
      courts,
      resolvedZones: resolveStoreZones(store, await Court.find({ store: store._id }).lean()),
    });
  } catch (error) {
    console.error('取得 Tuya 控制區錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤' });
  }
});

// @route   PUT /api/tuya/stores/:storeId/zones
// @desc    更新店鋪全部控制區
// @access  Private (Admin)
router.put('/stores/:storeId/zones', [
  auth,
  adminAuth,
  body('tuyaZones').isArray().withMessage('tuyaZones 須為陣列'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: '輸入驗證失敗', errors: errors.array() });
    }

    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ message: '店鋪不存在' });

    store.tuyaZones = normalizeZonesPayload(req.body.tuyaZones);
    await store.save();

    res.json({
      message: '控制區設定已更新',
      tuyaZones: store.tuyaZones,
    });
  } catch (error) {
    console.error('更新 Tuya 控制區錯誤:', error);
    res.status(500).json({ message: error.message || '服務器錯誤' });
  }
});

// @route   POST /api/tuya/stores/:storeId/zones/:zoneId/test
// @desc    測試控制區設備（可選 turnOn）
// @access  Private (Admin)
router.post('/stores/:storeId/zones/:zoneId/test', [auth, adminAuth], async (req, res) => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) return res.status(404).json({ message: '店鋪不存在' });

    tuyaService.assertStoreTuyaReady(store);

    const courts = await Court.find({ store: store._id }).lean();
    const zone = resolveStoreZones(store, courts).find(
      (z) => String(z._id) === String(req.params.zoneId)
    );
    if (!zone) return res.status(404).json({ message: '控制區不存在' });

    const { turnOn } = req.body;
    const results = [];

    for (const device of zone.devices) {
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
      zone: { _id: zone._id, name: zone.name },
      message: typeof turnOn === 'boolean'
        ? `已對控制區「${zone.name}」的 ${results.length} 個設備下達 ${turnOn ? '開啟' : '關閉'} 指令`
        : `已查詢控制區「${zone.name}」的 ${results.length} 個設備狀態`,
      results,
    });
  } catch (error) {
    console.error('測試控制區 Tuya 設備錯誤:', error);
    res.status(500).json({ message: error.message || 'Tuya 測試失敗' });
  }
});

// @route   POST /api/tuya/stores/:storeId/sync
// @desc    手動觸發單店 Tuya 燈控同步
// @access  Private (Admin)
router.post('/stores/:storeId/sync', [auth, adminAuth], async (req, res) => {
  try {
    const result = await tuyaSchedulerService.syncStoreById(req.params.storeId, {
      reason: 'admin_manual',
    });
    res.json({
      success: true,
      message: result.skipped ? '店鋪未啟用或未設定控制區' : `已同步 ${result.synced} 個設備`,
      result,
    });
  } catch (error) {
    console.error('手動店鋪 Tuya 同步錯誤:', error);
    res.status(500).json({ message: error.message || '同步失敗' });
  }
});

// @route   PUT /api/tuya/courts/:courtId/devices
// @desc    [舊版] 更新場地 Tuya 設備設定（建議改用控制區）
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
      message: '場地智能設備設定已更新（建議改用店鋪「控制區」）',
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
// @desc    [舊版] 測試場地設備；若已設控制區請用 /stores/:id/zones/:zoneId/test
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
      return res.status(400).json({ message: '此場地無設備；請於店鋪管理設定控制區' });
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

// @route   POST /api/tuya/sync/run
// @desc    手動觸發全店 Tuya 燈控同步（依控制區 OR 邏輯）
// @access  Private (Admin)
router.post('/sync/run', [auth, adminAuth], async (req, res) => {
  try {
    const result = await tuyaSchedulerService.syncAllCourts({ reason: 'admin_manual' });
    res.json({
      success: true,
      message: `已同步 ${result.synced} 個設備`,
      ...result,
    });
  } catch (error) {
    console.error('手動 Tuya 同步錯誤:', error);
    res.status(500).json({ message: error.message || '同步失敗' });
  }
});

// @route   POST /api/tuya/courts/:courtId/sync
// @desc    手動觸發該場地所屬店鋪的 Tuya 同步
// @access  Private (Admin)
router.post('/courts/:courtId/sync', [auth, adminAuth], async (req, res) => {
  try {
    const result = await tuyaSchedulerService.syncCourtById(req.params.courtId, {
      reason: 'admin_manual',
    });
    res.json({
      success: true,
      message: result.skipped ? '店鋪未啟用或未設定控制區' : '店鋪同步完成',
      result,
    });
  } catch (error) {
    console.error('手動場地 Tuya 同步錯誤:', error);
    res.status(500).json({ message: error.message || '同步失敗' });
  }
});

// @route   GET /api/tuya/sync/status
// @desc    查詢 Tuya 排程狀態與設備快取
// @access  Private (Admin)
router.get('/sync/status', [auth, adminAuth], async (req, res) => {
  res.json({
    success: true,
    scheduler: tuyaScheduler.getStatus(),
  });
});

// @route   GET /api/tuya/sync/logs
// @desc    查詢 Tuya 動作日誌
// @access  Private (Admin)
router.get('/sync/logs', [auth, adminAuth], async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const courtId = req.query.courtId ? String(req.query.courtId) : undefined;
  const sinceId = req.query.sinceId ? parseInt(req.query.sinceId, 10) : undefined;
  res.json({
    success: true,
    logs: tuyaSchedulerService.getTuyaActionLog({ limit, courtId, sinceId }),
    maxEntries: 500,
  });
});

// @route   DELETE /api/tuya/sync/logs
// @desc    清空 Tuya 動作日誌
// @access  Private (Admin)
router.delete('/sync/logs', [auth, adminAuth], async (req, res) => {
  tuyaSchedulerService.clearTuyaActionLog();
  res.json({ success: true, message: '日誌已清空' });
});

module.exports = router;
