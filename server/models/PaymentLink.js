const mongoose = require('mongoose');
const crypto = require('crypto');

function generatePaymentLinkCode() {
  return crypto.randomBytes(5).toString('hex'); // 10 hex chars
}

const paymentLinkSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    amount: {
      type: Number,
      required: true,
      min: [1, '金額必須大於 0'],
    },
    /** 積分價（用積分付款時扣除的分數；未設則沿用 amount） */
    pointsAmount: {
      type: Number,
      default: null,
      min: [1, '積分價必須大於 0'],
    },
    /** 公開 URL 短碼 */
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    /** null = 不過期 */
    expiresAt: { type: Date, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    stats: {
      paidCount: { type: Number, default: 0 },
      paidAmountTotal: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

paymentLinkSchema.index({ store: 1, createdAt: -1 });

paymentLinkSchema.methods.isPayable = function isPayable(now = new Date()) {
  if (!this.isActive) return { ok: false, reason: 'closed' };
  if (this.expiresAt && new Date(this.expiresAt) <= now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true };
};

paymentLinkSchema.statics.generateUniqueCode = async function generateUniqueCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = generatePaymentLinkCode();
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ code });
    if (!exists) return code;
  }
  return `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`;
};

module.exports = mongoose.model('PaymentLink', paymentLinkSchema);
module.exports.generatePaymentLinkCode = generatePaymentLinkCode;
