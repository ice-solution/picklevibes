const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  gameHall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameHall',
    required: true,
    index: true
  },
  socketCode: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['created', 'bound', 'started', 'finished', 'expired'],
    default: 'created',
    index: true
  },
  boundUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, { timestamps: true });

// TTL：到期自動刪除
gameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('GameSession', gameSessionSchema);

