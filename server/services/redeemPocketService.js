const RedeemCode = require('../models/RedeemCode');
const UserRedeemPocket = require('../models/UserRedeemPocket');
const User = require('../models/User');

function pocketDisplayStatus(pocket, redeemCode, canUse) {
  if (pocket.status === 'removed') return 'removed';
  if (!redeemCode || !redeemCode.isActive) return 'expired';
  const now = new Date();
  if (redeemCode.validUntil && new Date(redeemCode.validUntil) < now) return 'expired';
  if (redeemCode.validFrom && new Date(redeemCode.validFrom) > now) return 'upcoming';
  if (!canUse || pocket.status === 'used') return 'used';
  if (!redeemCode.isValid()) return 'unavailable';
  return 'available';
}

function serializePocketItem(pocket, redeemCode, canUse) {
  const displayStatus = pocketDisplayStatus(pocket, redeemCode, canUse);
  return {
    _id: pocket._id,
    status: displayStatus,
    source: pocket.source,
    assignedAt: pocket.assignedAt,
    usedAt: pocket.usedAt,
    note: pocket.note || '',
    redeemCode: redeemCode
      ? {
          _id: redeemCode._id,
          code: redeemCode.code,
          name: redeemCode.name,
          description: redeemCode.description || '',
          type: redeemCode.type,
          value: redeemCode.value,
          minAmount: redeemCode.minAmount,
          maxDiscount: redeemCode.maxDiscount,
          validFrom: redeemCode.validFrom,
          validUntil: redeemCode.validUntil,
          applicableTypes: redeemCode.applicableTypes,
          applicablePricingSlots: redeemCode.applicablePricingSlots || [],
          isActive: redeemCode.isActive,
        }
      : null,
  };
}

async function ensurePocketEntry({
  userId,
  redeemCodeId,
  source,
  assignedBy = null,
  note = '',
}) {
  const existing = await UserRedeemPocket.findOne({
    user: userId,
    redeemCode: redeemCodeId,
  });

  if (existing) {
    if (existing.status === 'removed') {
      existing.status = 'available';
      existing.source = source;
      existing.assignedBy = assignedBy;
      existing.assignedAt = new Date();
      existing.note = note || existing.note;
      existing.usedAt = null;
      await existing.save();
    }
    return { pocket: existing, created: false };
  }

  const pocket = await UserRedeemPocket.create({
    user: userId,
    redeemCode: redeemCodeId,
    source,
    assignedBy,
    assignedAt: new Date(),
    note,
    status: 'available',
  });

  return { pocket, created: true };
}

async function claimCodeToPocket(userId, codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) {
    return { error: '兌換碼不能為空', status: 400 };
  }

  const redeemCode = await RedeemCode.findOne({ code, isActive: true });
  if (!redeemCode) {
    return { error: '兌換碼不存在或已失效', status: 404 };
  }
  if (!redeemCode.isValid()) {
    return { error: '兌換碼已過期或使用次數已滿', status: 400 };
  }

  const canUse = await redeemCode.canUserUse(userId);
  if (!canUse) {
    return { error: '您已超過此兌換碼的使用次數限制，無法放入口袋', status: 400 };
  }

  const { pocket, created } = await ensurePocketEntry({
    userId,
    redeemCodeId: redeemCode._id,
    source: 'user_claim',
  });

  return {
    pocket: serializePocketItem(pocket, redeemCode, true),
    created,
    message: created ? '已放入兌換券口袋' : '此兌換券已在您的口袋中',
  };
}

async function assignCodeToUsers({
  redeemCodeId,
  userIds,
  assignedBy,
  note = '',
}) {
  const redeemCode = await RedeemCode.findById(redeemCodeId);
  if (!redeemCode) {
    return { error: '兌換碼不存在', status: 404 };
  }
  if (!redeemCode.isActive) {
    return { error: '兌換碼已停用', status: 400 };
  }

  const uniqueIds = [...new Set((userIds || []).map((id) => String(id)).filter(Boolean))];
  if (!uniqueIds.length) {
    return { error: '請至少選擇一位用戶', status: 400 };
  }

  const users = await User.find({ _id: { $in: uniqueIds }, isActive: { $ne: false } })
    .select('_id name email')
    .lean();
  const foundIds = new Set(users.map((u) => String(u._id)));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));

  let assigned = 0;
  let alreadyHad = 0;
  const results = [];

  for (const user of users) {
    const { pocket, created } = await ensurePocketEntry({
      userId: user._id,
      redeemCodeId: redeemCode._id,
      source: 'admin_assign',
      assignedBy,
      note,
    });
    if (created) assigned += 1;
    else alreadyHad += 1;
    results.push({
      userId: user._id,
      name: user.name,
      email: user.email,
      created,
      pocketId: pocket._id,
    });
  }

  return {
    assigned,
    alreadyHad,
    missing,
    results,
    redeemCode: {
      _id: redeemCode._id,
      code: redeemCode.code,
      name: redeemCode.name,
    },
  };
}

async function listUserPocket(userId, { statusFilter } = {}) {
  const pockets = await UserRedeemPocket.find({
    user: userId,
    status: { $ne: 'removed' },
  })
    .populate('redeemCode')
    .sort({ assignedAt: -1 })
    .lean();

  const items = [];
  for (const pocket of pockets) {
    const redeemCode = pocket.redeemCode;
    if (!redeemCode) continue;
    const doc = await RedeemCode.findById(redeemCode._id);
    const canUse = doc ? await doc.canUserUse(userId) : false;
    const item = serializePocketItem(pocket, redeemCode, canUse);
    if (statusFilter && statusFilter !== 'all' && item.status !== statusFilter) {
      continue;
    }
    items.push(item);
  }
  return items;
}

async function markPocketAfterConsume(userId, redeemCodeId, usageId) {
  const pocket = await UserRedeemPocket.findOne({
    user: userId,
    redeemCode: redeemCodeId,
  });
  if (!pocket) return null;

  pocket.lastRedeemUsage = usageId;
  pocket.usedAt = new Date();

  const redeemCode = await RedeemCode.findById(redeemCodeId);
  const canStillUse = redeemCode ? await redeemCode.canUserUse(userId) : false;
  pocket.status = canStillUse ? 'available' : 'used';
  await pocket.save();
  return pocket;
}

module.exports = {
  claimCodeToPocket,
  assignCodeToUsers,
  listUserPocket,
  markPocketAfterConsume,
  ensurePocketEntry,
  serializePocketItem,
};
