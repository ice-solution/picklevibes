const mongoose = require('mongoose');

const redeemUsageSchema = new mongoose.Schema({
  redeemCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 使用時的訂單信息
  orderType: {
    type: String,
    enum: ['booking', 'recharge'],
    required: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // 折扣信息
  originalAmount: {
    type: Number,
    required: true,
    min: [0, '原始金額不能為負數']
  },
  discountAmount: {
    type: Number,
    required: true,
    min: [0, '折扣金額不能為負數']
  },
  finalAmount: {
    type: Number,
    required: true,
    min: [0, '最終金額不能為負數']
  },
  // 使用時的信息
  usedAt: {
    type: Date,
    default: Date.now
  },
  // 使用時的IP地址（用於安全追蹤）
  ipAddress: String,
  // 使用時的用戶代理（用於安全追蹤）
  userAgent: String
}, {
  timestamps: true
});

// 索引優化查詢
redeemUsageSchema.index({ redeemCode: 1, user: 1 });
redeemUsageSchema.index({ user: 1, usedAt: -1 });
redeemUsageSchema.index({ orderType: 1, orderId: 1 });

module.exports = mongoose.model('RedeemUsage', redeemUsageSchema);
