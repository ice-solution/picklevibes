const mongoose = require('mongoose');
const weekendService = require('../services/weekendService');

/**
 * 預約開始時間 (HH:MM) 是否落在 pricing.timeSlots 某一格
 * - 一般同日：startTime < endTime（例如 07:00–16:00）
 * - 跨日：startTime > endTime（例如 23:00–07:00，含當晚 23:00 起至翌日 07:00 前）
 */
function isStartTimeInPricingSlot(startTime, slot) {
  const st = slot.startTime;
  const et = slot.endTime;
  if (!startTime || st == null || et == null || st === et) return false;
  if (st < et) {
    return startTime >= st && startTime < et;
  }
  return startTime >= st || startTime < et;
}

const courtSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, '店鋪為必填項目'],
    index: true,
  },
  name: {
    type: String,
    required: [true, '場地名稱為必填項目'],
    trim: true,
    maxlength: [50, '場地名稱不能超過50個字符']
  },
  number: {
    type: Number,
    required: [true, '場地編號為必填項目'],
    min: [1, '場地編號必須大於0']
  },
  type: {
    type: String,
    enum: ['competition', 'training', 'solo', 'dink', 'full_venue'],
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
    enum: ['air_conditioning', 'lighting', 'net', 'paddles', 'balls', 'water', 'shower', 'vending_machine']
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
  }],
  /** 場地級 Tuya 設備（一場可多掣：燈、冷氣等） */
  enableTuyaAutomation: {
    type: Boolean,
    default: false,
  },
  tuyaDevices: [{
    deviceId: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: '設備',
    },
    /** 涂鴉 DP code，單路開關常見 switch_1（見 tyua-sample.js） */
    switchCode: {
      type: String,
      trim: true,
      default: 'switch_1',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  }],
}, {
  timestamps: true
});

courtSchema.index({ store: 1, number: 1 }, { unique: true });
courtSchema.index({ store: 1, isActive: 1, type: 1 });

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
courtSchema.methods.isOpenAt = function(date, startTime = null, endTime = null) {
  // 確保 date 是 Date 對象
  const dateObj = new Date(date);
  
  // 獲取星期幾
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[dateObj.getDay()];
  const daySchedule = this.operatingHours[dayOfWeek];
  
  if (!daySchedule || !daySchedule.isOpen) {
    return false;
  }
  
  // 如果提供了具體的預約時間，檢查是否在營業時間範圍內
  if (startTime && endTime) {
    const startTimeStr = startTime.substring(0, 5); // 格式：HH:MM
    let endTimeStr = endTime.substring(0, 5);
    
    // 檢查開始時間是否在營業時間範圍內
    const isStartInRange = startTimeStr >= daySchedule.start && startTimeStr < daySchedule.end;
    
    // 檢查結束時間是否在營業時間範圍內
    let isEndInRange;
    
    // 處理 24:00 的特殊情況
    if (endTime === '24:00') {
      // 24:00 應該被視為當天的結束時間，檢查是否在營業時間內
      isEndInRange = '24:00' <= daySchedule.end;
    } else {
      // 判斷是否跨天：結束時間小於開始時間
      const isOvernight = endTimeStr < startTimeStr;
      
      if (isOvernight) {
        // 跨天情況：檢查隔天的營業時間
        const nextDay = new Date(dateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayOfWeek = dayNames[nextDay.getDay()];
        const nextDaySchedule = this.operatingHours[nextDayOfWeek];
        
        if (!nextDaySchedule || !nextDaySchedule.isOpen) {
          isEndInRange = false;
        } else {
          // 隔天的結束時間應該在隔天的營業時間內
          isEndInRange = endTimeStr >= nextDaySchedule.start && endTimeStr <= nextDaySchedule.end;
        }
      } else {
        // 非跨天情況：正常檢查當天的營業時間
        isEndInRange = endTimeStr > daySchedule.start && endTimeStr <= daySchedule.end;
      }
    }
    
    return isStartInRange && isEndInRange;
  }
  
  // 如果沒有提供具體時間，只檢查日期
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
  
  // 週末/紅日判定：Holiday 會被視為 weekend，但紅日需使用「紅日」價格（若有配置）
  const isWeekend = date ? this.isWeekend(date) : false;
  const weekendType = date ? weekendService.getWeekendType(date) : 'weekday';
  const hour = parseInt(startTime.split(':')[0]);

  // 週末/紅日：08:00-24:00 優先使用「紅日」slot（若有配置），否則 fallback 到「繁忙時間」
  // 注意：目前營運規則把星期六/日也視為可套用「紅日」價格（若場地有設置「紅日」時段）。
  if (isWeekend) {
    if (hour >= 8 && hour < 24) {
      const holidaySlot = this.pricing.timeSlots.find((slot) => slot.name === '紅日');
      if (holidaySlot) return holidaySlot.price;
      const peakSlot = this.pricing.timeSlots.find((slot) => slot.name === '繁忙時間');
      if (peakSlot) return peakSlot.price;
    }
  }
  
  // 找到匹配的時段（含跨日貓頭鷹 23:00–07:00）
  for (const timeSlot of this.pricing.timeSlots) {
    if (isStartTimeInPricingSlot(startTime, timeSlot)) {
      return timeSlot.price;
    }
  }
  
  // 如果沒有匹配的時段，返回0表示不開放
  return 0;
};

// 獲取時段名稱
courtSchema.methods.getTimeSlotName = function(startTime, date = null) {
  if (!this.pricing.timeSlots || this.pricing.timeSlots.length === 0) {
    return '標準時段';
  }
  
  // 檢查是否為週末/紅日 - 使用自定義判定方法
  const isWeekend = date ? this.isWeekend(date) : false;
  const weekendType = date ? weekendService.getWeekendType(date) : 'weekday';
  const hour = parseInt(startTime.split(':')[0]);

  // 週末/紅日：08:00-24:00 若有「紅日」slot 則顯示紅日，否則顯示繁忙時間
  if (isWeekend) {
    if (hour >= 8 && hour < 24) {
      const hasHolidaySlot = this.pricing.timeSlots?.some((slot) => slot.name === '紅日');
      return hasHolidaySlot ? '紅日' : '繁忙時間';
    }
  }
  
  for (const timeSlot of this.pricing.timeSlots) {
    if (isStartTimeInPricingSlot(startTime, timeSlot)) {
      return timeSlot.name;
    }
  }
  
  return '標準時段';
};

// 自定義週末判定方法 - 使用週末服務
courtSchema.methods.isWeekend = function(date) {
  return weekendService.isWeekend(date);
};

module.exports = mongoose.model('Court', courtSchema);


