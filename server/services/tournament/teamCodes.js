const mongoose = require('mongoose');
const Group = require('../../models/Group');
const Team = require('../../models/Team');

function groupNameToLetter(groupName, fallbackIndex = 0) {
  const s = String(groupName || '').trim();
  const m = s.match(/^([A-Za-z])\s*組?$/i) || s.match(/^([A-Za-z])/);
  if (m) return m[1].toUpperCase();
  if (fallbackIndex >= 0 && fallbackIndex < 26) {
    return String.fromCharCode('A'.charCodeAt(0) + fallbackIndex);
  }
  return 'G';
}

function nextCodeForLetter(existingCodes, letter) {
  let maxN = 0;
  const re = new RegExp(`^${letter}(\\d+)$`, 'i');
  for (const c of existingCodes) {
    const m = String(c || '').trim().match(re);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `${letter}${maxN + 1}`;
}

function nextUngroupedCode(existingCodes) {
  let maxN = 0;
  for (const c of existingCodes) {
    const m = String(c || '').trim().match(/^T(\d+)$/i);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  return `T${maxN + 1}`;
}

async function assignTeamCodeIfEmpty(teamDoc) {
  if (!teamDoc || teamDoc.isPlaceholder) return teamDoc;
  if (String(teamDoc.code || '').trim()) return teamDoc;

  const tid = new mongoose.Types.ObjectId(teamDoc.tournamentId);
  const gid = teamDoc.groupId ? new mongoose.Types.ObjectId(teamDoc.groupId) : null;

  if (gid) {
    const group = await Group.findOne({ _id: gid, tournamentId: tid }).lean();
    if (group) {
      const groups = await Group.find({ tournamentId: tid }).sort({ order: 1, createdAt: 1 }).lean();
      const gi = groups.findIndex((g) => String(g._id) === String(group._id));
      const letter = groupNameToLetter(group.name, gi >= 0 ? gi : 0);
      const siblings = await Team.find({
        tournamentId: tid,
        groupId: gid,
        isPlaceholder: { $ne: true },
        _id: { $ne: teamDoc._id },
      })
        .select('code')
        .lean();
      teamDoc.code = nextCodeForLetter(
        siblings.map((t) => t.code),
        letter
      );
      await teamDoc.save();
      return teamDoc;
    }
  }

  const ungrouped = await Team.find({
    tournamentId: tid,
    $or: [{ groupId: null }, { groupId: { $exists: false } }],
    isPlaceholder: { $ne: true },
    _id: { $ne: teamDoc._id },
  })
    .select('code')
    .lean();
  teamDoc.code = nextUngroupedCode(ungrouped.map((t) => t.code));
  await teamDoc.save();
  return teamDoc;
}

module.exports = {
  groupNameToLetter,
  assignTeamCodeIfEmpty,
};
