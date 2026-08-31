const { getPickleVibesApiConfig } = require('../config/picklevibesApi');

class PickleVibesApiError extends Error {
  constructor(message, { status, code, path } = {}) {
    super(message);
    this.name = 'PickleVibesApiError';
    this.status = status;
    this.code = code;
    this.path = path;
  }
}

function buildUrl(baseUrl, path, query = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function picklevibesRequest(path, { query, method = 'GET', headers = {}, useBotKey = false } = {}) {
  const config = getPickleVibesApiConfig();
  if (!config.baseUrl) {
    throw new PickleVibesApiError('PICKLEVIBES_API_BASE_URL 未設定');
  }

  const url = buildUrl(config.baseUrl, path, query);
  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (useBotKey) {
    if (!config.botApiKey) {
      throw new PickleVibesApiError('PICKLEVIBES_BOT_API_KEY 未設定');
    }
    requestHeaders['X-Bot-Key'] = config.botApiKey;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { message: text };
      }
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `PickleVibes API ${response.status} ${response.statusText}`;
      throw new PickleVibesApiError(message, {
        status: response.status,
        code: payload?.code,
        path: url.pathname,
      });
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new PickleVibesApiError(`PickleVibes API 逾時 (${config.requestTimeoutMs}ms)`, {
        path: url.pathname,
      });
    }
    if (error instanceof PickleVibesApiError) throw error;
    throw new PickleVibesApiError(error.message || 'PickleVibes API 請求失敗', {
      path: url.pathname,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/courts?store=
 */
async function fetchCourtsForStore(storeId) {
  const payload = await picklevibesRequest('/courts', {
    query: { store: String(storeId) },
  });
  const courts = Array.isArray(payload?.courts) ? payload.courts : [];
  return courts.filter((court) => court && court.isActive !== false && court.type !== 'full_venue');
}

/**
 * GET /api/courts/:id/availability
 */
async function fetchCourtAvailability(courtId, { date, startTime, endTime }) {
  return picklevibesRequest(`/courts/${courtId}/availability`, {
    query: { date, startTime, endTime },
  });
}

/**
 * GET /api/bot/availability — 單店一次查全部 court
 */
async function fetchStoreBotAvailability(storeId, { date, startTime, endTime, courtType }) {
  const query = {
    store: String(storeId),
    date,
    startTime,
    endTime,
  };
  if (courtType) query.courtType = courtType;

  const payload = await picklevibesRequest('/bot/availability', {
    query,
    useBotKey: true,
  });

  if (payload?.success === false) {
    throw new PickleVibesApiError(payload.message || 'Bot availability 失敗');
  }

  return payload?.data || payload;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * 對一間 alliance 店查空缺，回傳 courtId → availability row
 */
async function fetchStoreAvailabilityMap(store, { date, startTime, endTime, courtTypeFilter }) {
  const config = getPickleVibesApiConfig();
  const courts = await fetchCourtsForStore(store._id);
  const filteredCourts = filterCourtsByType(courts, courtTypeFilter);

  if (filteredCourts.length === 0) {
    return { courts: [], availabilityByCourtId: new Map() };
  }

  const availabilityByCourtId = new Map();

  if (config.botEnabled) {
    const botData = await fetchStoreBotAvailability(store._id, {
      date,
      startTime,
      endTime,
    });
    const rows = [
      ...(botData.availableCourts || []),
      ...(botData.unavailableCourts || []),
    ];
    for (const row of rows) {
      const courtId = String(row.courtId || row._id || '');
      if (!courtId) continue;
      availabilityByCourtId.set(courtId, normalizeAvailabilityRow(row));
    }
    return { courts: filteredCourts, availabilityByCourtId };
  }

  const rows = await mapWithConcurrency(filteredCourts, config.maxConcurrentCourts, async (court) => {
    const courtId = String(court._id || court.id);
    const payload = await fetchCourtAvailability(courtId, { date, startTime, endTime });
    return { courtId, payload };
  });

  for (const { courtId, payload } of rows) {
    availabilityByCourtId.set(courtId, normalizePublicAvailability(payload));
  }

  return { courts: filteredCourts, availabilityByCourtId };
}

function filterCourtsByType(courts, courtTypeFilter) {
  if (!courtTypeFilter || courtTypeFilter.length === 0) return courts;
  const allowed = new Set(courtTypeFilter);
  return courts.filter((court) => allowed.has(court.type));
}

function normalizeAvailabilityRow(row) {
  return {
    available: Boolean(row.available),
    reason: row.reason || null,
    pricing: row.pricing
      ? {
          basePrice: row.pricing.basePrice,
          totalPrice: row.pricing.totalPrice,
          slotName: row.pricing.slotName,
        }
      : null,
  };
}

function normalizePublicAvailability(payload) {
  if (!payload?.available) {
    return {
      available: false,
      reason: payload?.reason || '不可用',
      pricing: null,
    };
  }
  return {
    available: true,
    reason: null,
    pricing: payload.pricing
      ? {
          basePrice: payload.pricing.basePrice,
          totalPrice: payload.pricing.totalPrice,
          slotName: payload.pricing.slotName,
        }
      : null,
  };
}

module.exports = {
  PickleVibesApiError,
  fetchCourtsForStore,
  fetchCourtAvailability,
  fetchStoreBotAvailability,
  fetchStoreAvailabilityMap,
  mapWithConcurrency,
};
