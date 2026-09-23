const mongoose = require('mongoose');

const foodOrderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodItem',
    required: true,
  },
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  lineTotal: { type: Number, required: true, min: 0 },
}, { _id: false });

const foodOrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },
  items: {
    type: [foodOrderItemSchema],
    validate: {
      validator(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: '訂單至少需要一項餐點',
    },
  },
  totalPoints: {
    type: Number,
    required: true,
    min: [0, '總額不能為負數'],
  },
  notes: {
    type: String,
    trim: true,
    default: '',
    maxlength: [300, '備註不能超過300個字符'],
  },
  status: {
    type: String,
    enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  notifyResult: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  pointsChargedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

foodOrderSchema.index({ store: 1, createdAt: -1 });
foodOrderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('FoodOrder', foodOrderSchema);
