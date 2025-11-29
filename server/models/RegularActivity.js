const mongoose = require('mongoose');

const regularActivitySchema = new mongoose.Schema({
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
  introduction: {
    type: String,
    required: [true, '活動介紹為必填項目'],
    trim: true,
    maxlength: [2000, '活動介紹不能超過2000個字符']
  },
  poster: {
    type: String, // 海報圖片URL
    default: null
  },
  requirements: {
    type: String,
    trim: true,
    maxlength: [500, '活動要求不能超過500個字符']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引
regularActivitySchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('RegularActivity', regularActivitySchema);

