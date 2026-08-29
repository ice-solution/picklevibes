const mongoose = require('mongoose');

const paymentLinkPaymentSchema = new mongoose.Schema(
  {
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentLink',
      required: true,
      index: true,
    },
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, '金額不能為負'],
    },
    method: {
      type: String,
      enum: ['points', 'wonder', 'stripe'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    payerNote: { type: String, default: '', trim: true },
    contactEmail: { type: String, default: '', trim: true },
    contactPhone: { type: String, default: '', trim: true },
    payment: {
      transactionId: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    /** Gateway「充值再付款」關聯嘅充值記錄（發票／客人充值列表） */
    recharge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recharge',
      default: null,
    },
    /** 已完成「充值後即扣積分價」 */
    pointsDebited: {
      type: Boolean,
      default: false,
    },
    /** 舊版曾寫收支登記；新流程不再使用 */
    accountingTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountingTransaction',
      default: null,
    },
    refundAccountingTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountingTransaction',
      default: null,
    },
    refundedAt: { type: Date, default: null },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    refundReason: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

paymentLinkPaymentSchema.index({ link: 1, createdAt: -1 });
paymentLinkPaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentLinkPayment', paymentLinkPaymentSchema);
