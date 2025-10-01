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
  endDate: {
    type: Date,
    required: false // 如果跨天則需要，否則與 date 相同
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
    min: [60, '預約時長至少60分鐘'],
    max: [120, '預約時長最多120分鐘（2小時）']
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
  const bookingDate = new Date(date);
  
  // 計算新預約的結束日期
  const timeToMinutes = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  };
  
  const newStartMinutes = timeToMinutes(startTime);
  const newEndMinutes = timeToMinutes(endTime);
  const isOvernight = newEndMinutes <= newStartMinutes;
  
  const newEndDate = new Date(bookingDate);
  if (isOvernight) {
    newEndDate.setDate(newEndDate.getDate() + 1);
  }
  
  // 查找可能衝突的預約：當天或下一天
  const query = {
    court: courtId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      { date: bookingDate }, // 當天的預約
      { date: newEndDate }   // 跨天預約可能影響下一天
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  const conflictingBookings = await this.find(query);
  
  // 將日期和時間轉換為 timestamp 以便精確比較
  const newStartTimestamp = bookingDate.getTime() + newStartMinutes * 60 * 1000;
  const newEndTimestamp = newEndDate.getTime() + newEndMinutes * 60 * 1000;
  
  return conflictingBookings.some(booking => {
    const bookingStartMinutes = timeToMinutes(booking.startTime);
    const bookingEndMinutes = timeToMinutes(booking.endTime);
    
    // 使用 endDate 如果存在，否則假設與 date 相同
    const bookingEndDate = booking.endDate || booking.date;
    
    const bookingStartTimestamp = booking.date.getTime() + bookingStartMinutes * 60 * 1000;
    const bookingEndTimestamp = bookingEndDate.getTime() + bookingEndMinutes * 60 * 1000;
    
    // 檢查是否有時間重疊
    return (newStartTimestamp < bookingEndTimestamp && newEndTimestamp > bookingStartTimestamp);
  });
};

// 計算總價格
bookingSchema.methods.calculatePrice = function(court, isMember = false) {
  // 使用新的價格結構，傳遞日期以判斷是否為週末
  const hourlyPrice = court.getPriceForTime(this.startTime, this.date);
  
  // 計算實際時長（小時）
  const startMinutes = parseInt(this.startTime.split(':')[0]) * 60 + parseInt(this.startTime.split(':')[1]);
  let endMinutes = parseInt(this.endTime.split(':')[0]) * 60 + parseInt(this.endTime.split(':')[1]);
  
  // 如果結束時間小於開始時間，表示跨天（例如 22:00 到 00:00）
  if (endMinutes <= startMinutes) {
    endMinutes += 24 * 60; // 加上 24 小時
  }
  
  const durationHours = (endMinutes - startMinutes) / 60;
  
  // 計算基礎價格（每小時價格 × 時長）
  const basePrice = hourlyPrice * durationHours;
  
  // 會員折扣（如果用戶是會員）
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


