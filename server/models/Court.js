const mongoose = require('mongoose');

const courtSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '場地名稱為必填項目'],
    trim: true,
    maxlength: [50, '場地名稱不能超過50個字符']
  },
  number: {
    type: Number,
    required: [true, '場地編號為必填項目'],
    unique: true,
    min: [1, '場地編號必須大於0']
  },
  type: {
    type: String,
    enum: ['indoor', 'outdoor', 'dink'],
    required: [true, '場地類型為必填項目']
  },
  description: {
    type: String,
    maxlength: [500, '場地描述不能超過500個字符']
  },
  capacity: {
    type: Number,
    required: [true, '場地容量為必填項目'],
    min: [2, '場地容量至少需要2人'],
    max: [8, '場地容量最多8人']
  },
  amenities: [{
    type: String,
    enum: ['air_conditioning', 'lighting', 'net', 'paddles', 'balls', 'water', 'shower']
  }],
  pricing: {
    // 不同時段的價格設置
    timeSlots: [{
      startTime: { type: String, required: true }, // 例如: "00:00", "06:00", "18:00"
      endTime: { type: String, required: true },   // 例如: "06:00", "18:00", "24:00"
      price: { type: Number, required: true },     // 該時段的價格
      name: { type: String, required: true }       // 時段名稱，例如: "深夜時段", "早鳥時段", "高峰時段"
    }],
    // 舊的價格結構（用於兼容）
    peakHour: {
      type: Number,
      min: [0, '高峰時段價格不能為負數']
    },
    offPeak: {
      type: Number,
      min: [0, '非高峰時段價格不能為負數']
    },
    memberDiscount: {
      type: Number,
      default: 0,
      min: [0, '會員折扣不能為負數'],
      max: [100, '會員折扣不能超過100%']
    }
  },
  operatingHours: {
    monday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    tuesday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    wednesday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    thursday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    friday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    saturday: { start: String, end: String, isOpen: { type: Boolean, default: true } },
    sunday: { start: String, end: String, isOpen: { type: Boolean, default: true } }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  maintenance: {
    isUnderMaintenance: { type: Boolean, default: false },
    maintenanceStart: Date,
    maintenanceEnd: Date,
    maintenanceReason: String
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }]
}, {
  timestamps: true
});

// 檢查場地是否在維護中
courtSchema.methods.isAvailable = function() {
  if (!this.isActive || this.maintenance.isUnderMaintenance) {
    return false;
  }
  
  if (this.maintenance.maintenanceStart && this.maintenance.maintenanceEnd) {
    const now = new Date();
    return now < this.maintenance.maintenanceStart || now > this.maintenance.maintenanceEnd;
  }
  
  return true;
};

// 檢查場地在指定時間是否開放
courtSchema.methods.isOpenAt = function(date) {
  // 確保 date 是 Date 對象
  const dateObj = new Date(date);
  
  // 獲取星期幾
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[dateObj.getDay()];
  const daySchedule = this.operatingHours[dayOfWeek];
  
  if (!daySchedule || !daySchedule.isOpen) {
    return false;
  }
  
  const time = dateObj.toTimeString().substring(0, 5);
  
  // 處理 24:00 的特殊情況
  if (daySchedule.end === '24:00') {
    return time >= daySchedule.start;
  }
  
  return time >= daySchedule.start && time <= daySchedule.end;
};

// 根據時間獲取價格
courtSchema.methods.getPriceForTime = function(startTime, date = null) {
  // 如果沒有設置價格時段，使用舊的 peakHour/offPeak 結構
  if (!this.pricing.timeSlots || this.pricing.timeSlots.length === 0) {
    if (this.pricing.peakHour && this.pricing.offPeak) {
      // 使用舊的邏輯：週末全天 + 工作日 18:00-23:00 為高峰時段
      const hour = parseInt(startTime.split(':')[0]);
      const isWeekend = date ? (date.getDay() === 0 || date.getDay() === 6) : false;
      const isPeakTime = hour >= 18 && hour < 23;
      
      return (isWeekend || isPeakTime) ? this.pricing.peakHour : this.pricing.offPeak;
    }
    return 0;
  }
  
  // 找到匹配的時段
  for (const timeSlot of this.pricing.timeSlots) {
    if (startTime >= timeSlot.startTime && startTime < timeSlot.endTime) {
      return timeSlot.price;
    }
  }
  
  // 如果沒有匹配的時段，返回第一個時段的價格
  return this.pricing.timeSlots[0]?.price || 0;
};

// 獲取時段名稱
courtSchema.methods.getTimeSlotName = function(startTime) {
  if (!this.pricing.timeSlots || this.pricing.timeSlots.length === 0) {
    return '標準時段';
  }
  
  for (const timeSlot of this.pricing.timeSlots) {
    if (startTime >= timeSlot.startTime && startTime < timeSlot.endTime) {
      return timeSlot.name;
    }
  }
  
  return '標準時段';
};

module.exports = mongoose.model('Court', courtSchema);


