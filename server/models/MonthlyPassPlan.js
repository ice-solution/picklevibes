const mongoose = require('mongoose');

const PASS_TYPES = ['reclub_unlimited', 'off_peak'];

const monthlyPassPlanSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: PASS_TYPES,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: [80, '名稱不能超過80字'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, '描述不能超過500字'],
    },
    /** 建議售價（賣卡連結可另設金額） */
    price: {
      type: Number,
      required: true,
      min: [0, '價錢不能為負'],
    },
    /** 購買／續費延長日數（類 VIP 週期） */
    durationDays: {
      type: Number,
      required: true,
      min: [1, '至少 1 日'],
      default: 30,
    },
    /** 非繁忙窗（僅 off_peak） */
    offPeakStart: {
      type: String,
      default: '10:00',
      trim: true,
    },
    offPeakEnd: {
      type: String,
      default: '16:00',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

monthlyPassPlanSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('MonthlyPassPlan', monthlyPassPlanSchema);
module.exports.PASS_TYPES = PASS_TYPES;
