/**
 * 修復 Store.adminDomain / consumerDomain 的 sparse unique 索引問題：
 * - MongoDB sparse unique 會把 null 當可碰撞值
 * - 改為 partialFilterExpression（僅 string）
 * - 清除文件中的 null 域名欄位
 *
 * 執行：npm run fix-store-domain-indexes
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('stores');

  console.log('=== 修復店鋪域名索引 ===\n');

  const unsetResult = await col.updateMany(
    {
      $or: [
        { adminDomain: null },
        { consumerDomain: null },
        { openApiKey: null },
        { openApiKey: '' },
      ],
    },
    {
      $unset: {
        adminDomain: '',
        consumerDomain: '',
        // 僅清除空字串；有值的 openApiKey 保留
      },
    }
  );
  // 分開處理 openApiKey 空字串
  const openApiClean = await col.updateMany(
    { $or: [{ openApiKey: null }, { openApiKey: '' }] },
    { $unset: { openApiKey: '' } }
  );
  console.log(`已清理 null/空域名相關欄位：matched=${unsetResult.matchedCount}`);
  console.log(`已清理空 openApiKey：matched=${openApiClean.matchedCount}`);

  const indexes = await col.indexes();
  for (const name of ['adminDomain_1', 'consumerDomain_1']) {
    if (indexes.some((i) => i.name === name)) {
      await col.dropIndex(name);
      console.log(`已刪除舊索引 ${name}`);
    }
  }

  // 確保新 partial unique 索引存在
  await col.createIndex(
    { adminDomain: 1 },
    {
      unique: true,
      partialFilterExpression: { adminDomain: { $type: 'string' } },
      name: 'adminDomain_1_partial',
    }
  );
  await col.createIndex(
    { consumerDomain: 1 },
    {
      unique: true,
      partialFilterExpression: { consumerDomain: { $type: 'string' } },
      name: 'consumerDomain_1_partial',
    }
  );
  console.log('已建立 partial unique 索引 adminDomain_1_partial / consumerDomain_1_partial');

  console.log('\n完成。請重啟 server 後再試店鋪編輯儲存。');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
