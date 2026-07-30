const mongoose = require('mongoose');

const slugHistorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/** 店鋪賽事大會（移植自計分系統 Event，加上 store） */
const eventSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    slugAliases: { type: [String], default: [] },
    slugHistory: { type: [slugHistorySchema], default: [] },
    dateStart: { type: Date },
    dateEnd: { type: Date },
    venues: [{ type: String, trim: true }],
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

eventSchema.index({ store: 1, slug: 1 }, { unique: true });
eventSchema.index({ store: 1, isActive: 1 });

module.exports = mongoose.model('Event', eventSchema);
