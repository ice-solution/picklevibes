const mongoose = require('mongoose');

const coachClassSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: '教練課堂',
      maxlength: [120, '標題過長'],
    },
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    locationType: {
      type: String,
      enum: ['court', 'custom'],
      default: 'court',
    },
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
  },
  { timestamps: true }
);

coachClassSchema.index({ coach: 1, sessionDate: 1, status: 1 });

coachClassSchema.pre('validate', function validateLocation(next) {
  if (this.locationType === 'court' && !this.court) {
    this.invalidate('court', '請選擇場地');
  }
  if (this.locationType === 'custom' && !String(this.customLocation || '').trim()) {
    this.invalidate('customLocation', '請填寫地點');
  }
  next();
});

module.exports = mongoose.model('CoachClass', coachClassSchema);
