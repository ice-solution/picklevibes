const mongoose = require('mongoose');

const coachScheduleRequestSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    /** 預約日期（與場地預約 date 一致，含時區之日期） */
    requestDate: {
      type: Date,
      required: true
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, '開始時間格式須為 HH:MM']
    },
    endTime: {
      type: String,
      required: true,
      match: [/^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/, '結束時間格式須為 HH:MM 或 24:00']
    },
    message: {
      type: String,
      trim: true,
      maxlength: [2000, '訊息過長']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    /** 管理員批核時指定 */
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Court',
      default: null
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    processedAt: {
      type: Date,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, '理由過長']
    }
  },
  { timestamps: true }
);

coachScheduleRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('CoachScheduleRequest', coachScheduleRequestSchema);
