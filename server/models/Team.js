const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    seed: { type: Number, min: 0 },
    sourceTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    isPlaceholder: { type: Boolean, default: false },
    checkedIn: { type: Boolean, default: false },
  },
  { timestamps: true }
);

teamSchema.index({ tournamentId: 1, groupId: 1 });
teamSchema.index({ tournamentId: 1, code: 1 });
teamSchema.index({ tournamentId: 1, sourceTeamId: 1 });

module.exports = mongoose.model('Team', teamSchema);
