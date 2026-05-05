const mongoose = require('mongoose');

const gameLeaderboardEntrySchema = new mongoose.Schema({
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
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  matches: {
    type: Number,
    default: 0
  },
  lastMatchAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

gameLeaderboardEntrySchema.index({ gameHall: 1, seasonKey: 1, user: 1 }, { unique: true });
gameLeaderboardEntrySchema.index({ gameHall: 1, seasonKey: 1, totalScore: -1 });

module.exports = mongoose.model('GameLeaderboardEntry', gameLeaderboardEntrySchema);

