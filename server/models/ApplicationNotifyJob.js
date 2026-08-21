const mongoose = require('mongoose');

const notifyItemSchema = new mongoose.Schema(
  {
    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationSubmission',
      required: true,
    },
    phone: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    error: { type: String, default: '' },
    sentAt: { type: Date, default: null },
  },
  { _id: true }
);

/**
 * 申請表 WhatsApp（OpenWA）批量通知工作
 * 後台佇列：預設每 2 秒發送一則，避免被封鎖
 */
const applicationNotifyJobSchema = new mongoose.Schema(
  {
    form: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApplicationForm',
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    template: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    intervalMs: { type: Number, default: 2000, min: 1000 },
    items: { type: [notifyItemSchema], default: [] },
    total: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

applicationNotifyJobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('ApplicationNotifyJob', applicationNotifyJobSchema);
