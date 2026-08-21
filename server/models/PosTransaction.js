const mongoose = require('mongoose');

const posItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  color: {
    type: String,
    default: null,
    trim: true,
  },
  size: {
    type: String,
    default: null,
    trim: true,
  },
}, { _id: true });

const PAYMENT_METHODS = ['kpay', 'cash', 'points'];
const STATUSES = ['completed', 'cancelled'];

const posTransactionSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  items: [posItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  redeemCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RedeemCode',
    default: null,
  },
  redeemCodeName: {
    type: String,
    default: '',
    trim: true,
  },
  paymentMethod: {
    type: String,
    enum: PAYMENT_METHODS,
    required: true,
  },
  /** 積分扣數時記錄扣款金額（港元／積分 1:1） */
  pointsChargedAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: STATUSES,
    default: 'completed',
    index: true,
  },
  accountingTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingTransaction',
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cancelReason: {
    type: String,
    trim: true,
    default: '',
  },
  refundAccountingTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccountingTransaction',
    default: null,
  },
}, {
  timestamps: true,
});

posTransactionSchema.index({ createdAt: -1 });
posTransactionSchema.index({ user: 1, createdAt: -1 });

posTransactionSchema.statics.generateTransactionNumber = function generateTransactionNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `POS-${dateStr}-${random}`;
};

module.exports = mongoose.model('PosTransaction', posTransactionSchema);
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.STATUSES = STATUSES;
