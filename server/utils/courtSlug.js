/** 場地類型 → URL slug 前綴 */
const TYPE_SLUG_PREFIX = {
  competition: 'match-court',
  training: 'training-court',
  solo: 'solo-court',
  dink: 'dink-court',
  full_venue: 'full-venue',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeCourtSlug(raw) {
  if (raw == null || raw === '') return '';
  return String(raw).trim().toLowerCase().replace(/\s+/g, '-');
}

function isValidCourtSlug(slug) {
  return SLUG_PATTERN.test(slug);
}

/**
 * 同店同類型多個場地時加編號，單一則用簡短 slug（如 match-court）
 */
function buildCourtSlug(type, number, sameTypeCount) {
  const prefix = TYPE_SLUG_PREFIX[type] || 'court';
  if (sameTypeCount <= 1) return prefix;
  return `${prefix}-${number}`;
}

async function suggestCourtSlug(Court, storeId, type, number, excludeCourtId) {
  const query = { store: storeId, type };
  if (excludeCourtId) query._id = { $ne: excludeCourtId };
  const count = await Court.countDocuments(query);
  return buildCourtSlug(type, number, count + 1);
}

async function assertCourtSlugUnique(Court, storeId, slug, excludeCourtId) {
  if (!slug) return null;
  const query = { store: storeId, slug };
  if (excludeCourtId) query._id = { $ne: excludeCourtId };
  const existing = await Court.findOne(query).select('_id name');
  if (existing) {
    const err = new Error(`此店鋪已有 slug「${slug}」（${existing.name}）`);
    err.code = 'DUPLICATE_SLUG';
    throw err;
  }
  return slug;
}

/** 同店同類型場地數量 → 計算有效 slug（含舊資料缺 slug） */
function typeCountsForCourts(courts) {
  const counts = new Map();
  for (const court of courts) {
    const key = String(court.type || '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function effectiveCourtSlug(court, typeCounts) {
  const existing = court.slug && String(court.slug).trim();
  if (existing) return existing.toLowerCase();
  const count = typeCounts.get(String(court.type || '')) || 1;
  return buildCourtSlug(court.type, court.number, count);
}

/** 在記憶體中的場地列表依 slug 解析（DB slug 或推算 slug） */
function findCourtInListBySlug(courts, courtSlug) {
  const normalized = normalizeCourtSlug(courtSlug);
  if (!normalized) return null;
  const typeCounts = typeCountsForCourts(courts);
  return (
    courts.find((c) => effectiveCourtSlug(c, typeCounts) === normalized) || null
  );
}

module.exports = {
  TYPE_SLUG_PREFIX,
  SLUG_PATTERN,
  normalizeCourtSlug,
  isValidCourtSlug,
  buildCourtSlug,
  suggestCourtSlug,
  assertCourtSlugUnique,
  typeCountsForCourts,
  effectiveCourtSlug,
  findCourtInListBySlug,
};
