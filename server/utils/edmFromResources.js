const mongoose = require('mongoose');
const { ALLOWED_ROLES } = require('./edmRecipients');

const FIELDS = ['subject', 'headline', 'preheader', 'bodyHtml', 'bodyText', 'ctaUrl', 'ctaLabel', 'footerNote'];

/**
 * 範本為底，請求 body 中非空欄位覆寫
 * @param {object|null} template lean 或 null
 * @param {object} body req.body
 */
function mergeEdmContentFromTemplate(template, body) {
  const t = template || {};
  const out = {};
  for (const k of FIELDS) {
    const raw = body[k];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      out[k] = String(raw).trim();
    } else if (t[k] != null && String(t[k]).trim() !== '') {
      out[k] = String(t[k]).trim();
    } else {
      out[k] = k === 'bodyHtml' || k === 'bodyText' ? '' : '';
    }
  }
  return out;
}

/**
 * 將已存發送列表轉成 resolveEdmRecipientEmails 所需 body
 * @param {object} list lean
 * @param {object} body 請求 body（可含 roleBatchOffset / roleBatchLimit 覆寫列表預設）
 */
function mailingListToResolveBody(list, body = {}) {
  if (!list || !list.listMode) {
    const err = new Error('發送列表無效');
    err.status = 400;
    throw err;
  }

  if (list.listMode === 'manual') {
    const emails = Array.isArray(list.emails) ? list.emails.filter(Boolean) : [];
    return {
      recipientMode: 'manual',
      recipients: emails.join('\n'),
      _fromSavedMailingList: true
    };
  }

  if (list.listMode === 'userIds') {
    const ids = (list.userIds || []).map((id) => String(id)).filter((id) => mongoose.isValidObjectId(id));
    return { recipientMode: 'userIds', userIds: ids };
  }

  if (list.listMode === 'roles') {
    const roles = [...new Set((list.roles || []).map((r) => String(r).trim()).filter((r) => ALLOWED_ROLES.includes(r)))];
    if (!roles.length) {
      const err = new Error('此發送列表未設定有效角色');
      err.status = 400;
      throw err;
    }
    const offset =
      body.roleBatchOffset !== undefined && body.roleBatchOffset !== null && String(body.roleBatchOffset) !== ''
        ? Math.max(0, parseInt(String(body.roleBatchOffset), 10) || 0)
        : Math.max(0, parseInt(String(list.defaultRoleBatchOffset), 10) || 0);
    const limitRaw =
      body.roleBatchLimit !== undefined && body.roleBatchLimit !== null && String(body.roleBatchLimit) !== ''
        ? parseInt(String(body.roleBatchLimit), 10)
        : parseInt(String(list.defaultRoleBatchLimit), 10) || 500;
    return {
      recipientMode: 'roles',
      roles,
      roleBatchOffset: offset,
      roleBatchLimit: limitRaw
    };
  }

  const err = new Error('發送列表模式無效');
  err.status = 400;
  throw err;
}

module.exports = {
  mergeEdmContentFromTemplate,
  mailingListToResolveBody,
  CONTENT_FIELDS: FIELDS
};
