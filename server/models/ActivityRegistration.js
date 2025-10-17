const mongoose = require('mongoose');

const activityRegistrationSchema = new mongoose.Schema({
  activity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Activity',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participantCount: {
    type: Number,
    required: [true, '參加人數為必填項目'],
    min: [1, '參加人數至少為1人'],
    max: [10, '單次報名最多10人'] // 防止濫用
  },
  totalCost: {
    type: Number,
    required: true
  },
  contactInfo: {
    email: {
      type: String,
      required: [true, '聯繫郵箱為必填項目'],
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '請輸入有效的電子郵件地址']
    },
    phone: {
      type: String,
      required: [true, '聯繫電話為必填項目'],
      match: [/^[0-9+\-\s()]+$/, '請輸入有效的電話號碼']
    }
  },
  status: {
    type: String,
    enum: ['registered', 'cancelled', 'completed'],
    default: 'registered'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'paid' // 使用積分支付，默認為已支付
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [200, '備註不能超過200個字符']
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// 複合索引：確保用戶不能重複報名同一個活動
activityRegistrationSchema.index({ activity: 1, user: 1 }, { unique: true });

// 索引
activityRegistrationSchema.index({ user: 1, createdAt: -1 });
activityRegistrationSchema.index({ activity: 1, status: 1 });

// 虛擬字段：檢查是否可以取消
activityRegistrationSchema.virtual('canCancel').get(function() {
  const now = new Date();
  return this.status === 'registered' && 
         now < this.activity?.registrationDeadline;
});

// 中間件：計算總費用
activityRegistrationSchema.pre('save', async function(next) {
  if (this.isModified('participantCount') || this.isNew) {
    const Activity = mongoose.model('Activity');
    const activity = await Activity.findById(this.activity);
    if (activity) {
      this.totalCost = activity.price * this.participantCount;
    }
  }
  next();
});

// 實例方法：取消報名
activityRegistrationSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// 靜態方法：獲取用戶的活動報名記錄
activityRegistrationSchema.statics.getUserRegistrations = function(userId, options = {}) {
  const query = { user: userId };
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .populate({
      path: 'activity',
      select: 'title description startDate endDate location status poster'
    })
    .sort({ createdAt: -1 });
};

// 靜態方法：獲取活動的報名統計
activityRegistrationSchema.statics.getActivityStats = function(activityId) {
  return this.aggregate([
    { $match: { activity: mongoose.Types.ObjectId(activityId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalParticipants: { $sum: '$participantCount' },
        totalRevenue: { $sum: '$totalCost' }
      }
    }
  ]);
};

module.exports = mongoose.model('ActivityRegistration', activityRegistrationSchema);
