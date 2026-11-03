const mongoose = require('mongoose');

const payoutLineSchema = new mongoose.Schema(
  {
    coachClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoachClass',
      required: true,
    },
    title: { type: String, default: '' },
    sessionDate: { type: Date },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    locationLabel: { type: String, default: '' },
    hours: { type: Number, default: 0 },
    hourlyRate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    multiCoach: { type: Boolean, default: false },
  },
  { _id: false }
);

const coachPayoutSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dateFrom: { type: String, required: true },
    dateTo: { type: String, required: true },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      default: null,
    },
    classCount: { type: Number, default: 0 },
    totalHours: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    lines: [payoutLineSchema],
    classIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CoachClass',
      },
    ],
    pdfPath: { type: String, default: '' },
    multiCoachClassCount: { type: Number, default: 0 },
    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    settledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

coachPayoutSchema.index({ coach: 1, settledAt: -1 });
coachPayoutSchema.index({ settledAt: -1 });

module.exports = mongoose.model('CoachPayout', coachPayoutSchema);
