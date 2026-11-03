const path = require('path');
const fs = require('fs').promises;
const CoachClass = require('../models/CoachClass');
const CoachPayout = require('../models/CoachPayout');
const User = require('../models/User');
const {
  coachClassLocationLabel,
  sessionHours,
} = require('./coachScheduleService');
const { markClassPaid, totalPay } = require('./coachClassWriteService');
const { hkYmdToBookingUtcMidnight, getHKCalendarYMD } = require('../utils/bookingDateTime');
const pdfService = require('./pdfService');

function parseYmdOrNull(raw) {
  const s = String(raw || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function applySessionDateRange(q, dateFrom, dateTo) {
  const from = parseYmdOrNull(dateFrom);
  const to = parseYmdOrNull(dateTo);
  if (!from && !to) return q;
  q.sessionDate = q.sessionDate || {};
  if (from) q.sessionDate.$gte = hkYmdToBookingUtcMidnight(from);
  if (to) q.sessionDate.$lte = hkYmdToBookingUtcMidnight(to);
  return q;
}

function sessionDateYmd(sessionDate) {
  if (!sessionDate) return '';
  return getHKCalendarYMD(sessionDate instanceof Date ? sessionDate : new Date(sessionDate));
}

function coachPaymentFor(coachClass, coachId) {
  const id = String(coachId);
  return (coachClass.coachPayments || []).find((p) => String(p.coach) === id) || null;
}

function isMultiCoach(coachClass) {
  const ids = new Set(
    [
      ...(coachClass.coaches || []).map((c) => String(c._id || c)),
      coachClass.coach ? String(coachClass.coach._id || coachClass.coach) : null,
    ].filter(Boolean)
  );
  return ids.size > 1 || (coachClass.coachPayments || []).length > 1;
}

function buildLine(coachClass, coachId) {
  const pay = coachPaymentFor(coachClass, coachId);
  if (!pay) return null;
  const hours = sessionHours(coachClass.startTime, coachClass.endTime);
  return {
    coachClass: coachClass._id,
    title: coachClass.title || '教練課堂',
    sessionDate: coachClass.sessionDate,
    startTime: coachClass.startTime || '',
    endTime: coachClass.endTime || '',
    locationLabel: coachClassLocationLabel(coachClass),
    hours,
    hourlyRate: Number(pay.hourlyRate) || 0,
    amount: Number(pay.amount) || 0,
    multiCoach: isMultiCoach(coachClass),
  };
}

async function loadUnpaidClassesForRange({ dateFrom, dateTo, store, coachId } = {}) {
  const q = {
    status: 'scheduled',
    paymentStatus: 'unpaid',
  };
  applySessionDateRange(q, dateFrom, dateTo);
  if (store) q.store = store;
  if (coachId) {
    q.$or = [{ coaches: coachId }, { coach: coachId }, { 'coachPayments.coach': coachId }];
  }

  return CoachClass.find(q)
    .populate('coaches', 'name email phone coachHourlyRate coachPaymentInfo')
    .populate('coach', 'name email phone')
    .populate({
      path: 'courts',
      select: 'name number type store',
      populate: { path: 'store', select: 'name slug' },
    })
    .populate({
      path: 'court',
      select: 'name number type store',
      populate: { path: 'store', select: 'name slug' },
    })
    .populate('store', 'name slug')
    .populate('activity', 'title')
    .populate('regularActivity', 'title')
    .sort({ sessionDate: 1, startTime: 1 })
    .limit(2000)
    .lean();
}

/**
 * 按教練聚合未付課堂
 */
async function buildUnpaidSummary({ dateFrom, dateTo, store } = {}) {
  const classes = await loadUnpaidClassesForRange({ dateFrom, dateTo, store });
  const byCoach = new Map();

  for (const cc of classes) {
    const payments = Array.isArray(cc.coachPayments) ? cc.coachPayments : [];
    for (const pay of payments) {
      const coachId = String(pay.coach?._id || pay.coach || '');
      if (!coachId) continue;
      const coachDoc =
        (cc.coaches || []).find((c) => String(c._id) === coachId) ||
        (cc.coach && String(cc.coach._id || cc.coach) === coachId ? cc.coach : null);

      if (!byCoach.has(coachId)) {
        byCoach.set(coachId, {
          coachId,
          name: coachDoc?.name || '教練',
          email: coachDoc?.email || '',
          phone: coachDoc?.phone || '',
          coachPaymentInfo: coachDoc?.coachPaymentInfo || '',
          classCount: 0,
          totalHours: 0,
          totalAmount: 0,
          multiCoachClassCount: 0,
          classIds: [],
          lines: [],
        });
      }
      const row = byCoach.get(coachId);
      const line = buildLine(cc, coachId);
      if (!line) continue;
      row.classCount += 1;
      row.totalHours += line.hours;
      row.totalAmount += line.amount;
      if (line.multiCoach) row.multiCoachClassCount += 1;
      row.classIds.push(String(cc._id));
      row.lines.push({
        ...line,
        coachClassId: String(cc._id),
        sessionDateYmd: sessionDateYmd(cc.sessionDate),
        storeName: cc.store?.name || '',
      });
    }
  }

  const coaches = [...byCoach.values()]
    .map((c) => ({
      ...c,
      totalHours: Math.round(c.totalHours * 100) / 100,
      totalAmount: Math.round(c.totalAmount * 100) / 100,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount || a.name.localeCompare(b.name, 'zh-HK'));

  return {
    dateFrom: parseYmdOrNull(dateFrom) || '',
    dateTo: parseYmdOrNull(dateTo) || '',
    coachCount: coaches.length,
    classCount: classes.length,
    totalAmount: coaches.reduce((s, c) => s + c.totalAmount, 0),
    coaches,
  };
}

function payoutUploadsDir() {
  return path.join(__dirname, '../../uploads/coach-payroll');
}

async function writePayoutPdf(payoutId, buffer) {
  const dir = payoutUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const filename = `payout-${payoutId}.pdf`;
  const abs = path.join(dir, filename);
  await fs.writeFile(abs, buffer);
  return `coach-payroll/${filename}`;
}

async function generateAndStorePdf(payout, coach) {
  const buffer = await pdfService.generateCoachPayrollPDF({
    payout,
    coach,
  });
  const pdfPath = await writePayoutPdf(payout._id, buffer);
  payout.pdfPath = pdfPath;
  await payout.save();
  return pdfPath;
}

/**
 * 結算指定教練未付課堂 → mark-paid（整堂）→ PDF
 */
async function settleCoachPayroll({
  coachId,
  dateFrom,
  dateTo,
  store,
  classIds,
  adminUserId,
}) {
  if (!coachId) {
    const err = new Error('請指定教練');
    err.status = 400;
    throw err;
  }

  const coach = await User.findById(coachId).select(
    'name email phone coachHourlyRate coachPaymentInfo role'
  );
  if (!coach) {
    const err = new Error('教練不存在');
    err.status = 404;
    throw err;
  }

  let classes = await loadUnpaidClassesForRange({ dateFrom, dateTo, store, coachId });
  if (Array.isArray(classIds) && classIds.length > 0) {
    const allow = new Set(classIds.map((id) => String(id)));
    classes = classes.filter((c) => allow.has(String(c._id)));
  }

  if (classes.length === 0) {
    const err = new Error('沒有可結算的未付課堂');
    err.status = 400;
    throw err;
  }

  const lines = [];
  const succeeded = [];
  const failed = [];
  let multiCoachClassCount = 0;

  for (const lean of classes) {
    const line = buildLine(lean, coachId);
    if (!line) {
      failed.push({ id: String(lean._id), reason: '此堂無該教練薪資列' });
      continue;
    }
    if (line.multiCoach) multiCoachClassCount += 1;

    try {
      // eslint-disable-next-line no-await-in-loop
      const coachClass = await CoachClass.findById(lean._id);
      if (!coachClass) {
        failed.push({ id: String(lean._id), reason: '課堂不存在' });
        continue;
      }
      if (coachClass.paymentStatus === 'paid') {
        failed.push({ id: String(lean._id), reason: '已付款' });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await markClassPaid(coachClass, adminUserId);
      succeeded.push({
        id: String(lean._id),
        title: result.coachClass.title,
        totalPay: totalPay(result.coachClass.coachPayments),
        coachAmount: line.amount,
      });
      lines.push(line);
    } catch (error) {
      failed.push({ id: String(lean._id), reason: error.message || '標記失敗' });
    }
  }

  if (lines.length === 0) {
    const err = new Error(
      failed[0]?.reason ? `結算失敗：${failed[0].reason}` : '沒有成功結算的課堂'
    );
    err.status = 400;
    err.failed = failed;
    throw err;
  }

  const totalAmount = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const totalHours = lines.reduce((s, l) => s + (Number(l.hours) || 0), 0);

  const payout = await CoachPayout.create({
    coach: coachId,
    dateFrom: parseYmdOrNull(dateFrom) || sessionDateYmd(lines[0].sessionDate) || '',
    dateTo:
      parseYmdOrNull(dateTo) || sessionDateYmd(lines[lines.length - 1].sessionDate) || '',
    store: store || null,
    classCount: lines.length,
    totalHours: Math.round(totalHours * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
    lines,
    classIds: lines.map((l) => l.coachClass),
    multiCoachClassCount,
    settledBy: adminUserId,
    settledAt: new Date(),
  });

  let pdfPath = '';
  try {
    pdfPath = await generateAndStorePdf(payout, coach);
  } catch (pdfErr) {
    console.error('教練薪資 PDF 生成失敗（結算已完成）:', pdfErr.message);
  }

  return {
    payout: await CoachPayout.findById(payout._id)
      .populate('coach', 'name email phone coachPaymentInfo')
      .populate('settledBy', 'name email')
      .lean(),
    pdfPath,
    pdfUrl: pdfPath ? `/uploads/${pdfPath}` : '',
    succeeded,
    failed,
    multiCoachClassCount,
  };
}

async function listPayouts({ limit = 50 } = {}) {
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return CoachPayout.find()
    .populate('coach', 'name email phone coachPaymentInfo')
    .populate('settledBy', 'name email')
    .sort({ settledAt: -1 })
    .limit(n)
    .lean();
}

async function getPayoutPdfBuffer(payoutId) {
  const payout = await CoachPayout.findById(payoutId).populate(
    'coach',
    'name email phone coachPaymentInfo'
  );
  if (!payout) {
    const err = new Error('結算紀錄不存在');
    err.status = 404;
    throw err;
  }

  if (payout.pdfPath) {
    const abs = path.join(__dirname, '../../uploads', payout.pdfPath);
    try {
      return await fs.readFile(abs);
    } catch {
      // regenerate below
    }
  }

  await generateAndStorePdf(payout, payout.coach);
  const abs = path.join(__dirname, '../../uploads', payout.pdfPath);
  return fs.readFile(abs);
}

module.exports = {
  parseYmdOrNull,
  applySessionDateRange,
  buildUnpaidSummary,
  settleCoachPayroll,
  listPayouts,
  getPayoutPdfBuffer,
};
