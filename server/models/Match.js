const mongoose = require('mongoose');

const MATCH_FORMAT = {
  BEST_OF_5: 'bestOf5',
  BEST_OF_3: 'bestOf3',
  SINGLE_GAME: 'singleGame',
};

const matchSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    round: { type: String, trim: true, default: '' },
    matchFormat: {
      type: String,
      enum: Object.values(MATCH_FORMAT),
      required: true,
    },
    teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    court: { type: String, trim: true, default: '' },
    /** HH:mm（24h） */
    scheduledTime: { type: String, trim: true, default: '' },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'finished', 'postponed', 'cancelled'],
      default: 'scheduled',
    },
    completedGames: [{ a: { type: Number, min: 0 }, b: { type: Number, min: 0 } }],
    currentGameIndex: { type: Number, min: 0, default: 0 },
    currentPoints: {
      a: { type: Number, min: 0, default: 0 },
      b: { type: Number, min: 0, default: 0 },
    },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    knockoutWinnerSlot: { type: String, trim: true, default: null },
    knockoutLoserSlot: { type: String, trim: true, default: null },
  },
  { timestamps: true }
);

matchSchema.index({ tournamentId: 1, scheduledTime: 1 });
matchSchema.index({ groupId: 1 });

module.exports = mongoose.model('Match', matchSchema);
module.exports.MATCH_FORMAT = MATCH_FORMAT;
