const Store = require('../models/Store');
const { isSaasTenantStore } = require('./allianceStore');

/**
 * 正規化域名（不含 protocol、port、path）
 */
function normalizeDomain(input) {
  if (input == null || input === '') return null;
  let s = String(input).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0].split(':')[0];
  return s || null;
}

/**
 * 從請求推斷 hostname（優先 X-Forwarded-Host）
 */
function getRequestHost(req) {
  const raw =
    req.headers['x-forwarded-host'] ||
    req.headers.host ||
    req.query.host ||
    '';
  const first = String(raw).split(',')[0].trim();
  return normalizeDomain(first);
}

/**
 * 依 slug / id / domain 查詢 tenant（Store）
 */
async function findTenantBySlug(slug, { saasOnly = false } = {}) {
  if (!slug) return null;
  const store = await Store.findOne({ slug: String(slug).trim().toLowerCase(), isActive: true }).lean();
  if (!store) return null;
  if (saasOnly && !isSaasTenantStore(store)) return null;
  return store;
}

async function findTenantById(id, { saasOnly = false } = {}) {
  if (!id) return null;
  const store = await Store.findOne({ _id: id, isActive: true }).lean();
  if (!store) return null;
  if (saasOnly && !isSaasTenantStore(store)) return null;
  return store;
}

async function findTenantByDomain(host) {
  const domain = normalizeDomain(host);
  if (!domain) return null;
  return Store.findOne({
    isActive: true,
    allianceEnabled: true,
    $or: [{ adminDomain: domain }, { consumerDomain: domain }],
  }).lean();
}

/**
 * 綜合解析 tenant（不拋錯，找不到回傳 null）
 */
async function resolveTenantFromRequest(req, options = {}) {
  const { saasOnly = false } = options;

  if (req.openApiAuth?.store?._id) {
    const store = await Store.findById(req.openApiAuth.store._id).lean();
    if (store && (!saasOnly || isSaasTenantStore(store))) {
      return { store, source: 'openApiKey' };
    }
  }

  const paramSlug =
    req.params.storeSlug ||
    req.params.tenantSlug ||
    req.params.slug;
  if (paramSlug) {
    const store = await findTenantBySlug(paramSlug, { saasOnly });
    if (store) return { store, source: 'paramSlug' };
  }

  const headerSlug = req.headers['x-tenant-slug'] || req.headers['x-store-slug'];
  if (headerSlug) {
    const store = await findTenantBySlug(headerSlug, { saasOnly });
    if (store) return { store, source: 'headerSlug' };
  }

  const querySlug = req.query.storeSlug || req.query.tenantSlug;
  if (querySlug) {
    const store = await findTenantBySlug(querySlug, { saasOnly });
    if (store) return { store, source: 'querySlug' };
  }

  const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
  if (tenantId) {
    const store = await findTenantById(tenantId, { saasOnly });
    if (store) return { store, source: 'tenantId' };
  }

  const host = getRequestHost(req);
  if (host) {
    const store = await findTenantByDomain(host);
    if (store) return { store, source: 'domain' };
  }

  return null;
}

function attachTenantToRequest(req, resolved) {
  if (!resolved?.store) return;
  req.tenant = resolved.store;
  req.tenantId = resolved.store._id;
  req.tenantSource = resolved.source;
}

module.exports = {
  normalizeDomain,
  getRequestHost,
  findTenantBySlug,
  findTenantById,
  findTenantByDomain,
  resolveTenantFromRequest,
  attachTenantToRequest,
};
