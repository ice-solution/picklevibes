/**
 * 查兌換碼是否存在（用 .env 的 MONGODB_URI）
 * Usage: node server/scripts/checkRedeemCode.js 01280N
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const code = String(process.argv[2] || '').trim();
  if (!code) {
    console.error('用法: node server/scripts/checkRedeemCode.js <CODE>');
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('缺少 MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const RedeemCode = require('../models/RedeemCode');
  const RedeemUsage = require('../models/RedeemUsage');

  const doc = await RedeemCode.findOne({ code }).lean();
  const ci = doc
    ? null
    : await RedeemCode.findOne({ code: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean();

  const found = doc || ci;
  if (!found) {
    // 找相近：同前綴／含此字串
    const similar = await RedeemCode.find({
      code: { $regex: code.slice(0, 4), $options: 'i' },
    })
      .select('code name batchId isActive totalUsed createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    console.log(JSON.stringify({
      code,
      exists: false,
      message: 'DB 找不到此兌換碼',
      similarSample: similar,
    }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const usageCount = await RedeemUsage.countDocuments({ redeemCode: found._id });
  let batchCount = null;
  if (found.batchId) {
    batchCount = await RedeemCode.countDocuments({ batchId: found.batchId });
  }

  console.log(JSON.stringify({
    codeQueried: code,
    exists: true,
    redeemCode: {
      _id: String(found._id),
      code: found.code,
      name: found.name,
      type: found.type,
      value: found.value,
      isActive: found.isActive,
      usageLimit: found.usageLimit,
      totalUsed: found.totalUsed,
      batchId: found.batchId ? String(found.batchId) : null,
      applicableTypes: found.applicableTypes,
      createdAt: found.createdAt,
      expiresAt: found.expiresAt,
    },
    redeemUsageCount: usageCount,
    sameBatchCodeCount: batchCount,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
