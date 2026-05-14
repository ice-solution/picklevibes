const mongoose = require('mongoose');

const edmCampaignSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['sending', 'completed', 'partial', 'failed'],
      default: 'sending'
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    headline: { type: String, trim: true, maxlength: 200 },
    preheader: { type: String, trim: true, maxlength: 300 },
    bodyHtml: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    ctaUrl: { type: String, trim: true, maxlength: 2048 },
    ctaLabel: { type: String, trim: true, maxlength: 80 },
    footerNote: { type: String, trim: true, maxlength: 500 },
    recipientMode: {
      type: String,
      enum: ['manual', 'userIds', 'roles'],
      required: true
    },
    /** 發送當下 resolve 結果快照（模式、分批、總數等） */
    recipientMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    edmTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EdmTemplate', default: null },
    edmMailingList: { type: mongoose.Schema.Types.ObjectId, ref: 'EdmMailingList', default: null },
    edmTemplateName: { type: String, default: '', trim: true, maxlength: 120 },
    edmMailingListName: { type: String, default: '', trim: true, maxlength: 120 },
    targetCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

edmCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EdmCampaign', edmCampaignSchema);
