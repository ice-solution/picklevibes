const RedeemCode = require('../models/RedeemCode');
const UserRedeemPocket = require('../models/UserRedeemPocket');
const {
  isBookingEligibleForSettle,
  suggestedSettlePoints,
  loadBundledBookings,
  bundleAlreadySettled,
} = require('./bookingSettleService');
const { assertRedeemCodePricingSlotAllowed } = require('../utils/redeemBookingContext');
const { consumeRedeemCodeOnce } = require('./redeemUsageService');

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.statusCode = status;
  return err;
}

function redeemTypeAllowsBooking(redeemCode) {
  const types = redeemCode.applicableTypes || [];
  return types.includes('all') || types.includes('booking');
}

/**
 * 多券疊加：每張券各自對同一 base 計算折扣，再加總並 cap 於 base。
 * 例：base=300，10% → 30，fixed 50 → 50，合計 80，應付 220。
 */
function stackDiscountsAgainstBase(base, discountAmounts) {
  const safeBase = Math.max(0, Number(base) || 0);
  const items = (discountAmounts || []).map((d) => Math.max(0, Math.round(Number(d) || 0)));
  let remaining = safeBase;
  const capped = items.map((d) => {
    const take = Math.min(d, remaining);
    remaining -= take;
    return take;
  });
  const totalDiscount = capped.reduce((s, d) => s + d, 0);
  return {
    discounts: capped,
    totalDiscount,
    finalAmount: Math.max(0, safeBase - totalDiscount),
  };
}

async function assertCanMutatePendingRedeems(booking) {
  if (!booking) throw httpError('預約不存在', 404);
  if (await bundleAlreadySettled(booking)) {
    throw httpError('此預約已完成結算，無法再變更兌換碼', 400);
  }
  if (!isBookingEligibleForSettle(booking)) {
    throw httpError('此預約不可掛載兌換碼（不可結算或為活動佔場）', 400);
  }
}

function resolveSettleBase(bundle, baseOverride) {
  const suggested = bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0);
  if (baseOverride != null && Number.isFinite(Number(baseOverride)) && Number(baseOverride) >= 0) {
    return Number(baseOverride);
  }
  return suggested;
}

function collectPendingRedeemEntries(bundle) {
  const seen = new Set();
  const entries = [];
  for (const b of bundle) {
    for (const entry of b.pendingRedeems || []) {
      const id = String(entry.redeemCode?._id || entry.redeemCode);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push(entry);
    }
  }
  return entries;
}

async function loadRedeemDocsForEntries(entries) {
  const ids = entries.map((e) => e.redeemCode).filter(Boolean);
  if (!ids.length) return new Map();
  const docs = await RedeemCode.find({ _id: { $in: ids } });
  return new Map(docs.map((d) => [String(d._id), d]));
}

async function validateRedeemCodeForSettle({
  redeemCode,
  baseAmount,
  userId,
  booking,
}) {
  if (!redeemCode || !redeemCode.isValid()) {
    throw httpError('兌換碼無效或已過期');
  }
  if (!redeemTypeAllowsBooking(redeemCode)) {
    throw httpError('此兌換碼不適用於場地預約');
  }
  if (baseAmount < redeemCode.minAmount) {
    throw httpError(`此兌換碼需要最低消費 HK$${redeemCode.minAmount}`);
  }
  if (userId) {
    const canUse = await redeemCode.canUserUse(userId);
    if (!canUse) {
      throw httpError('此用戶已超過此兌換碼的使用次數限制');
    }
  }
  await assertRedeemCodePricingSlotAllowed(redeemCode, {
    orderType: 'booking',
    courtId: booking.court?._id || booking.court,
    date: booking.date,
    startTime: booking.startTime,
  });
  return redeemCode.calculateDiscount(baseAmount);
}

async function computePendingRedeemPreview(booking, { baseOverride, forUserId } = {}) {
  const bundle = await loadBundledBookings(booking);
  const alreadySettled = await bundleAlreadySettled(booking);
  const baseAmount = alreadySettled
    ? bundle.reduce((sum, b) => sum + (Number(b.payment?.pointsDeducted) || 0), 0)
    : resolveSettleBase(bundle, baseOverride);

  const entries = collectPendingRedeemEntries(bundle);
  const codeMap = await loadRedeemDocsForEntries(entries);
  const userId = forUserId || booking.user?._id || booking.user || null;

  const rawDiscounts = [];
  const applied = [];

  for (const entry of entries) {
    const id = String(entry.redeemCode?._id || entry.redeemCode);
    const doc = codeMap.get(id);
    let discountAmount = 0;
    let valid = true;
    let error = null;
    try {
      if (!doc) throw httpError('兌換碼不存在');
      discountAmount = await validateRedeemCodeForSettle({
        redeemCode: doc,
        baseAmount,
        userId,
        booking,
      });
    } catch (err) {
      valid = false;
      error = err.message || '兌換碼無效';
      discountAmount = 0;
    }
    rawDiscounts.push(discountAmount);
    applied.push({
      redeemCodeId: id,
      code: doc?.code || entry.code || '',
      name: doc?.name || entry.name || '',
      type: doc?.type || entry.type,
      value: doc?.value ?? entry.value,
      discountAmount,
      valid,
      error,
    });
  }

  const stacked = stackDiscountsAgainstBase(baseAmount, rawDiscounts);
  applied.forEach((row, i) => {
    row.discountAmount = stacked.discounts[i] || 0;
  });

  return {
    baseAmount,
    suggestedPoints: bundle.reduce((sum, b) => sum + suggestedSettlePoints(b), 0),
    applied,
    totalDiscount: stacked.totalDiscount,
    netPayable: stacked.finalAmount,
  };
}

async function resolveRedeemCodeFromInput({
  code,
  redeemCodeId,
  pocketItemId,
  forUserId,
}) {
  if (pocketItemId) {
    if (!forUserId) throw httpError('使用口袋兌換券時請指定用戶');
    const pocket = await UserRedeemPocket.findOne({
      _id: pocketItemId,
      user: forUserId,
      status: { $ne: 'removed' },
    });
    if (!pocket) throw httpError('口袋中找不到此兌換券', 404);
    const redeemCode = await RedeemCode.findById(pocket.redeemCode);
    if (!redeemCode) throw httpError('兌換碼不存在', 404);
    return redeemCode;
  }
  if (redeemCodeId) {
    const redeemCode = await RedeemCode.findById(redeemCodeId);
    if (!redeemCode) throw httpError('兌換碼不存在', 404);
    return redeemCode;
  }
  if (code) {
    const redeemCode = await RedeemCode.findOne({
      code: String(code).toUpperCase().trim(),
      isActive: true,
    });
    if (!redeemCode) throw httpError('兌換碼不存在或已失效', 404);
    return redeemCode;
  }
  throw httpError('請提供兌換碼或選擇口袋兌換券');
}

/**
 * 將 pendingRedeems 寫入 bundle 的「主」預約（請求的那筆），並清空同組其他場的 pendingRedeems，避免重複。
 */
async function writePendingRedeemsToBundleLeader(booking, pendingRedeems) {
  const bundle = await loadBundledBookings(booking);
  const leaderId = String(booking._id);
  for (const b of bundle) {
    if (String(b._id) === leaderId) {
      b.pendingRedeems = pendingRedeems;
    } else if (b.pendingRedeems?.length) {
      b.pendingRedeems = [];
    } else {
      continue;
    }
    await b.save();
  }
  return bundle.find((b) => String(b._id) === leaderId) || booking;
}

async function addPendingRedeem({
  bookingId,
  code,
  redeemCodeId,
  pocketItemId,
  forUserId,
  baseOverride,
  adminUser,
}) {
  const Booking = require('../models/Booking');
  const booking = await Booking.findById(bookingId);
  await assertCanMutatePendingRedeems(booking);

  const bundle = await loadBundledBookings(booking);
  const baseAmount = resolveSettleBase(bundle, baseOverride);
  const userId = forUserId || booking.user;

  const redeemCode = await resolveRedeemCodeFromInput({
    code,
    redeemCodeId,
    pocketItemId,
    forUserId: userId,
  });

  const existing = collectPendingRedeemEntries(bundle);
  if (existing.some((e) => String(e.redeemCode) === String(redeemCode._id))) {
    throw httpError('此兌換碼已掛載於本預約');
  }

  await validateRedeemCodeForSettle({
    redeemCode,
    baseAmount,
    userId,
    booking,
  });

  const next = [
    ...existing.map((e) => ({
      redeemCode: e.redeemCode,
      code: e.code,
      name: e.name,
      type: e.type,
      value: e.value,
      attachedAt: e.attachedAt,
      attachedBy: e.attachedBy,
    })),
    {
      redeemCode: redeemCode._id,
      code: redeemCode.code,
      name: redeemCode.name,
      type: redeemCode.type,
      value: redeemCode.value,
      attachedAt: new Date(),
      attachedBy: adminUser?._id || adminUser || undefined,
    },
  ];

  await writePendingRedeemsToBundleLeader(booking, next);
  return computePendingRedeemPreview(booking, { baseOverride, forUserId: userId });
}

async function removePendingRedeem({ bookingId, redeemCodeId, forUserId, baseOverride }) {
  const Booking = require('../models/Booking');
  const booking = await Booking.findById(bookingId);
  await assertCanMutatePendingRedeems(booking);

  const bundle = await loadBundledBookings(booking);
  const existing = collectPendingRedeemEntries(bundle);
  const next = existing
    .filter((e) => String(e.redeemCode) !== String(redeemCodeId))
    .map((e) => ({
      redeemCode: e.redeemCode,
      code: e.code,
      name: e.name,
      type: e.type,
      value: e.value,
      attachedAt: e.attachedAt,
      attachedBy: e.attachedBy,
    }));

  if (next.length === existing.length) {
    throw httpError('找不到要移除的兌換碼', 404);
  }

  await writePendingRedeemsToBundleLeader(booking, next);
  return computePendingRedeemPreview(booking, {
    baseOverride,
    forUserId: forUserId || booking.user,
  });
}

async function clearPendingRedeemsOnBundle(bundle) {
  for (const b of bundle) {
    if (b.pendingRedeems?.length) {
      b.pendingRedeems = [];
      await b.save();
    }
  }
}

/**
 * 結算時消費掛載的兌換碼，回傳折扣結果。失敗則整筆 throw（不部分消費）。
 */
async function consumePendingRedeemsOnSettle({
  booking,
  bundle,
  baseAmount,
  targetUserId,
  ipAddress,
  userAgent,
}) {
  const entries = collectPendingRedeemEntries(bundle);
  if (!entries.length) {
    return {
      baseAmount,
      totalDiscount: 0,
      netPayable: baseAmount,
      applied: [],
    };
  }

  const codeMap = await loadRedeemDocsForEntries(entries);
  const rawDiscounts = [];
  const validated = [];

  for (const entry of entries) {
    const id = String(entry.redeemCode);
    const doc = codeMap.get(id);
    if (!doc) throw httpError(`兌換碼不存在：${entry.code || id}`);
    const discountAmount = await validateRedeemCodeForSettle({
      redeemCode: doc,
      baseAmount,
      userId: targetUserId,
      booking,
    });
    rawDiscounts.push(discountAmount);
    validated.push({ doc, discountAmount, entry });
  }

  const stacked = stackDiscountsAgainstBase(baseAmount, rawDiscounts);
  const netPayable = stacked.finalAmount;
  const applied = [];

  for (let i = 0; i < validated.length; i += 1) {
    const { doc } = validated[i];
    const discountAmount = stacked.discounts[i] || 0;
    if (discountAmount > 0) {
      await consumeRedeemCodeOnce({
        redeemCodeId: doc._id,
        userId: targetUserId,
        orderType: 'booking',
        orderId: booking._id,
        originalAmount: baseAmount,
        discountAmount,
        finalAmount: netPayable,
        ipAddress,
        userAgent,
      });
      applied.push({
        redeemCodeId: String(doc._id),
        code: doc.code,
        name: doc.name,
        discountAmount,
      });
    }
  }

  await clearPendingRedeemsOnBundle(bundle);

  return {
    baseAmount,
    totalDiscount: stacked.totalDiscount,
    netPayable,
    applied,
  };
}

module.exports = {
  stackDiscountsAgainstBase,
  computePendingRedeemPreview,
  addPendingRedeem,
  removePendingRedeem,
  consumePendingRedeemsOnSettle,
  resolveSettleBase,
  collectPendingRedeemEntries,
};
