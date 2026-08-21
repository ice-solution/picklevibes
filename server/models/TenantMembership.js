const mongoose = require('mongoose');

const tenantMembershipSchema = new mongoose.Schema({
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
  /** manager 店長；staff 店員；shareholder 股東（唯讀） */
  role: {
    type: String,
    enum: ['manager', 'staff', 'shareholder'],
    default: 'staff',
  },
  /**
   * 可存取模組覆寫；空陣列／未設 = 跟角色預設
   * 例：paymentLinks, pos, accounting…
   */
  modules: {
    type: [String],
    default: undefined,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

tenantMembershipSchema.index({ user: 1, store: 1 }, { unique: true });
tenantMembershipSchema.index({ store: 1, isActive: 1 });

module.exports = mongoose.model('TenantMembership', tenantMembershipSchema);
