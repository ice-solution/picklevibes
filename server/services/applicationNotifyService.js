const ApplicationForm = require('../models/ApplicationForm');
const ApplicationSubmission = require('../models/ApplicationSubmission');
const ApplicationNotifyJob = require('../models/ApplicationNotifyJob');
const whatsappMessaging = require('./whatsappMessagingService');

/** 預設間隔範圍（毫秒）：隨機，降低被 WhatsApp 判定為 bot 的風險 */
const DEFAULT_INTERVAL_MIN_MS = 20000;
const DEFAULT_INTERVAL_MAX_MS = 45000;
/** 舊欄位相容：未設 max 時，以 intervalMs 為下限 */
const DEFAULT_INTERVAL_MS = DEFAULT_INTERVAL_MIN_MS;

let workerTimer = null;
let processing = false;

function formHasPhoneField(form) {
  return (form.fields || []).some(
    (f) => String(f.fieldName || '').toLowerCase() === 'phone'
  );
}

/**
 * 以 {{fieldName}} 替換；多餘空白可忽略。缺值則替成空字串。
 */
function renderTemplate(template, data) {
  const map = data && typeof data === 'object' ? data : {};
  return String(template || '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey || '').trim();
    if (!key) return '';
    const val = map[key];
    return val == null ? '' : String(val);
  });
}

function buildTemplateContext(submission) {
  const data = { ...(submission.data || {}) };
  if (submission.contactName && data.name == null) data.name = submission.contactName;
  if (submission.contactEmail && data.email == null) data.email = submission.contactEmail;
  if (submission.contactPhone && data.phone == null) data.phone = submission.contactPhone;
  data.contactName = submission.contactName || data.name || '';
  data.contactEmail = submission.contactEmail || data.email || '';
  data.contactPhone = submission.contactPhone || data.phone || '';
  return data;
}

function resolvePhone(submission) {
  const raw =
    (submission.data && submission.data.phone) ||
    submission.contactPhone ||
    '';
  return String(raw || '').trim();
}

/** 開頭加 submission _id，令每則長度／指紋不一 */
function buildOutboundMessage(submissionId, body) {
  const id = String(submissionId || '').trim();
  const text = String(body || '').trim();
  if (!id) return text;
  if (!text) return id;
  return `${id}\n${text}`;
}

function normalizeIntervalRange(minMs, maxMs) {
  const min = Math.max(5000, Number(minMs) || DEFAULT_INTERVAL_MIN_MS);
  const max = Math.max(min, Number(maxMs) || DEFAULT_INTERVAL_MAX_MS);
  return { min, max };
}

/** 每則之間隨機等待（含上下限） */
function randomIntervalMs(minMs, maxMs) {
  const { min, max } = normalizeIntervalRange(minMs, maxMs);
  return min + Math.floor(Math.random() * (max - min + 1));
}

function jobIntervalRange(job) {
  const min = job?.intervalMinMs ?? job?.intervalMs ?? DEFAULT_INTERVAL_MIN_MS;
  const max = job?.intervalMaxMs ?? DEFAULT_INTERVAL_MAX_MS;
  return normalizeIntervalRange(min, max);
}

async function createNotifyJob({
  formId,
  template,
  submissionIds,
  createdBy,
  intervalMs,
  intervalMinMs,
  intervalMaxMs,
}) {
  if (!whatsappMessaging.isWhatsAppConfigured()) {
    return { error: 'WhatsApp 未設定，無法發送通知', status: 503 };
  }

  const tpl = String(template || '').trim();
  if (!tpl) {
    return { error: '請輸入訊息內容', status: 400 };
  }

  const form = await ApplicationForm.findById(formId);
  if (!form) {
    return { error: '申請表不存在', status: 404 };
  }
  if (!formHasPhoneField(form)) {
    return { error: '此申請表沒有 phone 欄位，無法發送通知', status: 400 };
  }

  const query = { form: form._id };
  if (Array.isArray(submissionIds) && submissionIds.length > 0) {
    query._id = { $in: submissionIds };
  }

  const submissions = await ApplicationSubmission.find(query).sort({ createdAt: 1 });
  if (!submissions.length) {
    return { error: '沒有可發送的提交記錄', status: 400 };
  }

  const range = normalizeIntervalRange(
    intervalMinMs ?? intervalMs ?? DEFAULT_INTERVAL_MIN_MS,
    intervalMaxMs ?? DEFAULT_INTERVAL_MAX_MS
  );

  const items = [];
  let skippedCount = 0;
  for (const sub of submissions) {
    const phone = resolvePhone(sub);
    if (!phone || !whatsappMessaging.isValidPhoneNumber(phone)) {
      skippedCount += 1;
      continue;
    }
    const ctx = buildTemplateContext(sub);
    const body = renderTemplate(tpl, ctx).trim();
    if (!body) {
      skippedCount += 1;
      continue;
    }
    items.push({
      submission: sub._id,
      phone,
      message: buildOutboundMessage(sub._id, body),
      status: 'pending',
    });
  }

  if (!items.length) {
    return {
      error: '沒有有效的電話號碼可發送（請確認提交資料含 phone）',
      status: 400,
      skippedCount,
    };
  }

  const job = await ApplicationNotifyJob.create({
    form: form._id,
    store: form.store,
    template: tpl,
    status: 'pending',
    intervalMs: range.min,
    intervalMinMs: range.min,
    intervalMaxMs: range.max,
    items,
    total: items.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount,
    createdBy: createdBy || null,
  });

  kickWorker();
  return { job };
}

function serializeJob(job) {
  const j = job.toObject ? job.toObject() : job;
  const range = jobIntervalRange(j);
  return {
    _id: j._id,
    form: j.form,
    status: j.status,
    template: j.template,
    intervalMs: range.min,
    intervalMinMs: range.min,
    intervalMaxMs: range.max,
    total: j.total,
    sentCount: j.sentCount,
    failedCount: j.failedCount,
    skippedCount: j.skippedCount,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    createdAt: j.createdAt,
    pendingCount: (j.items || []).filter((i) => i.status === 'pending').length,
    items: (j.items || []).map((i) => ({
      _id: i._id,
      submission: i.submission,
      phone: i.phone,
      status: i.status,
      error: i.error || '',
      sentAt: i.sentAt,
      messagePreview: String(i.message || '').slice(0, 80),
    })),
  };
}

async function getJob(jobId) {
  const job = await ApplicationNotifyJob.findById(jobId);
  if (!job) return { error: '工作不存在', status: 404 };
  return { job: serializeJob(job) };
}

async function cancelJob(jobId) {
  const job = await ApplicationNotifyJob.findById(jobId);
  if (!job) return { error: '工作不存在', status: 404 };
  if (job.status === 'completed' || job.status === 'cancelled') {
    return { job: serializeJob(job) };
  }
  for (const item of job.items) {
    if (item.status === 'pending') {
      item.status = 'skipped';
    }
  }
  job.status = 'cancelled';
  job.finishedAt = new Date();
  await job.save();
  return { job: serializeJob(job) };
}

async function hasWork() {
  return ApplicationNotifyJob.exists({
    status: { $in: ['pending', 'running'] },
    'items.status': 'pending',
  });
}

async function processOneItem() {
  const job = await ApplicationNotifyJob.findOne({
    status: { $in: ['pending', 'running'] },
    items: { $elemMatch: { status: 'pending' } },
  }).sort({ createdAt: 1 });

  if (!job) {
    return { didWork: false, intervalMs: randomIntervalMs() };
  }

  if (job.status === 'pending') {
    job.status = 'running';
    job.startedAt = job.startedAt || new Date();
  }

  const item = job.items.find((i) => i.status === 'pending');
  const range = jobIntervalRange(job);
  if (!item) {
    job.status = 'completed';
    job.finishedAt = new Date();
    await job.save();
    return { didWork: false, intervalMs: randomIntervalMs(range.min, range.max) };
  }

  try {
    const submissionId = String(item.submission || '').trim();
    const msgText = String(item.message || '');
    const nl = msgText.indexOf('\n');
    const body = nl >= 0 ? msgText.slice(nl + 1).trim() : msgText;

    const result = await whatsappMessaging.sendApplicationNotify(
      item.phone,
      { submissionId, body },
      msgText
    );
    if (result.skipped) {
      throw new Error(result.reason || 'skipped');
    }
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }

    item.status = 'sent';
    item.sentAt = new Date();
    item.error = '';
    job.sentCount = (job.sentCount || 0) + 1;
  } catch (err) {
    item.status = 'failed';
    item.error = err.response?.data?.message || err.message || '發送失敗';
    job.failedCount = (job.failedCount || 0) + 1;
    console.error('❌ 申請表 WhatsApp 通知失敗:', item.phone, item.error);
  }

  const stillPending = job.items.some((i) => i.status === 'pending');
  if (!stillPending) {
    job.status = 'completed';
    job.finishedAt = new Date();
  }

  await job.save();
  return {
    didWork: true,
    intervalMs: randomIntervalMs(range.min, range.max),
  };
}

function scheduleNext(delayMs) {
  if (workerTimer) return;
  workerTimer = setTimeout(async () => {
    workerTimer = null;
    if (processing) {
      scheduleNext(200);
      return;
    }
    processing = true;
    let result = { didWork: false, intervalMs: randomIntervalMs() };
    try {
      result = await processOneItem();
    } catch (err) {
      console.error('❌ 申請表通知佇列錯誤:', err);
    } finally {
      processing = false;
    }

    const wait = result.didWork ? result.intervalMs : 1500;
    if (result.didWork || (await hasWork())) {
      scheduleNext(wait);
    }
  }, Math.max(0, delayMs));
}

function kickWorker() {
  scheduleNext(0);
}

/** 伺服器啟動時恢復未完成佇列 */
function startApplicationNotifyWorker() {
  kickWorker();
  console.log(
    `📲 申請表 WhatsApp 通知佇列已啟動（provider=${whatsappMessaging.resolveProvider() || 'none'}；隨機間隔 ${DEFAULT_INTERVAL_MIN_MS / 1000}–${DEFAULT_INTERVAL_MAX_MS / 1000} 秒／則）`
  );
}

module.exports = {
  formHasPhoneField,
  renderTemplate,
  buildOutboundMessage,
  createNotifyJob,
  getJob,
  cancelJob,
  serializeJob,
  kickWorker,
  startApplicationNotifyWorker,
  DEFAULT_INTERVAL_MS,
  DEFAULT_INTERVAL_MIN_MS,
  DEFAULT_INTERVAL_MAX_MS,
};
