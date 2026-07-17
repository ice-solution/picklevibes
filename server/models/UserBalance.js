const mongoose = require('mongoose');

const storeWalletTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['recharge', 'spend', 'refund'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: String,
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
  },
  relatedRecharge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recharge',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const storeWalletSchema = new mongoose.Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, '餘額不能為負數'],
  },
  totalRecharged: {
    type: Number,
    default: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
  },
  transactions: {
    type: [storeWalletTransactionSchema],
    default: [],
  },
}, { _id: false });

const userBalanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, '餘額不能為負數']
  },
  totalRecharged: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  /** 各店獨立餘額（寫入同 collection，避免 Atlas 建新 collection） */
  storeWallets: {
    type: [storeWalletSchema],
    default: [],
  },
  transactions: [{
    type: {
      type: String,
      enum: ['recharge', 'spend', 'refund'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    description: String,
    relatedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

userBalanceSchema.methods.addBalance = function(amount, description = '充值') {
  this.balance += amount;
  this.totalRecharged += amount;
  this.transactions.push({
    type: 'recharge',
    amount: amount,
    description: description
  });
  return this.save();
};

userBalanceSchema.methods.deductBalance = function(amount, description = '消費', relatedBooking = null, relatedOrder = null) {
  if (this.balance < amount) {
    throw new Error('餘額不足');
  }
  this.balance -= amount;
  this.totalSpent += amount;
  const entry = {
    type: 'spend',
    amount: -amount,
    description: description
  };
  if (relatedBooking) entry.relatedBooking = relatedBooking;
  if (relatedOrder) entry.relatedOrder = relatedOrder;
  this.transactions.push(entry);
  return this.save();
};

userBalanceSchema.methods.refund = function(amount, description = '退款', relatedBooking = null, relatedOrder = null) {
  this.balance += amount;
  if (this.totalSpent > 0) {
    this.totalSpent = Math.max(0, this.totalSpent - amount);
  }
  const entry = {
    type: 'refund',
    amount: amount,
    description: description
  };
  if (relatedBooking) entry.relatedBooking = relatedBooking;
  if (relatedOrder) entry.relatedOrder = relatedOrder;
  this.transactions.push(entry);
  return this.save();
};

module.exports = mongoose.model('UserBalance', userBalanceSchema);
