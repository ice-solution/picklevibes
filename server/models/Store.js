const mongoose = require('mongoose');

const dayHoursSchema = {
  start: { type: String, default: '08:00' },
  end: { type: String, default: '23:00' },
  isOpen: { type: Boolean, default: true },
};

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
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  operatingHours: {
    monday: dayHoursSchema,
    tuesday: dayHoursSchema,
    wednesday: dayHoursSchema,
    thursday: dayHoursSchema,
    friday: dayHoursSchema,
    saturday: dayHoursSchema,
    sunday: dayHoursSchema,
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
}, {
  timestamps: true,
});

storeSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('Store', storeSchema);
