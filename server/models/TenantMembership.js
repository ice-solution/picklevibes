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
  /** manager：店鋪經理（本店全部）；staff：店員（場地＋預約） */
  role: {
    type: String,
    enum: ['manager', 'staff'],
    default: 'staff',
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
