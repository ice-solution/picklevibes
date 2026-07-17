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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  /** 歸屬店鋪（null = PickCourt 平台充值優惠） */
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
    index: true,
  },
}, {
  timestamps: true
});

// 索引優化查詢
rechargeOfferSchema.index({ store: 1, isActive: 1, expiryDate: 1 });
rechargeOfferSchema.index({ store: 1, sortOrder: 1 });
rechargeOfferSchema.index({ isActive: 1, expiryDate: 1 });

module.exports = mongoose.model('RechargeOffer', rechargeOfferSchema);
