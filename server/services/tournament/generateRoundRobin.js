const mongoose = require('mongoose');
const Group = require('../../models/Group');
const Team = require('../../models/Team');
const Match = require('../../models/Match');
const { MATCH_FORMAT } = Match;
const Tournament = require('../../models/Tournament');

/**
 * 為小組賽各組產生循環對戰場次（僅新增尚不存在的對戰）。
 */
async function generateGroupRoundRobinMatches(tournamentId, options = {}) {
  if (!mongoose.isValidObjectId(tournamentId)) {
    return { ok: false, error: 'invalid_id' };
  }

  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return { ok: false, error: 'not_found' };
  if (tournament.phase !== 'group') return { ok: false, error: 'not_group_phase' };

  const matchFormat = options.matchFormat || MATCH_FORMAT.BEST_OF_3;
  const clearExisting = !!options.clearExisting;

  const tid = new mongoose.Types.ObjectId(tournamentId);
  if (clearExisting) {
    await Match.deleteMany({ tournamentId: tid });
  }

  const groups = await Group.find({ tournamentId: tid }).sort({ order: 1, createdAt: 1 }).lean();
  const teams = await Team.find({
    tournamentId: tid,
    isPlaceholder: { $ne: true },
  })
    .select('_id groupId name code')
    .lean();
  const existing = await Match.find({ tournamentId: tid })
    .select('teamA teamB groupId')
    .lean();

  const pairKey = (a, b, gid) => {
    const [x, y] = [String(a), String(b)].sort();
    return `${gid || ''}:${x}:${y}`;
  };
  const existingPairs = new Set(
    existing.map((m) => pairKey(m.teamA, m.teamB, m.groupId))
  );

  const created = [];
  for (const group of groups) {
    const gid = String(group._id);
    const groupTeams = teams.filter((t) => t.groupId && String(t.groupId) === gid);
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        const a = groupTeams[i];
        const b = groupTeams[j];
        const key = pairKey(a._id, b._id, gid);
        if (existingPairs.has(key)) continue;
        const doc = await Match.create({
          tournamentId: tid,
          groupId: group._id,
          round: `${group.name}循環賽`,
          matchFormat,
          teamA: a._id,
          teamB: b._id,
          court: '',
          scheduledTime: '',
          status: 'scheduled',
          completedGames: [],
          currentGameIndex: 0,
          currentPoints: { a: 0, b: 0 },
        });
        existingPairs.add(key);
        created.push(doc._id);
      }
    }
  }

  return { ok: true, created: created.length };
}

module.exports = { generateGroupRoundRobinMatches };
