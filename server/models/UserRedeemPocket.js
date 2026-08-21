const mongoose = require('mongoose');

/**
 * 用戶兌換券口袋：沿用 RedeemCode，記錄「這張券在某用戶袋內」。
 * 同一用戶對同一兌換碼只保留一筆口袋記錄。
 */
const userRedeemPocketSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  redeemCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
    required: true,
    index: true,
  },
  /** admin_assign = 後台派發；user_claim = 用戶自行輸入入袋 */
  source: {
    type: String,
    enum: ['admin_assign', 'user_claim'],
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'used', 'removed'],
    default: 'available',
    index: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  lastRedeemUsage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemUsage',
    default: null,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

userRedeemPocketSchema.index({ user: 1, redeemCode: 1 }, { unique: true });
userRedeemPocketSchema.index({ user: 1, status: 1, assignedAt: -1 });

module.exports = mongoose.model('UserRedeemPocket', userRedeemPocketSchema);
