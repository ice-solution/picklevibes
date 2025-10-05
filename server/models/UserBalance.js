const mongoose = require('mongoose');

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
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// 添加餘額
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

// 扣除餘額
userBalanceSchema.methods.deductBalance = function(amount, description = '消費', relatedBooking = null) {
  if (this.balance < amount) {
    throw new Error('餘額不足');
  }
  this.balance -= amount;
  this.totalSpent += amount;
  this.transactions.push({
    type: 'spend',
    amount: -amount,
    description: description,
    relatedBooking: relatedBooking
  });
  return this.save();
};

// 退款
userBalanceSchema.methods.refund = function(amount, description = '退款', relatedBooking = null) {
  this.balance += amount;
  this.transactions.push({
    type: 'refund',
    amount: amount,
    description: description,
    relatedBooking: relatedBooking
  });
  return this.save();
};

module.exports = mongoose.model('UserBalance', userBalanceSchema);
