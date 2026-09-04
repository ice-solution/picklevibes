/**
 * PickCourt（uat）向 PickleVibes（main）查詢場地空缺的設定。
 *
 * 搜尋行為：
 * - 僅 Store.isChainStore === true 的連鎖店會打遠端 API
 * - 其餘聯盟店一律查本地 Mongo store／court
 *
 * PICKLEVIBES_API_BASE_URL — PickleVibes API 根路徑，例如 https://uat.picklevibes.hk/api
 *   留空時連連鎖店都改用本地查詢。
 *
 * PICKLEVIBES_BOT_API_KEY — 對應 main 的 BOT_API_KEY；有值時優先用
 *   GET /api/bot/availability（每店一次 request，較快），
 *   以及連鎖店訂場轉發 POST /api/bot/booking。
 *
 * PICKLEVIBES_AVAILABILITY_FALLBACK_LOCAL — 設為 1/true 時，連鎖店遠端失敗會 fallback 本地查詢。
 * 連鎖店確認預約會轉發至 PickleVibes，specialRequests 會加上「PickCourt 預約」備註。
 */
function normalizeBaseUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function isTruthyEnv(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function getPickleVibesApiConfig() {
  const baseUrl = normalizeBaseUrl(process.env.PICKLEVIBES_API_BASE_URL);
  const botApiKey = String(process.env.PICKLEVIBES_BOT_API_KEY || '').trim();
  const fallbackLocal = isTruthyEnv(process.env.PICKLEVIBES_AVAILABILITY_FALLBACK_LOCAL);

  return {
    baseUrl,
    botApiKey,
    fallbackLocal,
    remoteEnabled: Boolean(baseUrl),
    botEnabled: Boolean(baseUrl && botApiKey),
    requestTimeoutMs: Math.max(
      3000,
      parseInt(process.env.PICKLEVIBES_API_TIMEOUT_MS || '15000', 10) || 15000
    ),
    maxConcurrentStores: Math.max(
      1,
      parseInt(process.env.PICKLEVIBES_SEARCH_STORE_CONCURRENCY || '4', 10) || 4
    ),
    maxConcurrentCourts: Math.max(
      1,
      parseInt(process.env.PICKLEVIBES_SEARCH_COURT_CONCURRENCY || '8', 10) || 8
    ),
  };
}

function isPickleVibesRemoteEnabled() {
  return getPickleVibesApiConfig().remoteEnabled;
}

module.exports = {
  getPickleVibesApiConfig,
  isPickleVibesRemoteEnabled,
  normalizeBaseUrl,
};
