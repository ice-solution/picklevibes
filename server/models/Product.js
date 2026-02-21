const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '產品名稱為必填項目'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  details: {
    type: String,
    trim: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, '產品分類為必填項目']
  },
  price: {
    type: Number,
    required: [true, '產品價格為必填項目'],
    min: [0, '價格不能為負數']
  },
  discountPrice: {
    type: Number,
    default: null,
    min: [0, '折扣價格不能為負數'],
    validate: {
      validator: function(value) {
        if (value === null || value === undefined) return true;
        const price = this.price;
        // findByIdAndUpdate 時 this 可能無 price，交由 route 驗證
        if (price == null || typeof price !== 'number') return true;
        return value < price;
      },
      message: '折扣價格必須小於原價'
    }
  },
  images: [{
    type: String, // 圖片路徑
    required: true
  }],
  stock: {
    type: Number,
    default: 0,
    min: [0, '庫存不能為負數']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isActive: 1, sortOrder: 1 });

// 虛擬字段：當前價格（如果有折扣價格則返回折扣價格，否則返回原價）
productSchema.virtual('currentPrice').get(function() {
  return this.discountPrice !== null && this.discountPrice < this.price 
    ? this.discountPrice 
    : this.price;
});

// 確保虛擬字段在 JSON 輸出中包含
productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);






