const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    fieldName: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['text', 'email', 'tel', 'textarea', 'select'],
      required: true,
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    options: [
      {
        value: { type: String, trim: true },
        label: { type: String, trim: true },
      },
    ],
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

/**
 * 店鋪申請表（參考 checkinSystem FormConfig，簡化版）
 * 一店可有 N 張表；公開頁以全域唯一 slug 進入
 */
const applicationFormSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    /** 公開路徑 /:slug */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, default: '' },
    /** 公開頁 banner（/uploads/application-forms/...） */
    bannerUrl: { type: String, default: '' },
    /** on/off（對應 FormConfig.registerPageEnabled） */
    isActive: { type: Boolean, default: true },
    closedMessage: {
      type: String,
      default: '此申請表目前已關閉，請稍後再試。',
    },
    thankYouTitle: { type: String, default: '提交成功' },
    thankYouMessage: {
      type: String,
      default: '感謝您的申請，我們會盡快與您聯絡。',
    },
    agreement: {
      enabled: { type: Boolean, default: false },
      label: { type: String, default: '我已閱讀並同意相關條款' },
      content: { type: String, default: '' },
    },
    fields: { type: [fieldSchema], default: [] },
  },
  { timestamps: true }
);

applicationFormSchema.index({ store: 1, createdAt: -1 });

module.exports = mongoose.model('ApplicationForm', applicationFormSchema);
