const Store = require('../models/Store');
const {
  getPickleVibesApiConfig,
  isPickleVibesRemoteEnabled,
} = require('../config/picklevibesApi');
const {
  PickleVibesApiError,
  picklevibesRequest,
  fetchCourtsForStore,
  fetchCourtAvailability,
} = require('./picklevibesAvailabilityClient');

function shouldProxyChainStore(store) {
  return Boolean(store?.isChainStore) && isPickleVibesRemoteEnabled();
}

function serializeLocalStoreForCourt(store) {
  if (!store) return null;
  return {
    _id: store._id,
    name: store.name,
    slug: store.slug,
    address: store.address,
    enableHikAccess: store.enableHikAccess,
    isActive: store.isActive !== false,
    isChainStore: Boolean(store.isChainStore),
  };
}

/**
 * 遠端 court 掛上「本地」store，方便前端 booking 流程沿用 local store id／slug
 */
function attachLocalStoreToRemoteCourt(remoteCourt, localStore) {
  if (!remoteCourt) return null;
  return {
    ...remoteCourt,
    store: serializeLocalStoreForCourt(localStore),
    source: 'picklevibes',
  };
}

async function findLocalStoreByRef(storeRef) {
  const raw = String(storeRef || '').trim();
  if (!raw) return null;
  const mongoose = require('mongoose');
  if (mongoose.Types.ObjectId.isValid(raw) && String(new mongoose.Types.ObjectId(raw)) === raw) {
    const byId = await Store.findById(raw).select(
      'name slug address enableHikAccess isActive isChainStore'
    );
    if (byId) return byId;
  }
  return Store.findOne({ slug: raw.toLowerCase() }).select(
    'name slug address enableHikAccess isActive isChainStore'
  );
}

async function listRemoteCourtsForLocalStore(localStore, { type } = {}) {
  const storeRef = String(localStore.slug || localStore._id || '').trim();
  let courts = await fetchCourtsForStore(storeRef);
  if (type) {
    courts = courts.filter((c) => c.type === type);
  }
  return courts.map((c) => attachLocalStoreToRemoteCourt(c, localStore));
}

async function fetchRemoteCourtById(courtId) {
  const payload = await picklevibesRequest(`/courts/${courtId}`);
  return payload?.court || payload;
}

async function picklevibesPost(path, body) {
  const config = getPickleVibesApiConfig();
  if (!config.baseUrl) {
    throw new PickleVibesApiError('PICKLEVIBES_API_BASE_URL 未設定');
  }
  const url = new URL(`${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
      throw new PickleVibesApiError(
        payload?.message || payload?.error || `PickleVibes API ${response.status}`,
        { status: response.status, path: url.pathname }
      );
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new PickleVibesApiError(`PickleVibes API 逾時 (${config.requestTimeoutMs}ms)`, {
        path,
      });
    }
    if (error instanceof PickleVibesApiError) throw error;
    throw new PickleVibesApiError(error.message || 'PickleVibes API 請求失敗');
  } finally {
    clearTimeout(timer);
  }
}

async function proxyRemoteAvailabilityBatch(courtId, { date, timeSlots }) {
  return picklevibesPost(`/courts/${courtId}/availability/batch`, { date, timeSlots });
}

/**
 * 本地找不到 court 時：若有任何連鎖店啟用 remote，就當遠端 court id 試（availability／詳情）
 */
async function tryResolveRemoteCourtForProxy(courtId) {
  if (!isPickleVibesRemoteEnabled()) return null;
  try {
    return await fetchRemoteCourtById(courtId);
  } catch (error) {
    if (error instanceof PickleVibesApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * 為遠端 court 建立／更新本機 stub（isActive=false），方便「我的預約」populate 顯示。
 * 唔會出現喺一般可預約場地列表。
 */
async function ensureLocalCourtStubFromRemote(remoteCourt, localStore) {
  const Court = require('../models/Court');
  const courtId = remoteCourt?._id || remoteCourt?.id;
  if (!courtId || !localStore?._id) return null;

  const existing = await Court.findById(courtId);
  if (existing) return existing;

  const pricing = remoteCourt.pricing || {};
  const stub = new Court({
    _id: courtId,
    store: localStore._id,
    name: remoteCourt.name || 'Chain Court',
    number: Number(remoteCourt.number) || 1,
    slug: remoteCourt.slug || undefined,
    type: remoteCourt.type || 'training',
    description: remoteCourt.description || 'PickleVibes 連鎖場地（PickCourt 同步）',
    capacity: Number(remoteCourt.capacity) || 4,
    amenities: Array.isArray(remoteCourt.amenities) ? remoteCourt.amenities : [],
    pricing: {
      timeSlots: Array.isArray(pricing.timeSlots) ? pricing.timeSlots : [],
      peakHour: pricing.peakHour,
      offPeak: pricing.offPeak,
      memberDiscount: pricing.memberDiscount || 0,
    },
    operatingHours: remoteCourt.operatingHours || undefined,
    isActive: false,
  });

  try {
    await stub.save();
    return stub;
  } catch (error) {
    // 並發建立時可能撞 unique；再讀一次
    const again = await Court.findById(courtId);
    if (again) return again;
    throw error;
  }
}

module.exports = {
  shouldProxyChainStore,
  findLocalStoreByRef,
  listRemoteCourtsForLocalStore,
  attachLocalStoreToRemoteCourt,
  fetchRemoteCourtById,
  fetchCourtAvailability,
  proxyRemoteAvailabilityBatch,
  tryResolveRemoteCourtForProxy,
  ensureLocalCourtStubFromRemote,
  PickleVibesApiError,
  isPickleVibesRemoteEnabled,
};
