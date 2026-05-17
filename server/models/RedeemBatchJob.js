const mongoose = require('mongoose');

const redeemBatchJobSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  createdCount: {
    type: Number,
    default: 0,
  },
  template: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  errorMessage: {
    type: String,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

redeemBatchJobSchema.index({ status: 1, createdAt: -1 });
redeemBatchJobSchema.index({ batchId: 1 });

module.exports = mongoose.model('RedeemBatchJob', redeemBatchJobSchema);
