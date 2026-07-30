const Match = require('../../models/Match');

function inferMatchWinnerId(match) {
  if (!match) return null;

  const teamA = match.teamA?._id ? String(match.teamA._id) : String(match.teamA || '');
  const teamB = match.teamB?._id ? String(match.teamB._id) : String(match.teamB || '');
  if (!teamA || !teamB) return null;

  if (match.winnerId) {
    const w = String(match.winnerId);
    if (w === teamA || w === teamB) return w;
  }

  const games = Array.isArray(match.completedGames) ? match.completedGames : [];
  let gamesWonA = 0;
  let gamesWonB = 0;
  let ptsA = 0;
  let ptsB = 0;
  for (const g of games) {
    const a = Number(g?.a ?? 0);
    const b = Number(g?.b ?? 0);
    ptsA += a;
    ptsB += b;
    if (a > b) gamesWonA += 1;
    else if (b > a) gamesWonB += 1;
  }

  if (gamesWonA > gamesWonB) return teamA;
  if (gamesWonB > gamesWonA) return teamB;
  if (ptsA > ptsB) return teamA;
  if (ptsB > ptsA) return teamB;

  const ca = Number(match.currentPoints?.a ?? 0);
  const cb = Number(match.currentPoints?.b ?? 0);
  if (ca > cb) return teamA;
  if (cb > ca) return teamB;

  return null;
}

function matchPointsTotals(match) {
  let ptsA = 0;
  let ptsB = 0;
  for (const g of match.completedGames || []) {
    ptsA += Number(g?.a ?? 0);
    ptsB += Number(g?.b ?? 0);
  }
  if (match.status === 'live') {
    ptsA += Number(match.currentPoints?.a ?? 0);
    ptsB += Number(match.currentPoints?.b ?? 0);
  }
  return { ptsA, ptsB };
}

function ensureCompletedGamesFromCurrent(match) {
  const ca = Number(match.currentPoints?.a ?? 0);
  const cb = Number(match.currentPoints?.b ?? 0);
  if (ca === 0 && cb === 0) return;

  const completed = Array.isArray(match.completedGames) ? [...match.completedGames] : [];
  if (completed.length === 0) {
    match.completedGames = [{ a: ca, b: cb }];
    match.currentGameIndex = 1;
    return;
  }

  const last = completed[completed.length - 1];
  if (last && last.a === ca && last.b === cb) return;

  match.completedGames = completed;
  match.completedGames.push({ a: ca, b: cb });
  match.currentGameIndex = match.completedGames.length;
}

function finalizeFinishedMatch(match) {
  if (!match) return { ok: false };

  match.status = 'finished';
  ensureCompletedGamesFromCurrent(match);

  const winner = inferMatchWinnerId({
    teamA: match.teamA,
    teamB: match.teamB,
    completedGames: match.completedGames,
    currentPoints: match.currentPoints,
    status: 'finished',
  });

  if (winner) {
    match.winnerId = winner;
    match.currentPoints = { a: 0, b: 0 };
    if (typeof match.markModified === 'function') {
      match.markModified('completedGames');
      match.markModified('currentPoints');
      match.markModified('winnerId');
    }
    return { ok: true, winnerId: winner };
  }

  match.winnerId = null;
  return { ok: true, winnerId: null, tied: true };
}

function applyManualScoresFromBody(match, body) {
  if (!match || !body) return;

  const parseNonNeg = (v) => {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  let as = body.completedGameA;
  let bs = body.completedGameB;
  if (as === undefined && bs === undefined) {
    if (Array.isArray(body.completedGames)) {
      match.completedGames = body.completedGames.map((g) => ({
        a: parseNonNeg(g?.a),
        b: parseNonNeg(g?.b),
      }));
      match.currentPoints = {
        a: parseNonNeg(body.currentPoints?.a ?? body.currentPointA),
        b: parseNonNeg(body.currentPoints?.b ?? body.currentPointB),
      };
      match.currentGameIndex = match.completedGames.length;
      if (typeof match.markModified === 'function') {
        match.markModified('completedGames');
        match.markModified('currentPoints');
      }
      return;
    }
    return;
  }

  if (!Array.isArray(as)) as = as != null && String(as).trim() !== '' ? [as] : [];
  if (!Array.isArray(bs)) bs = bs != null && String(bs).trim() !== '' ? [bs] : [];

  const games = [];
  const len = Math.max(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    const aRaw = as[i];
    const bRaw = bs[i];
    const hasInput =
      String(aRaw ?? '').trim() !== '' ||
      String(bRaw ?? '').trim() !== '' ||
      parseNonNeg(aRaw) > 0 ||
      parseNonNeg(bRaw) > 0;
    if (hasInput) {
      games.push({ a: parseNonNeg(aRaw), b: parseNonNeg(bRaw) });
    }
  }

  const curA = parseNonNeg(body.currentPointA);
  const curB = parseNonNeg(body.currentPointB);
  const hasCurrent = curA > 0 || curB > 0;
  if (!games.length && !hasCurrent) return;

  match.completedGames = games;
  match.currentPoints = { a: curA, b: curB };
  match.currentGameIndex = games.length;

  if (typeof match.markModified === 'function') {
    match.markModified('completedGames');
    match.markModified('currentPoints');
  }
}

module.exports = {
  inferMatchWinnerId,
  matchPointsTotals,
  finalizeFinishedMatch,
  applyManualScoresFromBody,
  ensureCompletedGamesFromCurrent,
};
