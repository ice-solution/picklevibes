const mongoose = require('mongoose');

/**
 * 平台向店鋪收取的抽成紀錄（找數用）
 * - store_recharge：充值到該店
 * - booking_points：以 PickCourt 積分預約場地
 */
const storePlatformFeeSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['store_recharge', 'booking_points'],
      required: true,
      index: true,
    },
    sourceModel: {
      type: String,
      enum: ['Recharge', 'Booking'],
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    /** 抽成基數（充值：付款金額 HKD；預約：扣除積分） */
    grossAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    feePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    feeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    /** 入店淨額 = grossAmount - feeAmount */
    netAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
    settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    voided: {
      type: Boolean,
      default: false,
      index: true,
    },
    voidedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

storePlatformFeeSchema.index({ store: 1, occurredAt: -1 });
storePlatformFeeSchema.index(
  { sourceModel: 1, sourceId: 1, type: 1 },
  { unique: true }
);

module.exports = mongoose.model('StorePlatformFee', storePlatformFeeSchema);
