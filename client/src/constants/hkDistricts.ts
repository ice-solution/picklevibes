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

export const COURT_TYPE_OPTIONS = [
  { value: '', label: '全部場地' },
  { value: 'competition', label: '比賽場' },
  { value: 'training', label: '訓練場' },
  { value: 'solo', label: '單人／特色場' },
] as const;
