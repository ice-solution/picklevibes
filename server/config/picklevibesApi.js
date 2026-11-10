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
 * PICKLEVIBES_API_INTERNAL_URL — （建議 UAT／同機）本機回環，例如 http://127.0.0.1:5009/api
 *   有值時優先用，避免 PickCourt→Cloudflare→同機 PickleVibes hairpin
 *   導致 POST /bot/booking 卡住、前端即刻 502。
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

function isHostedPickleVibesUrl(url) {
  return /picklevibes\.hk/i.test(String(url || '')) || /uat\.picklevibes/i.test(String(url || ''));
}

function buildLoopbackBaseUrl() {
  const autoPort = String(process.env.PICKLEVIBES_INTERNAL_PORT || '5009').trim() || '5009';
  return normalizeBaseUrl(`http://127.0.0.1:${autoPort}/api`);
}

function shouldForceUatLoopback() {
  if (isTruthyEnv(process.env.PICKLEVIBES_DISABLE_INTERNAL_AUTO)) return false;
  const nodeEnv = String(process.env.NODE_ENV || '').toLowerCase();
  const publicBase = normalizeBaseUrl(process.env.PICKLEVIBES_API_BASE_URL);
  return (
    nodeEnv === 'uat' ||
    nodeEnv === 'pickcourtuat' ||
    String(process.env.PORT || '') === '5111' ||
    isHostedPickleVibesUrl(publicBase)
  );
}

function resolvePickleVibesBaseUrl() {
  const publicBase = normalizeBaseUrl(process.env.PICKLEVIBES_API_BASE_URL);
  const internal = normalizeBaseUrl(process.env.PICKLEVIBES_API_INTERNAL_URL);
  const forceLoopback = shouldForceUatLoopback();

  // INTERNAL 若誤設成公網 https://*.picklevibes.hk，一樣會 Cloudflare hairpin → 502
  if (internal && !isHostedPickleVibesUrl(internal)) {
    return {
      baseUrl: internal,
      usingInternalUrl: true,
      source: 'PICKLEVIBES_API_INTERNAL_URL',
    };
  }

  if (internal && isHostedPickleVibesUrl(internal) && forceLoopback) {
    return {
      baseUrl: buildLoopbackBaseUrl(),
      usingInternalUrl: true,
      source: 'auto-uat-loopback-override-bad-internal',
    };
  }

  if (forceLoopback) {
    return {
      baseUrl: buildLoopbackBaseUrl(),
      usingInternalUrl: true,
      source: 'auto-uat-loopback',
    };
  }

  return {
    baseUrl: publicBase,
    usingInternalUrl: false,
    source: 'PICKLEVIBES_API_BASE_URL',
  };
}

function getPickleVibesApiConfig() {
  const resolved = resolvePickleVibesBaseUrl();
  const publicBaseUrl = normalizeBaseUrl(process.env.PICKLEVIBES_API_BASE_URL);
  const botApiKey = String(process.env.PICKLEVIBES_BOT_API_KEY || '').trim();
  const fallbackLocal = isTruthyEnv(process.env.PICKLEVIBES_AVAILABILITY_FALLBACK_LOCAL);

  return {
    baseUrl: resolved.baseUrl,
    publicBaseUrl,
    usingInternalUrl: resolved.usingInternalUrl,
    baseUrlSource: resolved.source,
    botApiKey,
    fallbackLocal,
    remoteEnabled: Boolean(resolved.baseUrl),
    botEnabled: Boolean(resolved.baseUrl && botApiKey),
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

function logPickleVibesApiTarget() {
  const config = getPickleVibesApiConfig();
  console.log('🔗 PickleVibes API target', {
    baseUrl: config.baseUrl || '(disabled)',
    source: config.baseUrlSource,
    usingInternalUrl: config.usingInternalUrl,
    publicBaseUrl: config.publicBaseUrl || null,
    botEnabled: config.botEnabled,
  });
}

module.exports = {
  getPickleVibesApiConfig,
  isPickleVibesRemoteEnabled,
  normalizeBaseUrl,
  resolvePickleVibesBaseUrl,
  logPickleVibesApiTarget,
};
