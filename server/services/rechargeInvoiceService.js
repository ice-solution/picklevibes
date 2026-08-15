const Recharge = require('../models/Recharge');
const User = require('../models/User');
const pdfService = require('../services/pdfService');

/**
 * 依充值記錄即時產生發票 PDF（不落地存檔）
 * @returns {{ buffer: Buffer, invoiceNumber: string, filename: string }}
 */
async function generateRechargeInvoicePdf(rechargeId) {
  const recharge = await Recharge.findById(rechargeId);
  if (!recharge) {
    const err = new Error('找不到充值記錄');
    err.status = 404;
    throw err;
  }
  if (recharge.status !== 'completed') {
    const err = new Error('僅已完成的充值可開立發票');
    err.status = 400;
    throw err;
  }

  const user = await User.findById(recharge.user);
  if (!user) {
    const err = new Error('找不到用戶');
    err.status = 404;
    throw err;
  }

  const payload = pdfService.buildRechargeInvoicePayload(user, recharge);
  const buffer = await pdfService.generateInvoicePDF(
    payload.userData,
    payload.invoiceData,
    payload.paymentData
  );

  const invoiceNumber = payload.invoiceData.invoiceNumber;
  return {
    buffer,
    invoiceNumber,
    filename: `發票_${invoiceNumber}.pdf`,
    recharge,
    user,
  };
}

module.exports = {
  generateRechargeInvoicePdf,
};
