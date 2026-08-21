const ApplicationForm = require('../models/ApplicationForm');
const ApplicationSubmission = require('../models/ApplicationSubmission');
const ApplicationNotifyJob = require('../models/ApplicationNotifyJob');
const {
  isOpenWaConfigured,
  isValidPhoneNumber,
  sendTextMessage,
} = require('./openWaService');

const DEFAULT_INTERVAL_MS = 2000;

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

async function createNotifyJob({
  formId,
  template,
  submissionIds,
  createdBy,
  intervalMs = DEFAULT_INTERVAL_MS,
}) {
  if (!isOpenWaConfigured()) {
    return { error: 'OpenWA 未設定，無法發送通知', status: 503 };
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

  const items = [];
  let skippedCount = 0;
  for (const sub of submissions) {
    const phone = resolvePhone(sub);
    if (!phone || !isValidPhoneNumber(phone)) {
      skippedCount += 1;
      continue;
    }
    const ctx = buildTemplateContext(sub);
    const message = renderTemplate(tpl, ctx).trim();
    if (!message) {
      skippedCount += 1;
      continue;
    }
    items.push({
      submission: sub._id,
      phone,
      message,
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
    intervalMs: Math.max(1000, Number(intervalMs) || DEFAULT_INTERVAL_MS),
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
  return {
    _id: j._id,
    form: j.form,
    status: j.status,
    template: j.template,
    intervalMs: j.intervalMs,
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

  if (!job) return { didWork: false, intervalMs: DEFAULT_INTERVAL_MS };

  if (job.status === 'pending') {
    job.status = 'running';
    job.startedAt = job.startedAt || new Date();
  }

  const item = job.items.find((i) => i.status === 'pending');
  if (!item) {
    job.status = 'completed';
    job.finishedAt = new Date();
    await job.save();
    return { didWork: false, intervalMs: job.intervalMs || DEFAULT_INTERVAL_MS };
  }

  try {
    await sendTextMessage(item.phone, item.message);
    item.status = 'sent';
    item.sentAt = new Date();
    item.error = '';
    job.sentCount = (job.sentCount || 0) + 1;
  } catch (err) {
    item.status = 'failed';
    item.error = err.response?.data?.message || err.message || '發送失敗';
    job.failedCount = (job.failedCount || 0) + 1;
    console.error('❌ 申請表 OpenWA 通知失敗:', item.phone, item.error);
  }

  const stillPending = job.items.some((i) => i.status === 'pending');
  if (!stillPending) {
    job.status = 'completed';
    job.finishedAt = new Date();
  }

  await job.save();
  return {
    didWork: true,
    intervalMs: job.intervalMs || DEFAULT_INTERVAL_MS,
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
    let result = { didWork: false, intervalMs: DEFAULT_INTERVAL_MS };
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
  console.log('📲 申請表 OpenWA 通知佇列已啟動（間隔 2 秒／則）');
}

module.exports = {
  formHasPhoneField,
  renderTemplate,
  createNotifyJob,
  getJob,
  cancelJob,
  serializeJob,
  kickWorker,
  startApplicationNotifyWorker,
  DEFAULT_INTERVAL_MS,
};
