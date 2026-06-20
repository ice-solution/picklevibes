const mongoose = require('mongoose');

const gameHallSchema = new mongoose.Schema({
  /** 所屬加盟店鋪（PickCourt 聯盟場地） */
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    default: null,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500
  },
  /** 一期（season）識別，排行榜以一期累積；需要重置時換 seasonKey */
  seasonKey: {
    type: String,
    default: 'season-1',
    trim: true,
    maxlength: 64
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

gameHallSchema.index({ store: 1, isActive: 1 });

module.exports = mongoose.model('GameHall', gameHallSchema);

