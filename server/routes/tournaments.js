const express = require('express');
const mongoose = require('mongoose');
const { auth, adminAuth } = require('../middleware/auth');
const { canAccessStore } = require('../utils/tenantAccess');
const Event = require('../models/Event');
const Tournament = require('../models/Tournament');
const Group = require('../models/Group');
const Team = require('../models/Team');
const Match = require('../models/Match');
const { MATCH_FORMAT } = Match;
const { assignTeamCodeIfEmpty } = require('../services/tournament/teamCodes');
const { computeGroupStandings } = require('../services/tournament/groupStandings');
const { buildGroupRoundRobinMatrices } = require('../services/tournament/groupRoundRobinMatrix');
const { generateKnockoutFromGroup } = require('../services/tournament/knockoutGenerator');
const { advanceKnockoutFromFinishedMatch } = require('../services/tournament/knockoutAdvance');
const { finalizeFinishedMatch, applyManualScoresFromBody } = require('../services/tournament/matchResult');
const { generateGroupRoundRobinMatches } = require('../services/tournament/generateRoundRobin');

const router = express.Router();

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `event-${Date.now()}`;
}

function denyStore(res) {
  return res.status(403).json({ message: '無權限存取此店鋪' });
}

async function loadEventForAccess(eventId, tenantAccess) {
  if (!mongoose.isValidObjectId(eventId)) return { error: 400, message: '無效的賽事 ID' };
  const event = await Event.findById(eventId);
  if (!event) return { error: 404, message: '賽事不存在' };
  if (!canAccessStore(tenantAccess, event.store)) return { error: 403, message: '無權限存取此店鋪' };
  return { event };
}

async function loadTournamentForAccess(tournamentId, tenantAccess) {
  if (!mongoose.isValidObjectId(tournamentId)) return { error: 400, message: '無效的賽制 ID' };
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { error: 404, message: '賽制不存在' };
  const event = await Event.findById(tournament.eventId);
  if (!event) return { error: 404, message: '賽事不存在' };
  if (!canAccessStore(tenantAccess, event.store)) return { error: 403, message: '無權限存取此店鋪' };
  return { tournament, event };
}

router.use(auth, adminAuth);

// ─── Events ───────────────────────────────────────────────

router.get('/events', async (req, res) => {
  try {
    const storeId = req.query.store;
    if (!storeId) return res.status(400).json({ message: '缺少 store' });
    if (!canAccessStore(req.tenantAccess, storeId)) return denyStore(res);

    const events = await Event.find({ store: storeId }).sort({ dateStart: -1, createdAt: -1 }).lean();
    res.json({ events });
  } catch (error) {
    console.error('list events:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const { store, name, slug, dateStart, dateEnd, venues, description, isActive } = req.body || {};
    if (!store) return res.status(400).json({ message: '缺少 store' });
    if (!canAccessStore(req.tenantAccess, store)) return denyStore(res);
    if (!name || !String(name).trim()) return res.status(400).json({ message: '請輸入賽事名稱' });

    let finalSlug = slugify(slug || name);
    const clash = await Event.findOne({ store, slug: finalSlug });
    if (clash) finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;

    const event = await Event.create({
      store,
      name: String(name).trim(),
      slug: finalSlug,
      dateStart: dateStart ? new Date(dateStart) : undefined,
      dateEnd: dateEnd ? new Date(dateEnd) : undefined,
      venues: Array.isArray(venues) ? venues.filter(Boolean) : venues ? [String(venues)] : [],
      description: description || '',
      isActive: isActive !== false,
    });
    res.status(201).json({ event });
  } catch (error) {
    console.error('create event:', error);
    if (error.code === 11000) return res.status(400).json({ message: 'slug 已存在' });
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/events/:eventId', async (req, res) => {
  try {
    const loaded = await loadEventForAccess(req.params.eventId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const tournaments = await Tournament.find({ eventId: loaded.event._id })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ event: loaded.event, tournaments });
  } catch (error) {
    console.error('get event:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/events/:eventId', async (req, res) => {
  try {
    const loaded = await loadEventForAccess(req.params.eventId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const { name, slug, dateStart, dateEnd, venues, description, isActive } = req.body || {};
    const event = loaded.event;
    if (name != null) event.name = String(name).trim();
    if (slug != null && String(slug).trim()) {
      const next = slugify(slug);
      if (next !== event.slug) {
        event.slugHistory.push({ slug: event.slug, changedAt: new Date() });
        event.slug = next;
      }
    }
    if (dateStart !== undefined) event.dateStart = dateStart ? new Date(dateStart) : undefined;
    if (dateEnd !== undefined) event.dateEnd = dateEnd ? new Date(dateEnd) : undefined;
    if (venues !== undefined) {
      event.venues = Array.isArray(venues) ? venues.filter(Boolean) : venues ? [String(venues)] : [];
    }
    if (description !== undefined) event.description = description || '';
    if (isActive !== undefined) event.isActive = !!isActive;
    await event.save();
    res.json({ event });
  } catch (error) {
    console.error('update event:', error);
    if (error.code === 11000) return res.status(400).json({ message: 'slug 已存在' });
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/events/:eventId', async (req, res) => {
  try {
    const loaded = await loadEventForAccess(req.params.eventId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const tournaments = await Tournament.find({ eventId: loaded.event._id }).select('_id').lean();
    const tids = tournaments.map((t) => t._id);
    if (tids.length) {
      await Match.deleteMany({ tournamentId: { $in: tids } });
      await Team.deleteMany({ tournamentId: { $in: tids } });
      await Group.deleteMany({ tournamentId: { $in: tids } });
      await Tournament.deleteMany({ _id: { $in: tids } });
    }
    await Event.deleteOne({ _id: loaded.event._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete event:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Tournaments ──────────────────────────────────────────

router.post('/events/:eventId/tournaments', async (req, res) => {
  try {
    const loaded = await loadEventForAccess(req.params.eventId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const { name, phase, advancePerGroup, competitionDate, groupWinPoints, groupLossPoints, order } =
      req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ message: '請輸入賽制名稱' });
    if (!['group', 'knockout'].includes(phase)) {
      return res.status(400).json({ message: 'phase 須為 group 或 knockout' });
    }

    const maxOrder = await Tournament.findOne({ eventId: loaded.event._id })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const tournament = await Tournament.create({
      eventId: loaded.event._id,
      name: String(name).trim(),
      phase,
      advancePerGroup: Math.max(1, parseInt(advancePerGroup, 10) || 2),
      competitionDate: competitionDate ? String(competitionDate).trim() : '',
      groupWinPoints: groupWinPoints != null ? Number(groupWinPoints) : 1,
      groupLossPoints: groupLossPoints != null ? Number(groupLossPoints) : -1,
      order: order != null ? Number(order) : (maxOrder?.order ?? -1) + 1,
    });
    res.status(201).json({ tournament });
  } catch (error) {
    console.error('create tournament:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.get('/tournaments/:tournamentId', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const tid = loaded.tournament._id;
    const [groups, teams, matches] = await Promise.all([
      Group.find({ tournamentId: tid }).sort({ order: 1, createdAt: 1 }).lean(),
      Team.find({ tournamentId: tid }).sort({ code: 1, createdAt: 1 }).lean(),
      Match.find({ tournamentId: tid })
        .populate('teamA teamB winnerId')
        .sort({ scheduledTime: 1, createdAt: 1 })
        .lean(),
    ]);

    let standings = [];
    let roundRobinMatrices = [];
    if (loaded.tournament.phase === 'group') {
      standings = await computeGroupStandings(tid);
      roundRobinMatrices = buildGroupRoundRobinMatrices({ groups, teams, matches });
    }

    const siblingTournaments = await Tournament.find({ eventId: loaded.event._id })
      .sort({ order: 1, createdAt: 1 })
      .select('_id name phase')
      .lean();

    res.json({
      event: loaded.event,
      tournament: loaded.tournament,
      groups,
      teams,
      matches,
      standings,
      roundRobinMatrices,
      siblingTournaments,
    });
  } catch (error) {
    console.error('get tournament:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/tournaments/:tournamentId', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const t = loaded.tournament;
    const {
      name,
      advancePerGroup,
      competitionDate,
      groupWinPoints,
      groupLossPoints,
      order,
      sourceGroupTournamentId,
    } = req.body || {};
    if (name != null) t.name = String(name).trim();
    if (advancePerGroup != null) t.advancePerGroup = Math.max(1, parseInt(advancePerGroup, 10) || 2);
    if (competitionDate !== undefined) t.competitionDate = String(competitionDate || '').trim();
    if (groupWinPoints != null) t.groupWinPoints = Number(groupWinPoints);
    if (groupLossPoints != null) t.groupLossPoints = Number(groupLossPoints);
    if (order != null) t.order = Number(order);
    if (sourceGroupTournamentId !== undefined) {
      t.sourceGroupTournamentId = sourceGroupTournamentId || null;
    }
    await t.save();
    res.json({ tournament: t });
  } catch (error) {
    console.error('update tournament:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/tournaments/:tournamentId', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const tid = loaded.tournament._id;
    await Match.deleteMany({ tournamentId: tid });
    await Team.deleteMany({ tournamentId: tid });
    await Group.deleteMany({ tournamentId: tid });
    await Tournament.deleteOne({ _id: tid });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete tournament:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/tournaments/:tournamentId/link-group', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });
    if (loaded.tournament.phase !== 'knockout') {
      return res.status(400).json({ message: '僅淘汰賽可綁定小組賽' });
    }

    const { sourceGroupTournamentId } = req.body || {};
    if (!mongoose.isValidObjectId(sourceGroupTournamentId)) {
      return res.status(400).json({ message: '無效的小組賽 ID' });
    }
    const src = await Tournament.findById(sourceGroupTournamentId).lean();
    if (!src || src.phase !== 'group' || String(src.eventId) !== String(loaded.event._id)) {
      return res.status(400).json({ message: '來源小組賽無效' });
    }

    loaded.tournament.sourceGroupTournamentId = src._id;
    await loaded.tournament.save();
    res.json({ tournament: loaded.tournament });
  } catch (error) {
    console.error('link-group:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/tournaments/:tournamentId/generate-knockout', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });
    if (loaded.tournament.phase !== 'knockout') {
      return res.status(400).json({ message: '僅淘汰賽可產生對陣' });
    }

    const sourceId =
      req.body?.sourceGroupTournamentId || loaded.tournament.sourceGroupTournamentId;
    if (!sourceId) return res.status(400).json({ message: '請先綁定小組賽' });

    const result = await generateKnockoutFromGroup({
      sourceTournamentId: sourceId,
      knockoutTournamentId: loaded.tournament._id,
      advancePerGroup: req.body?.advancePerGroup,
    });
    if (!result.ok) {
      const map = {
        invalid_id: '無效 ID',
        not_found: '找不到賽制',
        source_not_group: '來源不是小組賽',
        target_not_knockout: '目標不是淘汰賽',
        different_event: '必須同一賽事',
        no_groups: '小組賽尚無組別',
        not_enough_qualifiers: '出線隊伍不足',
      };
      return res.status(400).json({ message: map[result.error] || result.error || '產生失敗' });
    }
    res.json(result);
  } catch (error) {
    console.error('generate-knockout:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/tournaments/:tournamentId/reset-knockout', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });
    if (loaded.tournament.phase !== 'knockout') {
      return res.status(400).json({ message: '僅淘汰賽可重置' });
    }

    const tid = loaded.tournament._id;
    await Match.deleteMany({ tournamentId: tid });
    await Team.deleteMany({
      tournamentId: tid,
      $or: [{ isPlaceholder: true }, { sourceTeamId: { $ne: null } }],
    });
    res.json({ ok: true });
  } catch (error) {
    console.error('reset-knockout:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/tournaments/:tournamentId/clear-matches', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });
    await Match.deleteMany({ tournamentId: loaded.tournament._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('clear-matches:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.post('/tournaments/:tournamentId/generate-round-robin', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const result = await generateGroupRoundRobinMatches(loaded.tournament._id, {
      matchFormat: req.body?.matchFormat,
      clearExisting: !!req.body?.clearExisting,
    });
    if (!result.ok) {
      const map = {
        invalid_id: '無效 ID',
        not_found: '找不到賽制',
        not_group_phase: '僅小組賽可產生循環賽',
      };
      return res.status(400).json({ message: map[result.error] || '產生失敗' });
    }
    res.json(result);
  } catch (error) {
    console.error('generate-round-robin:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Groups ───────────────────────────────────────────────

router.post('/tournaments/:tournamentId/groups', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: '請輸入組別名稱' });

    const maxOrder = await Group.findOne({ tournamentId: loaded.tournament._id })
      .sort({ order: -1 })
      .select('order')
      .lean();
    const group = await Group.create({
      tournamentId: loaded.tournament._id,
      name,
      order: (maxOrder?.order ?? -1) + 1,
    });
    res.status(201).json({ group });
  } catch (error) {
    console.error('create group:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/groups/:groupId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: '組別不存在' });
    const loaded = await loadTournamentForAccess(group.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    if (req.body?.name != null) group.name = String(req.body.name).trim();
    if (req.body?.order != null) group.order = Number(req.body.order);
    await group.save();
    res.json({ group });
  } catch (error) {
    console.error('update group:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/groups/:groupId', async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);
    if (!group) return res.status(404).json({ message: '組別不存在' });
    const loaded = await loadTournamentForAccess(group.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    await Team.updateMany({ groupId: group._id }, { $unset: { groupId: 1 } });
    await Match.deleteMany({ groupId: group._id });
    await Group.deleteOne({ _id: group._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete group:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Teams ────────────────────────────────────────────────

router.post('/tournaments/:tournamentId/teams', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: '請輸入隊伍名稱' });

    let groupId = req.body?.groupId || null;
    if (groupId) {
      const g = await Group.findOne({ _id: groupId, tournamentId: loaded.tournament._id });
      if (!g) return res.status(400).json({ message: '組別不屬於此賽制' });
    }

    const team = await Team.create({
      tournamentId: loaded.tournament._id,
      groupId: groupId || undefined,
      name,
      code: req.body?.code ? String(req.body.code).trim() : '',
      seed: req.body?.seed != null ? Number(req.body.seed) : undefined,
    });
    await assignTeamCodeIfEmpty(team);
    res.status(201).json({ team });
  } catch (error) {
    console.error('create team:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/teams/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: '隊伍不存在' });
    const loaded = await loadTournamentForAccess(team.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    if (req.body?.name != null) team.name = String(req.body.name).trim();
    if (req.body?.code != null) team.code = String(req.body.code).trim();
    if (req.body?.seed != null) team.seed = Number(req.body.seed);
    if (req.body?.checkedIn != null) team.checkedIn = !!req.body.checkedIn;
    if (req.body?.groupId !== undefined) {
      if (!req.body.groupId) {
        team.groupId = undefined;
      } else {
        const g = await Group.findOne({ _id: req.body.groupId, tournamentId: team.tournamentId });
        if (!g) return res.status(400).json({ message: '組別不屬於此賽制' });
        team.groupId = g._id;
      }
    }
    await team.save();
    res.json({ team });
  } catch (error) {
    console.error('update team:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/teams/:teamId', async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) return res.status(404).json({ message: '隊伍不存在' });
    const loaded = await loadTournamentForAccess(team.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    await Match.deleteMany({
      tournamentId: team.tournamentId,
      $or: [{ teamA: team._id }, { teamB: team._id }],
    });
    await Team.deleteOne({ _id: team._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete team:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

// ─── Matches ──────────────────────────────────────────────

router.post('/tournaments/:tournamentId/matches', async (req, res) => {
  try {
    const loaded = await loadTournamentForAccess(req.params.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const { teamA, teamB, groupId, round, matchFormat, court, scheduledTime } = req.body || {};
    if (!teamA || !teamB) return res.status(400).json({ message: '請選擇對戰雙方' });
    if (String(teamA) === String(teamB)) return res.status(400).json({ message: '對戰雙方不能相同' });

    const [a, b] = await Promise.all([
      Team.findOne({ _id: teamA, tournamentId: loaded.tournament._id }),
      Team.findOne({ _id: teamB, tournamentId: loaded.tournament._id }),
    ]);
    if (!a || !b) return res.status(400).json({ message: '隊伍不屬於此賽制' });

    let gid = groupId || undefined;
    if (gid) {
      const g = await Group.findOne({ _id: gid, tournamentId: loaded.tournament._id });
      if (!g) return res.status(400).json({ message: '組別不屬於此賽制' });
    } else if (a.groupId && b.groupId && String(a.groupId) === String(b.groupId)) {
      gid = a.groupId;
    }

    const format = Object.values(MATCH_FORMAT).includes(matchFormat)
      ? matchFormat
      : MATCH_FORMAT.BEST_OF_3;

    const match = await Match.create({
      tournamentId: loaded.tournament._id,
      groupId: gid,
      round: round || '',
      matchFormat: format,
      teamA: a._id,
      teamB: b._id,
      court: court || '',
      scheduledTime: scheduledTime || '',
      status: 'scheduled',
      completedGames: [],
      currentGameIndex: 0,
      currentPoints: { a: 0, b: 0 },
    });
    const populated = await Match.findById(match._id).populate('teamA teamB').lean();
    res.status(201).json({ match: populated });
  } catch (error) {
    console.error('create match:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.put('/matches/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: '場次不存在' });
    const loaded = await loadTournamentForAccess(match.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });

    const body = req.body || {};
    if (body.round !== undefined) match.round = String(body.round || '');
    if (body.court !== undefined) match.court = String(body.court || '');
    if (body.scheduledTime !== undefined) match.scheduledTime = String(body.scheduledTime || '');
    if (body.matchFormat && Object.values(MATCH_FORMAT).includes(body.matchFormat)) {
      match.matchFormat = body.matchFormat;
    }
    if (body.groupId !== undefined) {
      match.groupId = body.groupId || undefined;
    }
    if (body.teamA) {
      const a = await Team.findOne({ _id: body.teamA, tournamentId: match.tournamentId });
      if (!a) return res.status(400).json({ message: '隊伍 A 無效' });
      match.teamA = a._id;
    }
    if (body.teamB) {
      const b = await Team.findOne({ _id: body.teamB, tournamentId: match.tournamentId });
      if (!b) return res.status(400).json({ message: '隊伍 B 無效' });
      match.teamB = b._id;
    }

    applyManualScoresFromBody(match, body);

    if (body.status) {
      const allowed = ['scheduled', 'live', 'finished', 'postponed', 'cancelled'];
      if (!allowed.includes(body.status)) {
        return res.status(400).json({ message: '無效狀態' });
      }
      if (body.status === 'finished') {
        finalizeFinishedMatch(match);
      } else {
        match.status = body.status;
      }
    }

    await match.save();

    if (match.status === 'finished') {
      await advanceKnockoutFromFinishedMatch(match._id);
    }

    const populated = await Match.findById(match._id).populate('teamA teamB winnerId').lean();
    res.json({ match: populated });
  } catch (error) {
    console.error('update match:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

router.delete('/matches/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: '場次不存在' });
    const loaded = await loadTournamentForAccess(match.tournamentId, req.tenantAccess);
    if (loaded.error) return res.status(loaded.error).json({ message: loaded.message });
    await Match.deleteOne({ _id: match._id });
    res.json({ ok: true });
  } catch (error) {
    console.error('delete match:', error);
    res.status(500).json({ message: '服務器錯誤' });
  }
});

module.exports = router;
