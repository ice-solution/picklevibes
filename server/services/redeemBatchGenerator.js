const mongoose = require('mongoose');
const RedeemCode = require('../models/RedeemCode');
const RedeemBatchJob = require('../models/RedeemBatchJob');

const REDEEM_CODE_RANDOM_REGEX = /^[A-Z0-9]{6}$/;
const INSERT_CHUNK_SIZE = 250;
const GENERATE_CHUNK_SIZE = 500;
const MAX_GENERATE_ATTEMPTS = 50;

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

function generateIndependentRedeemCode() {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const pickLetter = Math.random() < 0.5;
    code += pickLetter
      ? LETTERS[Math.floor(Math.random() * LETTERS.length)]
      : DIGITS[Math.floor(Math.random() * DIGITS.length)];
  }
  return code;
}

function isValidCandidate(code) {
  if (!REDEEM_CODE_RANDOM_REGEX.test(code)) return false;
  return /[A-Z]/.test(code) && /\d/.test(code);
}

function generateCandidatePool(targetSize, reserved = new Set()) {
  const pool = new Set();
  let attempts = 0;
  const maxAttempts = targetSize * 30;

  while (pool.size < targetSize && attempts < maxAttempts) {
    attempts += 1;
    const code = generateIndependentRedeemCode();
    if (!isValidCandidate(code)) continue;
    if (reserved.has(code) || pool.has(code)) continue;
    pool.add(code);
  }

  if (pool.size < targetSize) {
    throw new Error('無法產生足夠的唯一候選兌換碼');
  }
  return [...pool];
}

async function filterCodesNotInDatabase(codes) {
  if (codes.length === 0) return [];
  const existing = await RedeemCode.find({ code: { $in: codes } })
    .select('code')
    .lean();
  const existingSet = new Set(existing.map((row) => row.code));
  return codes.filter((code) => !existingSet.has(code));
}

function buildRedeemCodeDocuments(codes, batchId, template, createdBy) {
  const validFrom = template.validFrom ? new Date(template.validFrom) : new Date();
  const validUntil = new Date(template.validUntil);

  return codes.map((code) => ({
    code,
    batchId,
    name: template.name,
    description: template.description || '',
    type: template.type,
    value: template.value,
    minAmount: template.minAmount ?? 0,
    maxDiscount: template.maxDiscount ?? null,
    usageLimit: 1,
    userUsageLimit: 1,
    isIndependentCode: true,
    commissionRate: template.commissionRate ?? null,
    validFrom,
    validUntil,
    isActive: template.isActive !== false,
    applicableTypes: template.applicableTypes || ['all'],
    applicablePricingSlots: template.applicablePricingSlots || [],
    restrictedCode: template.restrictedCode || null,
    createdBy,
    totalUsed: 0,
    totalDiscount: 0,
  }));
}

async function collectUniqueCodes(quantity, reserved = new Set()) {
  const unique = [];
  const seen = new Set(reserved);

  let attempts = 0;
  while (unique.length < quantity && attempts < MAX_GENERATE_ATTEMPTS) {
    attempts += 1;
    const need = quantity - unique.length;
    const poolSize = Math.min(
      GENERATE_CHUNK_SIZE,
      Math.max(need * 3, need + 100)
    );
    const candidates = generateCandidatePool(poolSize, seen);
    // eslint-disable-next-line no-await-in-loop
    const available = await filterCodesNotInDatabase(candidates);

    for (const code of available) {
      if (unique.length >= quantity) break;
      if (seen.has(code)) continue;
      seen.add(code);
      unique.push(code);
    }
  }

  if (unique.length < quantity) {
    throw new Error(`僅能產生 ${unique.length}/${quantity} 個唯一兌換碼`);
  }

  return unique;
}

async function insertCodesInChunks(documents, onProgress) {
  let inserted = 0;
  for (let i = 0; i < documents.length; i += INSERT_CHUNK_SIZE) {
    const chunk = documents.slice(i, i + INSERT_CHUNK_SIZE);
    // eslint-disable-next-line no-await-in-loop
    await RedeemCode.insertMany(chunk, { ordered: true });
    inserted += chunk.length;
    if (onProgress) {
      // eslint-disable-next-line no-await-in-loop
      await onProgress(inserted);
    }
  }
  return inserted;
}

function normalizeTemplate(body, createdBy) {
  const commissionRate =
    body.commissionRate === '' || body.commissionRate == null
      ? null
      : Number(body.commissionRate);

  return {
    name: body.name,
    description: body.description || '',
    type: body.type,
    value: Number(body.value),
    minAmount: body.minAmount != null ? Number(body.minAmount) : 0,
    maxDiscount: body.maxDiscount != null && body.maxDiscount !== ''
      ? Number(body.maxDiscount)
      : null,
    commissionRate,
    validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
    validUntil: new Date(body.validUntil),
    isActive: body.isActive !== false,
    applicableTypes: body.applicableTypes || ['all'],
    applicablePricingSlots: body.applicablePricingSlots || [],
    restrictedCode: body.restrictedCode || null,
    createdBy: new mongoose.Types.ObjectId(createdBy),
  };
}

async function runRedeemBatchJob(jobId) {
  const job = await RedeemBatchJob.findById(jobId);
  if (!job) return;
  if (job.status === 'completed') return;

  const alreadyCreated = job.createdCount || 0;
  const remaining = job.quantity - alreadyCreated;
  if (remaining <= 0) {
    await RedeemBatchJob.findByIdAndUpdate(jobId, {
      status: 'completed',
      createdCount: job.quantity,
      completedAt: new Date(),
    });
    return;
  }

  await RedeemBatchJob.findByIdAndUpdate(jobId, {
    status: 'running',
    startedAt: job.startedAt || new Date(),
    errorMessage: null,
  });

  try {
    const template = job.template;
    const existingInBatch = await RedeemCode.find({ batchId: job.batchId })
      .select('code')
      .lean();
    const reserved = new Set(existingInBatch.map((row) => row.code));

    const codes = await collectUniqueCodes(remaining, reserved);
    const documents = buildRedeemCodeDocuments(
      codes,
      job.batchId,
      template,
      template.createdBy
    );

    let progressBase = alreadyCreated;
    await insertCodesInChunks(documents, async (chunkInserted) => {
      progressBase = alreadyCreated + chunkInserted;
      await RedeemBatchJob.findByIdAndUpdate(jobId, { createdCount: progressBase });
    });

    await RedeemBatchJob.findByIdAndUpdate(jobId, {
      status: 'completed',
      createdCount: job.quantity,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error(`兌換碼批次任務失敗 (${jobId}):`, error);
    await RedeemBatchJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      errorMessage: error.message || '未知錯誤',
      completedAt: new Date(),
    });
  }
}

function scheduleRedeemBatchJob(jobId) {
  setImmediate(() => {
    runRedeemBatchJob(jobId).catch((err) => {
      console.error(`背景兌換碼任務未捕獲錯誤 (${jobId}):`, err);
    });
  });
}

async function resumePendingRedeemBatchJobs() {
  const pending = await RedeemBatchJob.find({
    status: { $in: ['pending', 'running'] },
  }).select('_id').lean();

  for (const job of pending) {
    if (job._id) scheduleRedeemBatchJob(job._id);
  }

  if (pending.length > 0) {
    console.log(`已恢復 ${pending.length} 個兌換碼批次背景任務`);
  }
}

module.exports = {
  normalizeTemplate,
  runRedeemBatchJob,
  scheduleRedeemBatchJob,
  resumePendingRedeemBatchJobs,
  SYNC_MAX_QUANTITY: 100,
  BULK_MIN_QUANTITY: 101,
  BULK_MAX_QUANTITY: 10000,
};
