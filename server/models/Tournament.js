const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true },
    /** group: 小組賽, knockout: 淘汰賽 */
    phase: { type: String, enum: ['group', 'knockout'], required: true },
    sourceGroupTournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      default: null,
    },
    advancePerGroup: { type: Number, min: 1, default: 2 },
    groupWinPoints: { type: Number, default: 1 },
    groupLossPoints: { type: Number, default: -1 },
    order: { type: Number, default: 0 },
    /** YYYY-MM-DD */
    competitionDate: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

tournamentSchema.index({ eventId: 1, phase: 1 });
tournamentSchema.index({ eventId: 1, order: 1 });

module.exports = mongoose.model('Tournament', tournamentSchema);
