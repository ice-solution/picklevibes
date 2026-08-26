const mongoose = require('mongoose');

const coachPaymentSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** 建立時由教練預設時薪帶入 */
    hourlyRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** 本堂應付（預設 = 時薪 × 時數，admin 可改） */
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const coachClassSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '教練課堂',
      maxlength: [120, '標題過長'],
    },
    /** 本堂所屬店鋪（多場必須同一店；自訂地點亦要指定） */
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    /** 多教練（同一堂） */
    coaches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    /** 舊單教練欄位（相容讀取；寫入時與 coaches[0] 同步） */
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    coachPayments: [coachPaymentSchema],
    locationType: {
      type: String,
      enum: ['court', 'custom'],
      default: 'court',
    },
    /** 多場地（必須屬同一 store） */
    courts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Court',
      },
    ],
    /** 舊單場欄位 */
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      default: null,
    },
    customLocation: {
      type: String,
      trim: true,
      maxlength: [200, '地點過長'],
      default: '',
    },
    sessionDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '開始時間格式須為 HH:MM'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/, '結束時間格式須為 HH:MM 或 24:00'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, '備註過長'],
    },
    /** 連結活動中心（同 logic、不同顯示） */
    activity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Activity',
      default: null,
      index: true,
    },
    /** 連結恆常班（課程標籤／模板） */
    regularActivity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RegularActivity',
      default: null,
      index: true,
    },
    /** 各場 hold 場預約 */
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid'],
      default: 'unpaid',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    accountingTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountingTransaction',
      default: null,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

coachClassSchema.index({ coaches: 1, sessionDate: 1, status: 1 });
coachClassSchema.index({ store: 1, sessionDate: -1 });
coachClassSchema.index({ status: 1, sessionDate: 1, reminderSentAt: 1 });
coachClassSchema.index({ paymentStatus: 1, status: 1 });

coachClassSchema.pre('validate', function validateCoachClass(next) {
  const coachIds = Array.isArray(this.coaches) ? this.coaches.filter(Boolean) : [];
  if (this.coach && !coachIds.length) {
    this.coaches = [this.coach];
  } else if (coachIds.length && !this.coach) {
    this.coach = coachIds[0];
  }
  if (!this.coaches || this.coaches.length === 0) {
    this.invalidate('coaches', '請至少選擇一位教練');
  }

  if (this.locationType === 'court') {
    const courtIds = Array.isArray(this.courts) ? this.courts.filter(Boolean) : [];
    if (this.court && !courtIds.length) {
      this.courts = [this.court];
    } else if (courtIds.length && !this.court) {
      this.court = courtIds[0];
    }
    if (!this.courts || this.courts.length === 0) {
      this.invalidate('courts', '請至少選擇一個場地');
    }
  }
  if (this.locationType === 'custom' && !String(this.customLocation || '').trim()) {
    this.invalidate('customLocation', '請填寫地點');
  }
  if (!this.store) {
    this.invalidate('store', '請選擇店鋪');
  }
  next();
});

module.exports = mongoose.model('CoachClass', coachClassSchema);
