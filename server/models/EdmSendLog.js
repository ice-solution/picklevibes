const mongoose = require('mongoose');

const edmSendLogSchema = new mongoose.Schema(
  {
    campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EdmCampaign',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 320
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      required: true
    },
    errorMessage: { type: String, maxlength: 2000, default: '' },
    sentAt: { type: Date, required: true }
  },
  { timestamps: false }
);

edmSendLogSchema.index({ campaign: 1, email: 1 });
edmSendLogSchema.index({ campaign: 1, status: 1 });

module.exports = mongoose.model('EdmSendLog', edmSendLogSchema);
