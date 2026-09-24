const mongoose = require('mongoose');

const rechargeOfferSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, '優惠名稱不能超過100個字符']
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
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, '描述不能超過500個字符']
  },
  expiryDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  /**
   * 充值成功後自動派入用戶兌換券口袋的兌換碼（同一用戶同一碼只保留一筆口袋）
   */
  bonusRedeemCodes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
  }],
  /**
   * 贈券有效天數：由充值成功當日起計（個人券 validFrom/validUntil）
   * 兌換碼本身只作折扣／適用範圍範本
   */
  bonusRedeemValidDays: {
    type: Number,
    default: 30,
    min: [1, '贈券有效天數至少為1'],
    max: [365, '贈券有效天數最多365'],
  },
  /** 充值成功後升級會籍（疊在 VIP 之上；到期回 vip） */
  grantMembershipLevel: {
    type: String,
    enum: ['silver', 'gold', 'platinum'],
    default: null,
  },
  grantMembershipMonths: {
    type: Number,
    default: null,
    min: [1, '會籍月數至少為1'],
    max: [120, '會籍月數最多120'],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引優化查詢
rechargeOfferSchema.index({ isActive: 1, expiryDate: 1 });
rechargeOfferSchema.index({ sortOrder: 1 });

module.exports = mongoose.model('RechargeOffer', rechargeOfferSchema);
