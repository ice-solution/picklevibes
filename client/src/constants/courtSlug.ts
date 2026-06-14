/** 場地 slug 前綴（與 server/utils/courtSlug.js 對應） */
export const COURT_TYPE_SLUG_PREFIX: Record<string, string> = {
  competition: 'match-court',
  training: 'training-court',
  solo: 'solo-court',
  dink: 'dink-court',
  full_venue: 'full-venue',
};

export function suggestCourtSlug(type: string, number?: number | string): string {
  const prefix = COURT_TYPE_SLUG_PREFIX[type] || 'court';
  const num = number != null && number !== '' ? Number(number) : NaN;
  if (!Number.isFinite(num) || num <= 1) return prefix;
  return `${prefix}-${num}`;
}

export function normalizeCourtSlugInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function isValidCourtSlugInput(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
