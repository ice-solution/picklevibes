/** Tuya Open API 資料中心（與 tyua-sample.js / 開發者平台一致） */
const TUYA_BASE_URL_OPTIONS = [
  { value: 'https://openapi.tuyacn.com', label: '中國 (tuyacn)' },
  { value: 'https://openapi.tuyaus.com', label: '美西 (tuyaus)' },
  { value: 'https://openapi-ueaz.tuyaus.com', label: '美東 (ueaz)' },
  { value: 'https://openapi.tuyaeu.com', label: '歐洲 (tuyaeu)' },
  { value: 'https://openapi-weaz.tuyaeu.com', label: '西歐 (weaz)' },
  { value: 'https://openapi.tuyain.com', label: '印度 (tuyain)' },
  { value: 'https://openapi-sg.iotbing.com', label: '新加坡 (sg) — 香港／東南亞' },
];

const DEFAULT_TUYA_BASE_URL = process.env.TUYA_BASE_URL || 'https://openapi.tuyacn.com';

module.exports = { TUYA_BASE_URL_OPTIONS, DEFAULT_TUYA_BASE_URL };
