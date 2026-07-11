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
  const existing = await Court.findOne(query).select('_id name slug');
  if (existing) {
    const err = new Error(`此店鋪已有 slug「${slug}」（${existing.name}）`);
    err.code = 'DUPLICATE_SLUG';
    throw err;
  }
  return slug;
}

async function assertCourtNumberUnique(Court, storeId, number, excludeCourtId) {
  const query = { store: storeId, number };
  if (excludeCourtId) query._id = { $ne: excludeCourtId };
  const existing = await Court.findOne(query).select('_id name number');
  if (existing) {
    const err = new Error(`此店鋪已有編號 ${number}（${existing.name}）`);
    err.code = 'DUPLICATE_NUMBER';
    throw err;
  }
}

function formatCourtDuplicateKeyError(error) {
  if (error?.code !== 11000) return null;
  const pattern = error.keyPattern || {};
  if (pattern.number) return '此店鋪內場地編號已存在';
  if (pattern.slug) return '此店鋪內 slug 已存在';
  return '此店鋪內場地編號或 slug 已存在';
}

module.exports = {
  TYPE_SLUG_PREFIX,
  SLUG_PATTERN,
  normalizeCourtSlug,
  isValidCourtSlug,
  buildCourtSlug,
  suggestCourtSlug,
  assertCourtSlugUnique,
  assertCourtNumberUnique,
  formatCourtDuplicateKeyError,
};
