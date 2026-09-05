const mongoose = require('mongoose');

/**
 * 記錄「長期支持用戶」某周年窗口內某 Tier 獎勵已派發。
 * 唯一鍵：user × tier × windowStart
 */
const tierRewardFulfillmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tier',
    required: true,
    index: true,
  },
  /** 該周年窗口起點（與 getAnniversaryWindow().start 對齊） */
  windowStart: {
    type: Date,
    required: true,
  },
  windowEnd: {
    type: Date,
    required: true,
  },
  yearIndex: {
    type: Number,
    required: true,
    min: 1,
  },
  annualSpentAtFulfillment: {
    type: Number,
    default: 0,
  },
  redeemCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
    default: null,
  },
  pocket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserRedeemPocket',
    default: null,
  },
  emailSent: {
    type: Boolean,
    default: false,
  },
  fulfilledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  fulfilledAt: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

tierRewardFulfillmentSchema.index(
  { user: 1, tier: 1, windowStart: 1 },
  { unique: true }
);

module.exports = mongoose.model('TierRewardFulfillment', tierRewardFulfillmentSchema);
