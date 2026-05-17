/**
 * SendGrid：EDM（Dynamic Transactional Template）與 Marketing Contacts 同步。
 *
 * Dynamic Template 建議在 SendGrid 編輯器使用與下列一致的 Handlebars 變數名稱
 * （三括號用於 HTML：{{{body_html}}}）：
 *   subject, headline, preheader, body_html, body_text,
 *   cta_url, cta_label, footer_note, site_url, site_name,
 *   first_name, last_name, recipient_email
 *
 * 環境變數：
 *   SENDGRID_API_KEY           — 必填（Mail + Marketing API）
 *   SENDGRID_EDM_TEMPLATE_ID   — 必填（d-xxxx，Transactional 動態範本）
 *   SENDGRID_FROM_EMAIL        — 必填（已於 SendGrid 驗證的寄件人）
 *   SENDGRID_FROM_NAME         — 選填，預設 PickleVibes 匹克球場
 *   SENDGRID_EDM_CHUNK         — 選填，每封 API 最多 personalizations（預設 1000，上限 1000）
 *   SENDGRID_MARKETING_LIST_IDS — 選填，同步聯絡人時附加的 list id（逗號分隔）
 */

const sgMail = require('@sendgrid/mail');

const MAX_PERSONALIZATIONS = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldUseSendGridEdm() {
  const key = String(process.env.SENDGRID_API_KEY || '').trim();
  const tid = String(process.env.SENDGRID_EDM_TEMPLATE_ID || '').trim();
  const from = String(process.env.SENDGRID_FROM_EMAIL || '').trim();
  return Boolean(key && tid && from);
}

function isSendGridEdmAbortError(err) {
  if (!err) return false;
  const status = err.code || err.responseCode || err?.response?.statusCode || err?.response?.status;
  if (status === 401 || status === 403) return true;
  if (status === 429) return true;
  const msg = `${err.message || ''}`.toLowerCase();
  if (/unauthori|forbidden|rate limit|too many requests/.test(msg)) return true;
  return false;
}

function buildCommonDynamicData({
  subject,
  headline,
  preheader,
  bodyHtml,
  bodyText,
  ctaUrl,
  ctaLabel,
  footerNote
}) {
  const siteUrl = (process.env.CLIENT_URL || 'https://picklevibes.hk').replace(/\/+$/, '');
  return {
    subject: String(subject || ''),
    headline: String(headline || subject || ''),
    preheader: String(preheader || ''),
    body_html: String(bodyHtml || ''),
    body_text: String(bodyText || ''),
    cta_url: String(ctaUrl || ''),
    cta_label: String(ctaLabel || ''),
    footer_note: String(footerNote || ''),
    site_url: siteUrl,
    site_name: 'picklevibes.hk'
  };
}

function splitName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = (parts[0] || '會員').slice(0, 100);
  const last = parts.slice(1).join(' ').slice(0, 100);
  return { first_name: first, last_name: last };
}

/**
 * 使用 Dynamic Template 批次寄送 EDM（每批最多 MAX_PERSONALIZATIONS 個 personalization）。
 */
async function sendEdmViaSendGridDynamicTemplate({
  recipients,
  subject,
  headline,
  preheader,
  bodyHtml,
  bodyText,
  ctaUrl,
  ctaLabel,
  footerNote,
  campaignId,
  userIdByEmail,
  nameByEmail
}) {
  const mongoose = require('mongoose');
  const EdmSendLog = require('../models/EdmSendLog');
  const { normalizeRecipients } = require('../utils/edmTemplate');

  const list = normalizeRecipients(recipients).sort((a, b) => a.localeCompare(b));
  if (!list.length) {
    return {
      success: false,
      error: '收件人為空',
      sent: 0,
      failed: 0,
      errors: [],
      aborted: false,
      abortReason: '',
      provider: 'sendgrid'
    };
  }

  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim();
  const templateId = String(process.env.SENDGRID_EDM_TEMPLATE_ID || '').trim();
  const fromEmail = String(process.env.SENDGRID_FROM_EMAIL || '').trim();
  const fromName = String(process.env.SENDGRID_FROM_NAME || 'PickleVibes 匹克球場').trim();
  const chunkSize = Math.min(
    MAX_PERSONALIZATIONS,
    Math.max(1, parseInt(process.env.SENDGRID_EDM_CHUNK || '1000', 10) || 1000)
  );

  sgMail.setApiKey(apiKey);

  const uidMap = userIdByEmail && typeof userIdByEmail === 'object' ? userIdByEmail : {};
  const nameMap = nameByEmail && typeof nameByEmail === 'object' ? nameByEmail : {};

  const common = buildCommonDynamicData({
    subject,
    headline,
    preheader,
    bodyHtml,
    bodyText,
    ctaUrl,
    ctaLabel,
    footerNote
  });

  const errors = [];
  const sendLogs = [];
  let sent = 0;
  let aborted = false;
  let abortReason = '';

  const flushLogs = async () => {
    if (!campaignId || !sendLogs.length) return;
    try {
      await EdmSendLog.insertMany(sendLogs, { ordered: true });
    } catch (logErr) {
      console.error('❌ EDM（SendGrid）寄送紀錄寫入失敗:', logErr.message);
    }
  };

  for (let offset = 0; offset < list.length; offset += chunkSize) {
    if (aborted) break;
    const chunk = list.slice(offset, offset + chunkSize);
    const personalizations = chunk.map((email) => {
      const displayName = String(nameMap[email] || '').trim();
      const { first_name, last_name } = splitName(displayName);
      return {
        to: [{ email }],
        dynamic_template_data: {
          ...common,
          first_name,
          last_name,
          recipient_email: email
        }
      };
    });

    const msg = {
      from: { email: fromEmail, name: fromName },
      templateId,
      personalizations
    };

    try {
      await sgMail.send(msg);
      const now = new Date();
      sent += chunk.length;
      if (campaignId) {
        for (const email of chunk) {
          const row = {
            campaign: campaignId,
            email,
            status: 'sent',
            errorMessage: '',
            sentAt: now
          };
          const uid = uidMap[email];
          if (uid) row.user = new mongoose.Types.ObjectId(String(uid));
          sendLogs.push(row);
        }
      }
      await sleep(Math.max(50, parseInt(process.env.SENDGRID_EDM_BATCH_GAP_MS || '200', 10)));
    } catch (e) {
      const mailErr = e.message || String(e);
      const now = new Date();
      for (const email of chunk) {
        errors.push({ to: email, error: mailErr });
        if (campaignId) {
          const row = {
            campaign: campaignId,
            email,
            status: 'failed',
            errorMessage: mailErr,
            sentAt: now
          };
          const uid = uidMap[email];
          if (uid) row.user = new mongoose.Types.ObjectId(String(uid));
          sendLogs.push(row);
        }
      }

      if (isSendGridEdmAbortError(e)) {
        aborted = true;
        abortReason = mailErr;
        const skipNote = '未嘗試寄送（SendGrid 錯誤已中止本活動剩餘批次）';
        const rest = list.slice(offset + chunk.length);
        for (const email of rest) {
          errors.push({ to: email, error: `${skipNote}: ${mailErr}` });
          if (campaignId) {
            const row = {
              campaign: campaignId,
              email,
              status: 'failed',
              errorMessage: `${skipNote}: ${mailErr}`,
              sentAt: new Date()
            };
            const uid = uidMap[email];
            if (uid) row.user = new mongoose.Types.ObjectId(String(uid));
            sendLogs.push(row);
          }
        }
        console.error(`❌ SendGrid EDM 已中止：${mailErr}（本批 ${chunk.length} 封標為失敗，略過 ${rest.length} 封）`);
        break;
      }

      await sleep(2000);
    }
  }

  await flushLogs();

  return {
    success: errors.length === 0,
    sent,
    failed: errors.length,
    errors,
    aborted,
    abortReason: aborted ? abortReason : '',
    provider: 'sendgrid'
  };
}

/**
 * 將 Mongo User 同步到 SendGrid Marketing Contacts（分批 PUT）。
 * API Key 需具 Marketing → Contacts 寫入權限。
 */
async function syncUsersToSendGridMarketing({ batchSize = 400, maxUsers = 50000 } = {}) {
  const apiKey = String(process.env.SENDGRID_API_KEY || '').trim();
  if (!apiKey) {
    const e = new Error('缺少 SENDGRID_API_KEY');
    e.status = 400;
    throw e;
  }

  const listIdsRaw = String(process.env.SENDGRID_MARKETING_LIST_IDS || '').trim();
  const list_ids = listIdsRaw
    ? listIdsRaw
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const User = require('../models/User');
  const bs = Math.min(1000, Math.max(1, parseInt(batchSize, 10) || 400));
  const cap = Math.min(500000, Math.max(1, parseInt(maxUsers, 10) || 50000));

  let skip = 0;
  const jobIds = [];
  let totalSynced = 0;
  let batches = 0;
  const errors = [];

  while (skip < cap) {
    const users = await User.find({
      isActive: true,
      email: { $exists: true, $nin: [null, ''] }
    })
      .select('email name')
      .lean()
      .sort({ _id: 1 })
      .skip(skip)
      .limit(bs);

    if (!users.length) break;

    const contacts = users.map((u) => {
      const email = String(u.email).toLowerCase().trim();
      const { first_name, last_name } = splitName(u.name);
      return { email, first_name, last_name };
    });

    const body = { contacts };
    if (list_ids && list_ids.length) body.list_ids = list_ids;

    const res = await fetch('https://api.sendgrid.com/v3/marketing/contacts', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { raw: text.slice(0, 800) };
    }

    if (!res.ok) {
      errors.push({ skip, status: res.status, detail: json });
      break;
    }

    totalSynced += contacts.length;
    batches += 1;
    if (json.job_id) jobIds.push(json.job_id);
    skip += users.length;
    await sleep(300);
  }

  return {
    totalSynced,
    batches,
    jobIds,
    errors,
    list_ids: list_ids || null
  };
}

module.exports = {
  shouldUseSendGridEdm,
  sendEdmViaSendGridDynamicTemplate,
  syncUsersToSendGridMarketing
};
