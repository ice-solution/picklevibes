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

module.exports = mongoose.model('Config', configSchema);
