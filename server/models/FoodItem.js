const mongoose = require('mongoose');

const foodItemSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: [true, '店鋪為必填項目'],
    index: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodCategory',
    required: [true, '類別為必填項目'],
    index: true,
  },
  name: {
    type: String,
    required: [true, '餐點名稱為必填項目'],
    trim: true,
    maxlength: [100, '餐點名稱不能超過100個字符'],
  },
  description: {
    type: String,
    trim: true,
    default: '',
    maxlength: [500, '描述不能超過500個字符'],
  },
  /** 積分價錢 */
  price: {
    type: Number,
    required: [true, '價錢為必填項目'],
    min: [0, '價錢不能為負數'],
  },
  /** 相對 uploads/ 路徑，例 food/xxx.jpg */
  image: {
    type: String,
    trim: true,
    default: '',
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

foodItemSchema.index({ store: 1, category: 1, sortOrder: 1 });
foodItemSchema.index({ store: 1, isAvailable: 1 });

module.exports = mongoose.model('FoodItem', foodItemSchema);
