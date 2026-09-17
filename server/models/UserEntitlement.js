const mongoose = require('mongoose');
const { PASS_TYPES } = require('./MonthlyPassPlan');

/**
 * 用戶月卡權益：同一 planType 只保留一筆，續費延長 expiresAt。
 */
const userEntitlementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: PASS_TYPES,
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MonthlyPassPlan',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    sourcePayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentLinkPayment',
      default: null,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: [200, '備註不能超過200字'],
    },
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

userEntitlementSchema.index({ user: 1, planType: 1 }, { unique: true });

module.exports = mongoose.model('UserEntitlement', userEntitlementSchema);
