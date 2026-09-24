/**
 * Upsert /vips 三個入會充值方案（silver / gold / platinum）
 * Usage: node server/scripts/seedVibeTierOffers.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const RechargeOffer = require('../models/RechargeOffer');
const User = require('../models/User');
const { VIBE_TIER_RECHARGE_OFFERS } = require('../constants/membershipTiers');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('缺少 MONGODB_URI');
  }
  await mongoose.connect(uri);

  const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error('找不到 admin 用戶作為 createdBy');
  }

  // 方案有效期：由今日起 2 年（可後台再改）
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 2);

  const results = [];
  for (const spec of VIBE_TIER_RECHARGE_OFFERS) {
    const existing = await RechargeOffer.findOne({
      grantMembershipLevel: spec.grantMembershipLevel,
      points: spec.points,
      amount: spec.amount,
    });

    if (existing) {
      existing.name = spec.name;
      existing.description = spec.description;
      existing.sortOrder = spec.sortOrder;
      existing.grantMembershipMonths = spec.grantMembershipMonths;
      existing.isActive = true;
      if (!existing.expiryDate || existing.expiryDate <= new Date()) {
        existing.expiryDate = expiryDate;
      }
      await existing.save();
      results.push({ action: 'updated', id: existing._id, name: existing.name });
      continue;
    }

    const offer = await RechargeOffer.create({
      ...spec,
      expiryDate,
      isActive: true,
      bonusRedeemCodes: [],
      bonusRedeemValidDays: 30,
      createdBy: admin._id,
    });
    results.push({ action: 'created', id: offer._id, name: offer.name });
  }

  console.log(JSON.stringify(results, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
