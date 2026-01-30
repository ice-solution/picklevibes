const mongoose = require('mongoose');

const redeemCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['fixed', 'percentage'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: [0, '折扣值不能為負數']
  },
  // 固定金額折扣 (type: 'fixed')
  // 百分比折扣 (type: 'percentage', value: 20 = 8折)
  minAmount: {
    type: Number,
    default: 0,
    min: [0, '最低消費金額不能為負數']
  },
  maxDiscount: {
    type: Number,
    default: null,
    min: [0, '最大折扣金額不能為負數']
  },
  // 使用限制
  usageLimit: {
    type: Number,
    default: null, // null = 無限制
    min: [1, '使用次數限制必須大於0']
  },
  userUsageLimit: {
    type: Number,
    default: 1, // 每個用戶最多使用次數
    min: [1, '每用戶使用次數限制必須大於0']
  },
  // 有效期
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: true
  },
  // 狀態
  isActive: {
    type: Boolean,
    default: true
  },
  // 統計
  totalUsed: {
    type: Number,
    default: 0
  },
  totalDiscount: {
    type: Number,
    default: 0
  },
  // 適用範圍
  applicableTypes: [{
    type: String,
    enum: ['booking', 'recharge', 'activity', 'product', 'eshop', 'all'],
    default: 'all'
  }],
  // 專用代碼限制（如果設置，則只能在此代碼指定的地方使用）
  // 如果為空或 null，則可以在所有 applicableTypes 指定的地方使用
  // 如果設置了，則需要檢查是否匹配當前使用場景
  restrictedCode: {
    type: String,
    trim: true,
    default: null // null = 無限制，可以在所有地方使用
  },
  // 創建者
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引優化查詢
redeemCodeSchema.index({ code: 1 });
redeemCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

// 驗證兌換碼是否有效
redeemCodeSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.validFrom && 
         now <= this.validUntil &&
         (this.usageLimit === null || this.totalUsed < this.usageLimit);
};

// 計算折扣金額
redeemCodeSchema.methods.calculateDiscount = function(amount) {
  if (!this.isValid() || amount < this.minAmount) {
    return 0;
  }

  let discount = 0;
  
  if (this.type === 'fixed') {
    discount = this.value;
  } else if (this.type === 'percentage') {
    discount = (amount * this.value) / 100;
  }

  // 應用最大折扣限制
  if (this.maxDiscount && discount > this.maxDiscount) {
    discount = this.maxDiscount;
  }

  // 確保折扣不超過原金額
  return Math.min(discount, amount);
};

// 檢查用戶是否可以使用此兌換碼
redeemCodeSchema.methods.canUserUse = async function(userId) {
  const RedeemUsage = require('./RedeemUsage');
  const userUsageCount = await RedeemUsage.countDocuments({
    redeemCode: this._id,
    user: userId
  });
  
  return userUsageCount < this.userUsageLimit;
};

module.exports = mongoose.model('RedeemCode', redeemCodeSchema);
