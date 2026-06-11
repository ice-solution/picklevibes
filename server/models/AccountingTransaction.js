const mongoose = require('mongoose');

const TYPES = ['income', 'expense'];

const accountingTransactionSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: TYPES,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
  imagePath: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

accountingTransactionSchema.index({ date: -1, type: 1 });
/** 會計：按店鋪 + 日期區間 aggregate */
accountingTransactionSchema.index({ store: 1, date: -1, type: 1 });

module.exports = mongoose.model('AccountingTransaction', accountingTransactionSchema);
module.exports.TYPES = TYPES;
