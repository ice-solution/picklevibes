const mongoose = require('mongoose');

const rechargeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: [1, '充值積分必須大於0']
  },
  amount: {
    type: Number,
    required: true,
    min: [1, '充值金額必須大於0']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  paymentIntentId: {
    type: String,
    required: false, // 改為非必需，因為手動充值可能沒有 paymentIntentId
    unique: true,
    sparse: true // 允許 null 值但保持唯一性
  },
  description: {
    type: String,
    default: '帳戶充值'
  },
  redeemCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
    required: false
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  payment: {
    method: {
      type: String,
      enum: ['stripe', 'alipay', 'wechat', 'manual'],
      required: true
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date,
    refundedAt: Date
  },
  // 追蹤積分是否已經添加過
  pointsAdded: {
    type: Boolean,
    default: false
  },
  // 追蹤積分是否已經扣除過（用於取消）
  pointsDeducted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// 索引優化查詢
rechargeSchema.index({ user: 1, status: 1 });
rechargeSchema.index({ 'payment.transactionId': 1 });
rechargeSchema.index({ paymentIntentId: 1 });

module.exports = mongoose.model('Recharge', rechargeSchema);
