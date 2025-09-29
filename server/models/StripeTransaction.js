const mongoose = require('mongoose');

const stripeTransactionSchema = new mongoose.Schema({
  // Stripe 支付意圖 ID
  paymentIntentId: {
    type: String,
    required: [true, '支付意圖ID為必填項目'],
    unique: true
  },
  
  // 關聯的預約ID
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, '預約ID為必填項目']
  },
  
  // 用戶ID
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '用戶ID為必填項目']
  },
  
  // 支付金額（以分為單位）
  amount: {
    type: Number,
    required: [true, '支付金額為必填項目'],
    min: [0, '支付金額不能為負數']
  },
  
  // 貨幣
  currency: {
    type: String,
    required: [true, '貨幣為必填項目'],
    default: 'hkd'
  },
  
  // 支付狀態
  status: {
    type: String,
    enum: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'succeeded', 'canceled', 'requires_capture'],
    required: [true, '支付狀態為必填項目']
  },
  
  // 支付方法
  paymentMethod: {
    type: {
      id: String,
      type: String, // card, alipay, etc.
      card: {
        brand: String,
        last4: String,
        exp_month: Number,
        exp_year: Number
      }
    }
  },
  
  // 客戶信息
  customer: {
    email: String,
    name: String,
    phone: String
  },
  
  // 支付描述
  description: String,
  
  // 元數據
  metadata: {
    type: Map,
    of: String
  },
  
  // 支付時間
  paidAt: {
    type: Date
  },
  
  // 取消時間
  canceledAt: {
    type: Date
  },
  
  // 退款信息
  refunds: [{
    refundId: String,
    amount: Number,
    reason: String,
    status: String,
    createdAt: Date
  }],
  
  // 錯誤信息
  lastPaymentError: {
    type: {
      code: String,
      message: String,
      type: String
    }
  },
  
  // 原始 Stripe 響應數據
  stripeResponse: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// 索引
stripeTransactionSchema.index({ paymentIntentId: 1 });
stripeTransactionSchema.index({ booking: 1 });
stripeTransactionSchema.index({ user: 1 });
stripeTransactionSchema.index({ status: 1 });
stripeTransactionSchema.index({ createdAt: -1 });

// 虛擬字段：金額（元）
stripeTransactionSchema.virtual('amountInDollars').get(function() {
  return this.amount / 100;
});

// 方法：更新支付狀態
stripeTransactionSchema.methods.updateStatus = function(newStatus, additionalData = {}) {
  this.status = newStatus;
  
  if (newStatus === 'succeeded') {
    this.paidAt = new Date();
  } else if (newStatus === 'canceled') {
    this.canceledAt = new Date();
  }
  
  // 更新其他字段
  Object.assign(this, additionalData);
  
  return this.save();
};

// 方法：添加退款記錄
stripeTransactionSchema.methods.addRefund = function(refundData) {
  this.refunds.push({
    refundId: refundData.id,
    amount: refundData.amount,
    reason: refundData.reason || 'requested_by_customer',
    status: refundData.status,
    createdAt: new Date()
  });
  
  return this.save();
};

module.exports = mongoose.model('StripeTransaction', stripeTransactionSchema);
