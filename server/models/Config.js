const mongoose = require('mongoose');
const crypto = require('crypto');

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

// HotNews（首頁）：多筆列表，每筆含短描述（banner）與完整 description（彈層）
const DEFAULT_HOTNEWS = {
  enabled: true,
  items: [
    {
      id: 'default-1',
      title: '最新消息',
      shortDescription: '點擊查看活動與場地公告。',
      description: '我們會在這裡發布最新活動、賽事與場地公告。',
      heroBannerUrl: '',
      sortOrder: 0
    }
  ]
};

function normalizeHotNewsItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((it, i) => {
      const id = (it && it.id && String(it.id).trim()) || crypto.randomUUID();
      const title = it && it.title != null ? String(it.title).trim().slice(0, 120) : '';
      const shortDescription =
        it && it.shortDescription != null
          ? String(it.shortDescription).trim().slice(0, 280)
          : '';
      const description =
        it && it.description != null ? String(it.description).trim().slice(0, 8000) : '';
      const heroBannerUrl =
        it && it.heroBannerUrl != null ? String(it.heroBannerUrl).trim().slice(0, 2048) : '';
      const sortOrder = typeof it?.sortOrder === 'number' && Number.isFinite(it.sortOrder) ? it.sortOrder : i;
      return { id, title, shortDescription, description, heroBannerUrl, sortOrder };
    })
    .filter((it) => it.title.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 30)
    .map((it, i) => ({ ...it, sortOrder: i }));
}

function migrateLegacyHotNews(v) {
  if (!v || typeof v !== 'object') return { ...DEFAULT_HOTNEWS };
  if (Array.isArray(v.items)) {
    if (v.items.length > 0) {
      return {
        enabled: v.enabled !== false,
        items: normalizeHotNewsItems(v.items)
      };
    }
    return { enabled: v.enabled !== false, items: [] };
  }
  const hasLegacy =
    (v.title && String(v.title).trim()) ||
    (v.description && String(v.description).trim()) ||
    (v.heroBannerUrl && String(v.heroBannerUrl).trim());
  if (hasLegacy) {
    const desc = v.description != null ? String(v.description) : '';
    const short =
      v.shortDescription != null && String(v.shortDescription).trim()
        ? String(v.shortDescription).trim().slice(0, 280)
        : desc.slice(0, 160) || String(v.title || '最新消息').slice(0, 120);
    return {
      enabled: v.enabled !== false,
      items: normalizeHotNewsItems([
        {
          id: 'migrated-legacy',
          title: v.title != null ? String(v.title).trim().slice(0, 120) : '最新消息',
          shortDescription: short,
          description: desc || short,
          heroBannerUrl: v.heroBannerUrl != null ? String(v.heroBannerUrl).trim() : '',
          sortOrder: 0
        }
      ])
    };
  }
  return {
    enabled: v.enabled !== false,
    items: []
  };
}

configSchema.statics.getHotNews = async function () {
  let doc = await this.findOne({ key: 'hotnews' });
  if (!doc) {
    doc = await this.create({ key: 'hotnews', value: DEFAULT_HOTNEWS });
  }
  const stored = doc.value || {};
  const normalized = migrateLegacyHotNews(stored);
  const needsPersist =
    !Array.isArray(stored.items) ||
    (stored.title != null && !Array.isArray(stored.items));
  if (needsPersist) {
    await this.findOneAndUpdate(
      { key: 'hotnews' },
      { value: normalized, updatedAt: new Date() },
      { new: true }
    );
  }
  return normalized;
};

configSchema.statics.setHotNews = async function (data) {
  const current = await this.getHotNews();
  const next = {
    enabled: data?.enabled !== undefined ? !!data.enabled : current.enabled,
    items: Array.isArray(data?.items) ? normalizeHotNewsItems(data.items) : current.items
  };
  await this.findOneAndUpdate(
    { key: 'hotnews' },
    { value: next, updatedAt: new Date() },
    { new: true, upsert: true }
  );
  return next;
};

module.exports = mongoose.model('Config', configSchema);
