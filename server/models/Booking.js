const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '用戶為必填項目']
  },
  court: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Court',
    required: [true, '場地為必填項目']
  },
  date: {
    type: Date,
    required: [true, '預約日期為必填項目']
  },
  startTime: {
    type: String,
    required: [true, '開始時間為必填項目'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '請輸入有效的時間格式 (HH:MM)']
  },
  endTime: {
    type: String,
    required: [true, '結束時間為必填項目'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '請輸入有效的時間格式 (HH:MM)']
  },
  duration: {
    type: Number,
    required: [true, '預約時長為必填項目'],
    min: [30, '預約時長至少30分鐘'],
    max: [240, '預約時長最多240分鐘']
  },
  players: [{
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }
  }],
  totalPlayers: {
    type: Number,
    required: [true, '總人數為必填項目'],
    min: [1, '至少需要1人'],
    max: [8, '最多8人']
  },
  pricing: {
    basePrice: { type: Number, required: true },
    memberDiscount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'pending'
  },
  payment: {
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    method: {
      type: String,
      enum: ['stripe', 'cash', 'bank_transfer'],
      default: 'stripe'
    },
    transactionId: String,
    paidAt: Date,
    refundedAt: Date
  },
  specialRequests: {
    type: String,
    maxlength: [500, '特殊要求不能超過500個字符']
  },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ['user', 'admin', 'system']
    },
    reason: String,
    refundAmount: Number
  },
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'sms'],
      required: true
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'pending'
    }
  }]
}, {
  timestamps: true
});

// 索引優化查詢
bookingSchema.index({ court: 1, date: 1, startTime: 1 });
bookingSchema.index({ user: 1, date: 1 });
bookingSchema.index({ status: 1, date: 1 });

// 檢查時間衝突
bookingSchema.statics.checkTimeConflict = async function(courtId, date, startTime, endTime, excludeId = null) {
  const query = {
    court: courtId,
    date: new Date(date),
    status: { $in: ['confirmed', 'pending'] }
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflictingBookings = await this.find(query);
  
  return conflictingBookings.some(booking => {
    const bookingStart = booking.startTime;
    const bookingEnd = booking.endTime;
    
    return (startTime < bookingEnd && endTime > bookingStart);
  });
};

// 計算總價格
bookingSchema.methods.calculatePrice = function(court, isMember = false) {
  // 使用新的價格結構，傳遞日期以判斷是否為週末
  const basePrice = court.getPriceForTime(this.startTime, this.date);
  const memberDiscount = isMember ? court.pricing.memberDiscount : 0;
  
  this.pricing.basePrice = basePrice;
  this.pricing.memberDiscount = memberDiscount;
  this.pricing.totalPrice = basePrice * (1 - memberDiscount / 100);
  
  return this.pricing.totalPrice;
};

// 檢查是否可以取消
bookingSchema.methods.canBeCancelled = function() {
  if (this.status === 'cancelled' || this.status === 'completed') {
    return false;
  }
  
  const bookingDateTime = new Date(`${this.date.toDateString()} ${this.startTime}`);
  const now = new Date();
  const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);
  
  return hoursUntilBooking >= 2; // 至少提前2小時取消
};

module.exports = mongoose.model('Booking', bookingSchema);


