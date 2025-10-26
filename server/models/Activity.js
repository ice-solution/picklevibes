const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '活動標題為必填項目'],
    trim: true,
    maxlength: [100, '活動標題不能超過100個字符']
  },
  description: {
    type: String,
    required: [true, '活動描述為必填項目'],
    trim: true,
    maxlength: [1000, '活動描述不能超過1000個字符']
  },
  poster: {
    type: String, // 海報圖片URL
    default: null
  },
  maxParticipants: {
    type: Number,
    required: [true, '人數限制為必填項目'],
    min: [1, '人數限制至少為1人'],
    max: [100, '人數限制最多為100人']
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: [true, '費用為必填項目'],
    min: [0, '費用不能為負數']
  },
  startDate: {
    type: Date,
    required: [true, '活動開始時間為必填項目']
  },
  endDate: {
    type: Date,
    required: [true, '活動結束時間為必填項目']
  },
  registrationDeadline: {
    type: Date,
    required: [true, '報名截止時間為必填項目']
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming'
  },
  location: {
    type: String,
    required: [true, '活動地點為必填項目'],
    trim: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coaches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  requirements: {
    type: String,
    trim: true,
    maxlength: [500, '活動要求不能超過500個字符']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 索引
activitySchema.index({ startDate: 1 });
activitySchema.index({ status: 1 });
activitySchema.index({ registrationDeadline: 1 });

// 虛擬字段：檢查是否可報名
activitySchema.virtual('canRegister').get(function() {
  const now = new Date();
  return this.isActive && 
         this.status === 'upcoming' && 
         now < this.registrationDeadline && 
         this.currentParticipants < this.maxParticipants;
});

// 虛擬字段：檢查是否已截止
activitySchema.virtual('isExpired').get(function() {
  const now = new Date();
  return now > this.registrationDeadline;
});

// 虛擬字段：檢查是否已滿員
activitySchema.virtual('isFull').get(function() {
  return this.currentParticipants >= this.maxParticipants;
});

// 更新活動狀態的中間件
activitySchema.pre('save', function(next) {
  const now = new Date();
  
  // 只有當活動真正結束時才標記為 completed
  if (now > this.endDate) {
    this.status = 'completed';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'ongoing';
  } else {
    // 其他情況都保持為 upcoming
    this.status = 'upcoming';
  }
  
  next();
});

// 實例方法：檢查用戶是否已報名
activitySchema.methods.isUserRegistered = async function(userId) {
  const ActivityRegistration = mongoose.model('ActivityRegistration');
  const registration = await ActivityRegistration.findOne({
    activity: this._id,
    user: userId
  });
  return !!registration;
};

// 實例方法：獲取報名用戶列表
activitySchema.methods.getRegisteredUsers = async function() {
  const ActivityRegistration = mongoose.model('ActivityRegistration');
  return await ActivityRegistration.find({ activity: this._id })
    .populate('user', 'name email phone')
    .sort({ createdAt: 1 });
};

module.exports = mongoose.model('Activity', activitySchema);
