/**
 * 為現有 Store 補上 SaaS / 聯盟預設欄位（可重跑）
 * 執行：npm run migrate-store-tenant
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== Store Tenant 欄位遷移 ===\n');
  console.log(`資料庫：${mongoose.connection.name}\n`);

  const stores = await Store.find();
  let updated = 0;

  for (const store of stores) {
    let changed = false;

    if (store.allianceEnabled === undefined) {
      store.allianceEnabled = false;
      changed = true;
    }
    if (!store.subscriptionPlan) {
      store.subscriptionPlan = 'starter';
      changed = true;
    }
    if (!store.branding) {
      store.branding = {
        displayName: store.name || '',
        tagline: '',
        logoUrl: '',
        primaryColor: '',
      };
      changed = true;
    } else if (!store.branding.displayName && store.name) {
      store.branding.displayName = store.name;
      changed = true;
    }

    if (changed) {
      await store.save();
      updated += 1;
      console.log(`  ✓ ${store.name} (${store.slug})`);
    } else {
      console.log(`  - ${store.name}（已是最新）`);
    }
  }

  console.log(`\n完成：${updated}/${stores.length} 間店鋪已更新`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
