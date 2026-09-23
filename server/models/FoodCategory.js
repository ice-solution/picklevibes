const mongoose = require('mongoose');

const foodCategorySchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, '店鋪為必填項目'],
    index: true,
  },
  name: {
    type: String,
    required: [true, '類別名稱為必填項目'],
    trim: true,
    maxlength: [80, '類別名稱不能超過80個字符'],
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [300, '描述不能超過300個字符'],
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

foodCategorySchema.index({ store: 1, sortOrder: 1 });
foodCategorySchema.index({ store: 1, name: 1 });

module.exports = mongoose.model('FoodCategory', foodCategorySchema);
