/**
 * PickCourt 平台功能開關
 * OPEN_API_ENABLED=true 時才開放 /api/open（預設關閉，日後再開發）
 */
const openApiEnabled =
  String(process.env.OPEN_API_ENABLED || process.env.PLATFORM_OPEN_API_ENABLED || '')
    .toLowerCase() === 'true';

/** 僅加盟（allianceEnabled）店鋪可使用 SaaS 多租戶功能 */
const allianceRequiredForSaas = true;

module.exports = {
  openApiEnabled,
  allianceRequiredForSaas,
};
