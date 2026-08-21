const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '店鋪名稱為必填項目'],
    trim: true,
    maxlength: [80, '店鋪名稱不能超過80個字符'],
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  address: {
    type: String,
    required: [true, '地址為必填項目'],
    trim: true,
    maxlength: [200, '地址不能超過200個字符'],
  },
  /** 前台場地頁 banner 介紹文案 */
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [1000, '店鋪介紹不能超過1000個字符'],
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  /** 前台場地頁預設選中此店（同時只應有一間） */
  isDefault: {
    type: Boolean,
    default: false,
    index: true,
  },
  /** 前台顯示用營業時間（簡化：每日同一時段或 24 小時） */
  operatingHours: {
    is24Hours: { type: Boolean, default: false },
    start: { type: String, default: '08:00', trim: true },
    end: { type: String, default: '23:00', trim: true },
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  enableHikAccess: {
    type: Boolean,
    default: false,
  },
  /** 包場每小時價錢（積分）；0 = 未設定，改用各場牌價加總 */
  fullVenueHourlyRate: {
    type: Number,
    default: 0,
    min: [0, '包場時薪不能為負數'],
  },
  hikKey: { type: String, default: null },
  hikSecret: { type: String, default: null },
  hikAccessLevelId: { type: String, default: null },
  /** Tuya 智能家居（店鋪級 API 憑證，設備綁在 Court） */
  enableTuyaAutomation: {
    type: Boolean,
    default: false,
  },
  tuyaAccessKey: { type: String, default: null },
  tuyaSecretKey: { type: String, default: null },
  tuyaBaseUrl: {
    type: String,
    default: 'https://openapi.tuyacn.com',
  },
  /** 預約自動開關參數（Phase 2 排程用） */
  tuyaPreBufferMinutes: { type: Number, default: 15, min: 0, max: 120 },
  tuyaPostBufferMinutes: { type: Number, default: 15, min: 0, max: 120 },
  tuyaMergeGapMinutes: { type: Number, default: 0, min: 0, max: 60 },
  /**
   * 夜間值班 OpenWA 通知（店鋪級，例：荔枝角）
   * - notifyPeriodFrom/To：時段內有人新建預約 → 即時通知；到 From 整點亦會做當晚場次匯總
   * - holidayNotifyEnabled：每日 08:00 若系統判定紅日，發送當日場地表
   */
  overnightDutyNotify: {
    enabled: { type: Boolean, default: false },
    notifyPhones: {
      type: [String],
      default: [],
    },
    /** 即時通知時段開始（HH:mm），例 20:00 */
    notifyPeriodFrom: { type: String, default: '20:00', trim: true },
    /** 即時通知時段結束（HH:mm），例 08:00；可跨日 */
    notifyPeriodTo: { type: String, default: '08:00', trim: true },
    /** 紅日通知：每日 08:00 檢查是否紅日，是則發送當日預約 */
    holidayNotifyEnabled: { type: Boolean, default: false },
  },
  /**
   * Tuya 控制區：設備綁在控制區，場地指派到控制區。
   * 任一關聯場地有預約燈光時段 → 控制區內設備應開（OR 邏輯）。
   */
  tuyaZones: [{
    name: {
      type: String,
      trim: true,
      default: '控制區',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    devices: [{
      deviceId: { type: String, required: true, trim: true },
      label: { type: String, trim: true, default: '設備' },
      switchCode: { type: String, trim: true, default: 'switch_1' },
      enabled: { type: Boolean, default: true },
    }],
    courtIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
    }],
  }],
}, {
  timestamps: true,
});

storeSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Store', storeSchema);
