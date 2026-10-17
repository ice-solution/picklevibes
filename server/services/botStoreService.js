const Store = require('../models/Store');

/** 常見別名 → 用來 fuzzy match store name / slug / address */
const STORE_ALIAS_HINTS = [
  {
    aliases: ['荔枝角', 'lck', 'lai chi kok', 'laichikok', '總店', 'hq', '總部'],
    keywords: ['荔枝角', 'lai chi kok', 'laichikok', 'lck'],
  },
  {
    aliases: [
      '尖沙咀',
      '尖沙嘴',
      'tst',
      'isquare',
      'i-square',
      'i square',
      'isquare尖沙咀',
      '尖沙咀isquare',
      'tsimsha tsui',
      'tsim sha tsui',
      'tsimshatsui',
    ],
    keywords: ['isquare', 'i-square', '尖沙咀', '尖沙嘴', 'tst', 'tsim sha tsui', 'tsimshatsui'],
  },
];

function normalizeAlias(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-／/]+/g, '');
}

function storeHaystack(store) {
  return `${store.name || ''} ${store.slug || ''} ${store.address || ''} ${store.description || ''}`.toLowerCase();
}

function buildAliasList(store) {
  const name = String(store.name || '');
  const slug = String(store.slug || '');
  const address = String(store.address || '');
  const list = new Set([
    name,
    slug,
    address,
    normalizeAlias(name),
    normalizeAlias(slug),
    normalizeAlias(address),
  ]);

  const hay = storeHaystack(store);
  for (const hint of STORE_ALIAS_HINTS) {
    if (hint.keywords.some((k) => hay.includes(k.toLowerCase()))) {
      hint.aliases.forEach((a) => {
        list.add(a);
        list.add(normalizeAlias(a));
      });
    }
  }

  return [...list].filter(Boolean);
}

/**
 * Bot／LLM 用店鋪列表（含別名＋地址，方便自然語言對應）
 */
async function listStoresForBot() {
  const stores = await Store.find({ isActive: true })
    .sort({ isDefault: -1, sortOrder: 1, name: 1 })
    .select('name slug address phone description operatingHours sortOrder isDefault')
    .lean();

  return {
    stores: stores.map((s) => ({
      id: String(s._id),
      name: s.name,
      slug: s.slug,
      address: s.address,
      phone: s.phone || '',
      isDefault: Boolean(s.isDefault),
      operatingHours: s.operatingHours || null,
      aliases: buildAliasList(s),
    })),
  };
}

function scoreStoreMatch(store, norm) {
  if (!norm) return 0;
  const nameN = normalizeAlias(store.name);
  const slugN = normalizeAlias(store.slug);
  const addrN = normalizeAlias(store.address);
  const aliases = (store.aliases || []).map(normalizeAlias);

  if (nameN === norm || slugN === norm || aliases.includes(norm)) return 100;
  if (addrN === norm) return 95;
  if (aliases.some((a) => a.includes(norm) || norm.includes(a))) return 80;
  if (nameN.includes(norm) || norm.includes(nameN)) return 70;
  if (slugN.includes(norm) || norm.includes(slugN)) return 65;
  if (addrN.includes(norm) || norm.includes(addrN)) return 60;
  return 0;
}

/**
 * 用店名／slug／地址／別名解析 storeId
 */
async function resolveStoreId(query) {
  const q = String(query || '').trim();
  if (!q) {
    const err = new Error('請提供 store 查詢（名稱、slug、地址或別名）');
    err.code = 'STORE_QUERY_REQUIRED';
    throw err;
  }

  if (/^[a-f0-9]{24}$/i.test(q)) {
    const byId = await Store.findOne({ _id: q, isActive: true })
      .select('_id name slug address')
      .lean();
    if (!byId) {
      const err = new Error('找不到此店鋪');
      err.code = 'STORE_NOT_FOUND';
      throw err;
    }
    return {
      id: String(byId._id),
      name: byId.name,
      slug: byId.slug,
      address: byId.address || '',
    };
  }

  const { stores } = await listStoresForBot();
  const norm = normalizeAlias(q);

  let best = null;
  let bestScore = 0;
  for (const s of stores) {
    const score = scoreStoreMatch(s, norm);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  if (best && bestScore >= 60) {
    return {
      id: best.id,
      name: best.name,
      slug: best.slug,
      address: best.address || '',
    };
  }

  const err = new Error(
    `找不到店鋪：「${q}」。可用 get_stores 睇列表（支援店名、地址、尖沙咀／iSQUARE／荔枝角等別名）。`
  );
  err.code = 'STORE_NOT_FOUND';
  throw err;
}

module.exports = {
  listStoresForBot,
  resolveStoreId,
  STORE_ALIAS_HINTS,
};
