const mongoose = require('mongoose');

const platformMembershipSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  /** PickCourt 聯盟會籍等級 */
  tier: {
    type: String,
    enum: ['basic', 'vip'],
    default: 'basic',
  },
  expiry: {
    type: Date,
    default: null,
  },
  source: {
    type: String,
    enum: ['pickcourt', 'picklecourt', 'legacy_picklevibes', 'admin'],
    default: 'pickcourt',
  },
}, {
  timestamps: true,
});

platformMembershipSchema.index({ tier: 1, expiry: 1 });

module.exports = mongoose.model('PlatformMembership', platformMembershipSchema);
