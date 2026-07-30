const mongoose = require('mongoose');
const Group = require('../../models/Group');
const Team = require('../../models/Team');
const Match = require('../../models/Match');
const Tournament = require('../../models/Tournament');
const { inferMatchWinnerId, matchPointsTotals } = require('./matchResult');

function cmpNumDesc(a, b) {
  return (b ?? 0) - (a ?? 0);
}

async function computeGroupStandings(tournamentId) {
  const tid = new mongoose.Types.ObjectId(tournamentId);
  const tournament = await Tournament.findById(tid).select('groupWinPoints groupLossPoints').lean();
  const winPts = tournament?.groupWinPoints ?? 1;
  const lossPts = tournament?.groupLossPoints ?? -1;
  const groups = await Group.find({ tournamentId: tid }).sort({ order: 1, createdAt: 1 }).lean();
  const teams = await Team.find({ tournamentId: tid }).select('_id name groupId code checkedIn').lean();
  const teamById = new Map(teams.map((t) => [String(t._id), t]));

  const statsByTeamId = new Map();
  function statFor(teamId) {
    const key = String(teamId);
    if (!statsByTeamId.has(key)) {
      const t = teamById.get(key);
      statsByTeamId.set(key, {
        teamId: key,
        name: t?.name || '—',
        code: t?.code || '',
        checkedIn: !!t?.checkedIn,
        groupId: t?.groupId ? String(t.groupId) : '',
        played: 0,
        wins: 0,
        losses: 0,
        points: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      });
    }
    return statsByTeamId.get(key);
  }

  const matches = await Match.find({
    tournamentId: tid,
    status: 'finished',
  })
    .select('teamA teamB winnerId completedGames groupId status currentPoints')
    .lean();

  for (const m of matches) {
    const aId = String(m.teamA);
    const bId = String(m.teamB);
    const ta = teamById.get(aId);
    const tb = teamById.get(bId);
    const groupId = m.groupId
      ? String(m.groupId)
      : ta?.groupId && tb?.groupId && String(ta.groupId) === String(tb.groupId)
        ? String(ta.groupId)
        : '';
    if (!groupId) continue;

    const { ptsA, ptsB } = matchPointsTotals(m);
    const wId = inferMatchWinnerId(m) || '';

    const sa = statFor(aId);
    const sb = statFor(bId);
    sa.played += 1;
    sb.played += 1;

    if (wId === aId) {
      sa.wins += 1;
      sb.losses += 1;
    } else if (wId === bId) {
      sb.wins += 1;
      sa.losses += 1;
    }

    sa.pointsFor += ptsA;
    sa.pointsAgainst += ptsB;
    sb.pointsFor += ptsB;
    sb.pointsAgainst += ptsA;
  }

  for (const s of statsByTeamId.values()) {
    s.pointDiff = s.pointsFor - s.pointsAgainst;
    s.points = s.wins * winPts + s.losses * lossPts;
  }

  return groups.map((g) => {
    const rows = teams
      .filter((t) => String(t.groupId) === String(g._id))
      .map((t) => statFor(t._id));
    rows.sort((x, y) => {
      if (x.points !== y.points) return cmpNumDesc(x.points, y.points);
      if (x.pointDiff !== y.pointDiff) return cmpNumDesc(x.pointDiff, y.pointDiff);
      if (x.pointsFor !== y.pointsFor) return cmpNumDesc(x.pointsFor, y.pointsFor);
      return String(x.name).localeCompare(String(y.name), 'zh-Hant');
    });
    return { group: g, rows };
  });
}

module.exports = { computeGroupStandings };
