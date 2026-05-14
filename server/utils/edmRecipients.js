const mongoose = require('mongoose');
const User = require('../models/User');
const { normalizeRecipients } = require('./edmTemplate');

const ALLOWED_ROLES = ['user', 'coach', 'admin'];
const MAX_MANUAL = 150;
/** 已存「發送列表」手動模式可存較多名單；單次寄送仍由此上限約束 */
const MAX_MANUAL_SAVED_LIST = 2000;
const MAX_USER_IDS = 500;
/** 依角色單次請求最多寄送幾封（可配合 offset 分批，有序按 email） */
const MAX_ROLE_BATCH = 2000;

function parseRoleBatch(body) {
  const offset = Math.max(0, parseInt(body.roleBatchOffset, 10) || 0);
  const limitRaw = parseInt(body.roleBatchLimit, 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(MAX_ROLE_BATCH, Math.max(1, limitRaw))
    : 500;
  return { offset, limit };
}

/**
 * 預覽依角色篩選的用戶（不發信），固定依 email 升序
 */
async function previewRoleRecipients({ roles, offset = 0, limit = 50 }) {
  const rolesClean = [...new Set(roles.map((r) => String(r).trim()).filter((r) => ALLOWED_ROLES.includes(r)))];
  if (!rolesClean.length) {
    const err = new Error('請選擇至少一個角色（user / coach / admin）');
    err.status = 400;
    throw err;
  }
  const safeOffset = Math.max(0, parseInt(String(offset), 10) || 0);
  const safeLimit = Math.min(MAX_ROLE_BATCH, Math.max(1, parseInt(String(limit), 10) || 50));
  const filter = { role: { $in: rolesClean }, isActive: true };
  const totalMatched = await User.countDocuments(filter);
  const users = await User.find(filter)
    .select('email name role')
    .sort({ email: 1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .lean();

  const hasMore = safeOffset + users.length < totalMatched;
  return {
    roles: rolesClean,
    totalMatched,
    offset: safeOffset,
    limit: safeLimit,
    hasMore,
    items: users.map((u) => ({
      email: String(u.email || '').toLowerCase(),
      name: u.name || '',
      role: u.role || ''
    }))
  };
}

/**
 * 解析 EDM 收件人為 email 陣列（依模式；依角色時為有序分批：email 升序 + skip/limit）
 */
async function resolveEdmRecipientEmails(body) {
  const mode = String(body.recipientMode || 'manual').trim();

  if (mode === 'manual') {
    const list = normalizeRecipients(body.recipients);
    if (!list.length) {
      const err = new Error('請提供至少一個有效電郵');
      err.status = 400;
      throw err;
    }
    const maxManual = body._fromSavedMailingList ? MAX_MANUAL_SAVED_LIST : MAX_MANUAL;
    if (list.length > maxManual) {
      const err = new Error(`手動電郵單次最多 ${maxManual} 個${body._fromSavedMailingList ? '（已存發送列表）' : ''}`);
      err.status = 400;
      throw err;
    }
    const emails = [...new Set(list.map((e) => e.toLowerCase()))].sort((a, b) => a.localeCompare(b));
    return {
      emails,
      userIdByEmail: {},
      meta: { mode: 'manual', count: emails.length, orderedBy: 'email' }
    };
  }

  if (mode === 'userIds') {
    const raw = Array.isArray(body.userIds) ? body.userIds : [];
    const ids = [...new Set(raw.map((id) => String(id).trim()).filter((id) => mongoose.isValidObjectId(id)))];
    if (!ids.length) {
      const err = new Error('請選擇至少一位有效用戶（userIds）');
      err.status = 400;
      throw err;
    }
    if (ids.length > MAX_USER_IDS) {
      const err = new Error(`單次最多指定 ${MAX_USER_IDS} 位用戶`);
      err.status = 400;
      throw err;
    }
    const oids = ids.map((id) => new mongoose.Types.ObjectId(id));
    const users = await User.find({ _id: { $in: oids }, isActive: true }).select('email _id').lean();
    const userIdByEmail = {};
    for (const u of users) {
      const e = String(u.email || '').toLowerCase();
      if (!e || userIdByEmail[e]) continue;
      userIdByEmail[e] = u._id;
    }
    const emails = [...new Set(users.map((u) => String(u.email || '').toLowerCase()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    return {
      emails,
      userIdByEmail,
      meta: { mode: 'userIds', requestedIds: ids.length, activeWithEmail: emails.length, orderedBy: 'email' }
    };
  }

  if (mode === 'roles') {
    const raw = Array.isArray(body.roles) ? body.roles : [];
    const roles = [...new Set(raw.map((r) => String(r).trim()).filter((r) => ALLOWED_ROLES.includes(r)))];
    if (!roles.length) {
      const err = new Error('請選擇至少一個角色（user / coach / admin）');
      err.status = 400;
      throw err;
    }
    const { offset, limit } = parseRoleBatch(body);
    const filter = { role: { $in: roles }, isActive: true };
    const totalMatched = await User.countDocuments(filter);

    if (offset >= totalMatched) {
      const err = new Error(`起始位置 ${offset} 已超過符合人數 ${totalMatched}，請將「起始位置」調回 0 或較小數字`);
      err.status = 400;
      throw err;
    }

    const users = await User.find(filter)
      .select('email name role _id')
      .sort({ email: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const userIdByEmail = {};
    for (const u of users) {
      const e = String(u.email || '').toLowerCase();
      if (!e || userIdByEmail[e]) continue;
      userIdByEmail[e] = u._id;
    }

    const emails = users.map((u) => String(u.email || '').toLowerCase()).filter(Boolean);
    const hasMore = offset + users.length < totalMatched;

    return {
      emails,
      userIdByEmail,
      meta: {
        mode: 'roles',
        roles,
        totalMatched,
        batchOffset: offset,
        batchLimit: limit,
        batchCount: emails.length,
        hasMore,
        orderedBy: 'email',
        items: users.map((u) => ({
          email: String(u.email || '').toLowerCase(),
          name: u.name || '',
          role: u.role || ''
        }))
      }
    };
  }

  const err = new Error('recipientMode 必須為 manual、userIds 或 roles');
  err.status = 400;
  throw err;
}

module.exports = {
  resolveEdmRecipientEmails,
  previewRoleRecipients,
  ALLOWED_ROLES,
  MAX_MANUAL,
  MAX_MANUAL_SAVED_LIST,
  MAX_USER_IDS,
  MAX_ROLE_BATCH
};
