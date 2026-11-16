/** 香港 18 區 */
export const HK_DISTRICTS = [
  '中西區',
  '灣仔區',
  '東區',
  '南區',
  '油尖旺區',
  '深水埗區',
  '九龍城區',
  '黃大仙區',
  '觀塘區',
  '荃灣區',
  '屯門區',
  '元朗區',
  '北區',
  '大埔區',
  '西貢區',
  '沙田區',
  '葵青區',
  '離島區',
] as const;

export type HkDistrict = (typeof HK_DISTRICTS)[number];

/** 搜尋用三大區（底層仍存 18 區） */
export const HK_REGIONS = {
  香港: ['中西區', '灣仔區', '東區', '南區'],
  九龍: ['油尖旺區', '深水埗區', '九龍城區', '黃大仙區', '觀塘區'],
  新界: [
    '荃灣區',
    '屯門區',
    '元朗區',
    '北區',
    '大埔區',
    '西貢區',
    '沙田區',
    '葵青區',
    '離島區',
  ],
} as const;

export type HkRegion = keyof typeof HK_REGIONS;

export const HK_REGION_OPTIONS: Array<{ value: '' | HkRegion; label: string }> = [
  { value: '', label: '全港' },
  { value: '香港', label: '香港' },
  { value: '九龍', label: '九龍' },
  { value: '新界', label: '新界' },
];

export function regionOfDistrict(district?: string | null): HkRegion | null {
  const d = String(district || '').trim();
  if (!d) return null;
  for (const [region, list] of Object.entries(HK_REGIONS) as Array<[HkRegion, readonly string[]]>) {
    if (list.includes(d)) return region;
  }
  return null;
}

/**
 * 場地類型（UI 三類）
 * DB：competition=標準場、training=非標準場、solo+dink=單人場／發球機場
 */
export const COURT_TYPE_OPTIONS = [
  { value: '', label: '全部場地' },
  { value: 'competition', label: '標準場' },
  { value: 'training', label: '非標準場' },
  { value: 'solo', label: '單人場／發球機場' },
] as const;

/** 揀類型後顯示嘅固定簡介 */
export const COURT_TYPE_DESCRIPTIONS: Record<string, string> = {
  competition: '標準場：場地尺寸為標準，長度 13.41米、闊度 6.1米',
  training: '非標準場：與標準尺寸不一樣，易玩樂為主',
  solo: '單人場／發球機場：適合每次一至兩個單對單熱身、練習',
};

export const COURT_TYPE_BADGE_LABEL: Record<string, string> = {
  competition: '標準場',
  training: '非標準場',
  solo: '單人場',
  dink: '發球機場',
};
