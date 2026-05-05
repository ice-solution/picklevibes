const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// 預約設定預設值：依 role 可預約天數
const DEFAULT_BOOKING_CONFIG = {
  maxAdvanceDaysByRole: {
    user: 7,
    coach: 14,
    admin: 30
  }
};

configSchema.statics.getBookingConfig = async function () {
  let doc = await this.findOne({ key: 'booking' });
  if (!doc) {
    doc = await this.create({
      key: 'booking',
      value: DEFAULT_BOOKING_CONFIG
    });
  }
  const stored = doc.value && doc.value.maxAdvanceDaysByRole ? doc.value.maxAdvanceDaysByRole : {};
  const maxAdvanceDaysByRole = {
    ...DEFAULT_BOOKING_CONFIG.maxAdvanceDaysByRole,
    ...stored
  };
  return { maxAdvanceDaysByRole };
};

configSchema.statics.setBookingConfig = async function (maxAdvanceDaysByRole) {
  const current = await this.getBookingConfig();
  const merged = { ...current.maxAdvanceDaysByRole, ...maxAdvanceDaysByRole };
  const value = { maxAdvanceDaysByRole: merged };
  const doc = await this.findOneAndUpdate(
    { key: 'booking' },
    { value, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return { maxAdvanceDaysByRole: merged };
};

// 購物功能開關
configSchema.statics.getShopEnabled = async function () {
  const doc = await this.findOne({ key: 'shop' });
  if (!doc || doc.value == null) return true; // 預設開啟
  return doc.value.enabled !== false;
};

configSchema.statics.setShopEnabled = async function (enabled) {
  await this.findOneAndUpdate(
    { key: 'shop' },
    { value: { enabled: !!enabled }, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return { enabled: !!enabled };
};

// Tier 功能開關（全站）
configSchema.statics.getTierEnabled = async function () {
  const doc = await this.findOne({ key: 'tier' });
  if (!doc || doc.value == null) return false; // 預設關閉
  return doc.value.enabled === true;
};

configSchema.statics.setTierEnabled = async function (enabled) {
  await this.findOneAndUpdate(
    { key: 'tier' },
    { value: { enabled: !!enabled }, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return { enabled: !!enabled };
};

// HotNews（首頁第一個 component）內容
const DEFAULT_HOTNEWS = {
  enabled: true,
  heroBannerUrl: '',
  title: '最新消息',
  description: '我們會在這裡發布最新活動、賽事與場地公告。'
};

configSchema.statics.getHotNews = async function () {
  let doc = await this.findOne({ key: 'hotnews' });
  if (!doc) {
    doc = await this.create({ key: 'hotnews', value: DEFAULT_HOTNEWS });
  }
  const v = doc.value || {};
  return {
    enabled: v.enabled !== false,
    heroBannerUrl: v.heroBannerUrl || '',
    title: v.title || DEFAULT_HOTNEWS.title,
    description: v.description || DEFAULT_HOTNEWS.description,
  };
};

configSchema.statics.setHotNews = async function (data) {
  const current = await this.getHotNews();
  const merged = {
    ...current,
    ...(data || {}),
    enabled: data?.enabled !== undefined ? !!data.enabled : current.enabled,
  };
  await this.findOneAndUpdate(
    { key: 'hotnews' },
    { value: merged, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return merged;
};

module.exports = mongoose.model('Config', configSchema);
