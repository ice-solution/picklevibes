const mongoose = require('mongoose');

const gameMatchSchema = new mongoose.Schema({
  gameHall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameHall',
    required: true,
    index: true
  },
  seasonKey: {
    type: String,
    required: true,
    index: true
  },
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameSession',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  scores: {
    type: Number,
    required: true
  },
  history: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

gameMatchSchema.index({ gameHall: 1, seasonKey: 1, createdAt: -1 });

module.exports = mongoose.model('GameMatch', gameMatchSchema);

