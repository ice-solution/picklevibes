const express = require('express');
const Booking = require('../models/Booking');
const pdfService = require('../services/pdfService');
const { verifyToken } = require('../utils/invoiceLink');
const { generateRechargeInvoicePdf } = require('../services/rechargeInvoiceService');

const router = express.Router();

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=60');
  return res.send(buffer);
}

/**
 * GET /api/invoices/recharge/:id.pdf?token=...
 * 郵件內簽名連結（無需登入）
 */
router.get('/recharge/:id.pdf', async (req, res) => {
  try {
    const id = String(req.params.id || '').replace(/\.pdf$/i, '');
    const verified = verifyToken(req.query.token);
    if (!verified.ok) {
      return res.status(403).json({ message: '發票連結無效或已過期' });
    }
    const { payload } = verified;
    if (payload.typ !== 'recharge' || String(payload.id) !== id) {
      return res.status(403).json({ message: '發票連結與記錄不符' });
    }

    const { buffer, filename } = await generateRechargeInvoicePdf(id);
    return sendPdf(res, buffer, filename);
  } catch (err) {
    console.error('❌ 充值發票下載失敗:', err);
    return res.status(err.status || 500).json({ message: err.message || '無法產生發票' });
  }
});

/**
 * GET /api/invoices/booking/:id.pdf?token=...
 */
router.get('/booking/:id.pdf', async (req, res) => {
  try {
    const id = String(req.params.id || '').replace(/\.pdf$/i, '');
    const verified = verifyToken(req.query.token);
    if (!verified.ok) {
      return res.status(403).json({ message: '發票連結無效或已過期' });
    }
    const { payload } = verified;
    if (payload.typ !== 'booking' || String(payload.id) !== id) {
      return res.status(403).json({ message: '發票連結與記錄不符' });
    }

    const booking = await Booking.findById(id).populate('court').populate('store');
    if (!booking) {
      return res.status(404).json({ message: '找不到預約發票' });
    }

    const visitor = booking.players?.[0] || {};
    const payloadPdf = pdfService.buildBookingInvoicePayload(
      booking,
      visitor,
      booking.court,
      booking.store
    );
    const pdfBuffer = await pdfService.generateInvoicePDF(
      payloadPdf.userData,
      payloadPdf.invoiceData,
      payloadPdf.paymentData
    );

    return sendPdf(res, pdfBuffer, `發票_${payloadPdf.invoiceData.invoiceNumber}.pdf`);
  } catch (err) {
    console.error('❌ 預約發票下載失敗:', err);
    return res.status(500).json({ message: '無法產生發票' });
  }
});

module.exports = router;
