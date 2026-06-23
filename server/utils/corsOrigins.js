/**
 * CORS origin 白名單（含 PickCourt 多租戶域名）
 */
function parseExtraOrigins() {
  return (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** 允許 pickcourt.hk 及子域名（含 testing server） */
function isPickCourtHost(hostname) {
  if (!hostname) return false;
  return hostname === 'pickcourt.hk' || hostname.endsWith('.pickcourt.hk');
}

function buildAllowedOrigins(baseList = []) {
  const set = new Set([...baseList, ...parseExtraOrigins()]);
  return Array.from(set);
}

function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  const host = hostnameFromOrigin(origin);
  if (isPickCourtHost(host)) return true;

  // 本機 /etc/hosts 測試：lck.local、admin.lck.local
  if (process.env.NODE_ENV !== 'production' && host && (host.endsWith('.local') || host === 'local')) {
    return true;
  }

  return false;
}

module.exports = {
  parseExtraOrigins,
  isPickCourtHost,
  buildAllowedOrigins,
  isOriginAllowed,
};
