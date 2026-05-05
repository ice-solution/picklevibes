const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  /** 一年內消費滿多少（積分）即可達到此 tier */
  minAnnualSpent: {
    type: Number,
    required: true,
    min: 0
  },
  /** 顯示用顏色（hex/rgb/css color） */
  color: {
    type: String,
    default: '#2563eb', // blue-600
    trim: true,
    maxlength: 32
  },
  /** 福利內容（多行） */
  benefits: {
    type: [String],
    default: []
  },
  /** 用於排序顯示（小的在前） */
  sortOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

tierSchema.index({ minAnnualSpent: 1 });
tierSchema.index({ sortOrder: 1, minAnnualSpent: 1 });

module.exports = mongoose.model('Tier', tierSchema);

