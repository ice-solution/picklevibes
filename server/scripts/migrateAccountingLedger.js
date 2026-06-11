/**
 * 從獨立專案 admin_picklevibes_upload_data 遷移收支紀錄
 *
 * 用法（需能同時連到兩個 DB）：
 *   SOURCE_MONGODB_URI=mongodb://127.0.0.1:27017/picklevibes_admin \
 *   MONGODB_URI=mongodb://127.0.0.1:27017/picklevibes \
 *   node server/scripts/migrateAccountingLedger.js
 *
 * 選項：
 *   --dry-run   只預覽不寫入
 */
require('dotenv').config();
const mongoose = require('mongoose');

const dryRun = process.argv.includes('--dry-run');
const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017/picklevibes_admin';
const targetUri = process.env.MONGODB_URI;

if (!targetUri) {
  console.error('請設定 MONGODB_URI（目標 picklevibes DB）');
  process.exit(1);
}

async function main() {
  const sourceConn = await mongoose.createConnection(sourceUri).asPromise();
  const targetConn = await mongoose.createConnection(targetUri).asPromise();

  const SourceTx = sourceConn.collection('transactions');
  const TargetTx = targetConn.collection('accountingtransactions');
  const TargetStore = targetConn.collection('stores');
  const TargetUser = targetConn.collection('users');

  const sourceRows = await SourceTx.find({}).toArray();
  console.log(`來源 transactions: ${sourceRows.length} 筆`);

  const storeNameMap = new Map();
  const sourceStores = await sourceConn.collection('stores').find({}).toArray();
  for (const s of sourceStores) {
    storeNameMap.set(String(s._id), s.name);
  }

  const targetStores = await TargetStore.find({}).toArray();
  const targetStoreByName = new Map(targetStores.map((s) => [s.name, s._id]));

  let migrated = 0;
  let skipped = 0;

  for (const row of sourceRows) {
    const storeName = storeNameMap.get(String(row.store));
    const targetStoreId = storeName ? targetStoreByName.get(storeName) : null;
    if (!targetStoreId) {
      console.warn(`略過（找不到店鋪）: ${row.category} ${row.amount} · 來源店 ${storeName || row.store}`);
      skipped += 1;
      continue;
    }

    const adminUser = await TargetUser.findOne({ role: 'admin' }).sort({ createdAt: 1 });
    if (!adminUser) {
      throw new Error('目標 DB 無 admin 用戶，無法設定 createdBy');
    }

    const doc = {
      store: targetStoreId,
      type: row.type,
      amount: row.amount,
      date: row.date,
      category: row.category,
      note: row.note || '',
      imagePath: row.imagePath || '',
      createdBy: adminUser._id,
      createdAt: row.createdAt || new Date(),
      updatedAt: row.updatedAt || new Date(),
    };

    if (!dryRun) {
      await TargetTx.insertOne(doc);
    }
    migrated += 1;
  }

  console.log(dryRun ? `[dry-run] 將遷移 ${migrated} 筆，略過 ${skipped} 筆` : `已遷移 ${migrated} 筆，略過 ${skipped} 筆`);

  await sourceConn.close();
  await targetConn.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
