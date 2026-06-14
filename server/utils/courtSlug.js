/** 場地類型 → URL slug 前綴 */
const TYPE_SLUG_PREFIX = {
  competition: 'match-court',
  training: 'training-court',
  solo: 'solo-court',
  dink: 'dink-court',
  full_venue: 'full-venue',
};

/**
 * 同店同類型多個場地時加編號，單一則用簡短 slug（如 match-court）
 */
function buildCourtSlug(type, number, sameTypeCount) {
  const prefix = TYPE_SLUG_PREFIX[type] || 'court';
  if (sameTypeCount <= 1) return prefix;
  return `${prefix}-${number}`;
}

module.exports = { TYPE_SLUG_PREFIX, buildCourtSlug };
