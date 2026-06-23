/**
 * 自訂域名（SaaS tenant）驗證工具
 *
 * 用法：
 *   node server/scripts/verifyTenantDomains.js
 *   node server/scripts/verifyTenantDomains.js --slug lai-chi-kok
 *   node server/scripts/verifyTenantDomains.js --http --base https://uat.pickcourt.hk
 *   node server/scripts/verifyTenantDomains.js --set lai-chi-kok --consumer lck.uat.pickcourt.hk --admin admin.lck.uat.pickcourt.hk
 *
 * 建議 deploy 前／後各跑一次。
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const {
  normalizeDomain,
  findTenantByDomain,
  getRequestHost,
} = require('../utils/tenantResolver');
const { isSaasTenantStore } = require('../utils/allianceStore');

function parseArgs(argv) {
  const args = {
    slug: null,
    http: false,
    base: (process.env.PUBLIC_WEB_URL || process.env.CLIENT_URL || 'http://localhost:5001').replace(/\/$/, ''),
    set: null,
    consumer: null,
    admin: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--slug' && argv[i + 1]) {
      args.slug = argv[++i];
    } else if (a === '--http') {
      args.http = true;
    } else if (a === '--base' && argv[i + 1]) {
      args.base = argv[++i].replace(/\/$/, '');
    } else if (a === '--set' && argv[i + 1]) {
      args.set = argv[++i];
    } else if (a === '--consumer' && argv[i + 1]) {
      args.consumer = argv[++i];
    } else if (a === '--admin' && argv[i + 1]) {
      args.admin = argv[++i];
    } else if (a === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

async function httpResolve(base, host) {
  const apiBase = base.includes('/api') ? base : `${base}/api`;
  const url = `${apiBase}/platform/tenant/resolve?host=${encodeURIComponent(host)}`;
  const res = await fetch(url, { headers: { Host: host } });
  const json = await res.json();
  return { status: res.status, json };
}

function printStoreRow(store) {
  const ok = isSaasTenantStore(store);
  console.log(`\n── ${store.name} (${store.slug}) ──`);
  console.log(`  allianceEnabled: ${store.allianceEnabled ? '✓' : '✗ 需開啟才能用 SaaS 域名'}`);
  console.log(`  district:        ${store.district || '(未設)'}`);
  console.log(`  consumerDomain:  ${store.consumerDomain || '(未設)'}`);
  console.log(`  adminDomain:     ${store.adminDomain || '(未設)'}`);
  console.log(`  SaaS 就緒:       ${ok ? '✓' : '✗'}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ 請設定 MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ 已連接資料庫');

  if (args.set) {
    const slug = args.set.trim().toLowerCase();
    const store = await Store.findOne({ slug });
    if (!store) {
      console.error(`❌ 找不到店鋪 slug=${slug}`);
      process.exit(1);
    }
    const patch = {};
    if (args.consumer !== null) {
      patch.consumerDomain = args.consumer ? normalizeDomain(args.consumer) : null;
    }
    if (args.admin !== null) {
      patch.adminDomain = args.admin ? normalizeDomain(args.admin) : null;
    }
    if (!Object.keys(patch).length) {
      console.error('❌ --set 需配合 --consumer 和／或 --admin');
      process.exit(1);
    }
    console.log(`\n📝 更新 ${store.name}:`);
    console.log(JSON.stringify(patch, null, 2));
    if (args.dryRun) {
      console.log('(dry-run，未寫入)');
    } else {
      Object.assign(store, patch);
      await store.save();
      console.log('✅ 已儲存');
    }
  }

  const filter = args.slug ? { slug: args.slug.trim().toLowerCase() } : {};
  const stores = await Store.find(filter).sort({ sortOrder: 1, name: 1 }).lean();

  if (!stores.length) {
    console.log('找不到店鋪');
    process.exit(0);
  }

  console.log('\n========== 店鋪域名設定 ==========');
  for (const s of stores) printStoreRow(s);

  const domainMap = new Map();
  for (const s of stores) {
    for (const field of ['consumerDomain', 'adminDomain']) {
      const d = s[field];
      if (!d) continue;
      const key = normalizeDomain(d);
      if (domainMap.has(key)) {
        console.log(`\n⚠️  域名重複: ${key}`);
        console.log(`    → ${domainMap.get(key)} 與 ${s.slug}.${field}`);
      } else {
        domainMap.set(key, `${s.slug}.${field}`);
      }
    }
  }

  const domainsToTest = [];
  for (const s of stores) {
    if (s.consumerDomain) domainsToTest.push({ host: s.consumerDomain, expectSlug: s.slug, role: 'consumer' });
    if (s.adminDomain) domainsToTest.push({ host: s.adminDomain, expectSlug: s.slug, role: 'admin' });
  }

  if (domainsToTest.length) {
    console.log('\n========== DB 域名解析 ==========');
    for (const t of domainsToTest) {
      const host = normalizeDomain(t.host);
      const found = await findTenantByDomain(host);
      const ok = found && found.slug === t.expectSlug;
      console.log(`${ok ? '✓' : '✗'} ${t.role.padEnd(8)} ${host} → ${found ? found.slug : '(無)'}`);
      if (!ok && found) console.log(`    預期 ${t.expectSlug}`);
      if (!found) {
        console.log('    提示: allianceEnabled 須為 true');
      }
    }
  } else {
    console.log('\nℹ️  尚未設定 consumerDomain / adminDomain');
    console.log('   範例（testing server）:');
    console.log('   node server/scripts/verifyTenantDomains.js \\');
    console.log('     --set lai-chi-kok \\');
    console.log('     --consumer lck.uat.pickcourt.hk \\');
    console.log('     --admin admin.lck.uat.pickcourt.hk');
  }

  if (args.http && domainsToTest.length) {
    console.log(`\n========== HTTP 解析 (${args.base}) ==========`);
    for (const t of domainsToTest) {
      const host = normalizeDomain(t.host);
      try {
        const { status, json } = await httpResolve(args.base, host);
        const ok =
          status === 200 &&
          json.resolved &&
          json.tenant?.slug === t.expectSlug;
        console.log(`${ok ? '✓' : '✗'} ${host} → HTTP ${status} resolved=${json.resolved} slug=${json.tenant?.slug || '-'}`);
        if (!ok && json.resolved === false) {
          console.log('    API 未解析 tenant；確認 Nginx 有轉發 Host，且 DB 域名正確');
        }
      } catch (err) {
        console.log(`✗ ${host} → ${err.message}`);
      }
    }
  } else if (domainsToTest.length) {
    console.log('\n💡 Deploy 後可加 --http --base https://你的-testing-域名 做線上驗證');
  }

  console.log('\n========== 瀏覽器測試預期 ==========');
  console.log('consumer 域名 /     → /store/{slug}');
  console.log('consumer 域名 /admin → /store/{slug}/admin');
  console.log('admin 域名 /        → /store/{slug}/admin');
  console.log('curl 範例:');
  console.log('  curl -s "https://YOUR_HOST/api/platform/tenant/resolve?host=admin.lck.uat.pickcourt.hk" | jq');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
