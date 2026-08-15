const pug = require('pug');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const PAYMENT_METHOD_LABELS = {
  stripe: '信用卡 / Stripe',
  alipay: '支付寶',
  wechat: '微信支付',
  wonder: 'Wonder',
  points: '積分',
  cash: '現金',
  bank_transfer: '銀行轉帳',
  admin_waived: '管理員免扣款',
  manual: '手動',
};

class PDFService {
  constructor() {
    this.invoiceTemplatePath = path.join(__dirname, '..', 'templates', 'invoice.pug');
    this.bookingTemplatePath = path.join(__dirname, '..', 'templates', 'booking-confirmation.pug');
    this.logoSrc = null;
  }

  async ensureLogoSrc() {
    if (this.logoSrc !== null) return this.logoSrc;
    try {
      const logoPath = path.join(__dirname, '../../uploads/static/logo192.png');
      const buf = await fs.readFile(logoPath);
      this.logoSrc = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      this.logoSrc = '';
    }
    return this.logoSrc;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('zh-HK', {
      style: 'currency',
      currency: 'HKD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  }

  formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date || '');
    return d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
  }

  formatDateOnly(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return String(date || '');
    return d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  paymentMethodLabel(method) {
    if (!method) return '—';
    return PAYMENT_METHOD_LABELS[method] || String(method);
  }

  async renderPdfFromHtml(html) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
      });
      // Puppeteer 回傳 Uint8Array；Express res.send(物件) 會 JSON 序列化，必須轉 Buffer
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * 發票 PDF（充值／通用）
   */
  async generateInvoicePDF(userData, invoiceData, paymentData) {
    try {
      console.log('📄 開始生成發票 PDF...');
      const logoSrc = await this.ensureLogoSrc();
      const compiled = pug.compileFile(this.invoiceTemplatePath);
      const html = compiled({
        userData: userData || {},
        invoiceData: invoiceData || { items: [], invoiceNumber: 'INV', subtotal: 0, total: 0 },
        paymentData: paymentData || null,
        paymentMethodLabel: this.paymentMethodLabel(paymentData?.method),
        issueDate: this.formatDateOnly(new Date()),
        dueDate: null,
        logoSrc,
        formatCurrency: this.formatCurrency.bind(this),
        formatDate: this.formatDate.bind(this),
      });
      const pdfBuffer = await this.renderPdfFromHtml(html);
      console.log('✅ 發票 PDF 生成成功');
      return pdfBuffer;
    } catch (error) {
      console.error('❌ 生成發票 PDF 失敗:', error.message);
      throw error;
    }
  }

  async generateInvoiceHTML(userData, invoiceData, paymentData) {
    const logoSrc = await this.ensureLogoSrc();
    const compiled = pug.compileFile(this.invoiceTemplatePath);
    return compiled({
      userData: userData || {},
      invoiceData: invoiceData || { items: [], invoiceNumber: 'INV', subtotal: 0, total: 0 },
      paymentData: paymentData || null,
      paymentMethodLabel: this.paymentMethodLabel(paymentData?.method),
      issueDate: this.formatDateOnly(new Date()),
      dueDate: null,
      logoSrc,
      formatCurrency: this.formatCurrency.bind(this),
      formatDate: this.formatDate.bind(this),
    });
  }

  /**
   * 預約完成／確認 PDF
   */
  async generateBookingConfirmationPDF(visitorData, bookingData) {
    try {
      console.log('📄 開始生成預約確認 PDF...');
      const logoSrc = await this.ensureLogoSrc();
      const bookingId = String(bookingData?.bookingId || '');
      const shortBookingId = bookingId ? `BK-${bookingId.slice(-8).toUpperCase()}` : 'BK';
      const amount =
        bookingData?.totalPrice != null
          ? Number(bookingData.totalPrice)
          : bookingData?.amount != null
            ? Number(bookingData.amount)
            : null;
      const amountLabel =
        amount != null && Number.isFinite(amount) && amount > 0
          ? this.formatCurrency(amount)
          : bookingData?.amountLabel || null;

      const compiled = pug.compileFile(this.bookingTemplatePath);
      const html = compiled({
        visitorData: visitorData || {},
        bookingData: bookingData || {},
        shortBookingId,
        bookingDateLabel: this.formatDateOnly(bookingData?.date),
        issueDate: this.formatDateOnly(new Date()),
        amountLabel,
        logoSrc,
      });
      const pdfBuffer = await this.renderPdfFromHtml(html);
      console.log('✅ 預約確認 PDF 生成成功');
      return pdfBuffer;
    } catch (error) {
      console.error('❌ 生成預約確認 PDF 失敗:', error.message);
      throw error;
    }
  }

  /**
   * 由 Booking document 組發票 payload（場地預約）
   */
  buildBookingInvoicePayload(booking, visitorData, court, store) {
    const bookingId = String(booking._id);
    const invoiceNumber = `INV-BK-${bookingId.slice(-8).toUpperCase()}`;
    const total =
      Number(booking.pricing?.totalPrice) ||
      Number(booking.payment?.pointsDeducted) ||
      Number(booking.payment?.originalPrice) ||
      0;
    const dateLabel = this.formatDateOnly(booking.date);
    const courtName = court?.name || booking.court?.name || '場地';
    const storeName = store?.name || '';
    const description = storeName ? `${storeName} · ${courtName}` : courtName;
    const details = `${dateLabel} ${booking.startTime || ''}–${booking.endTime || ''}`.trim();

    return {
      userData: {
        name: visitorData?.name || booking.players?.[0]?.name || '',
        email: visitorData?.email || booking.players?.[0]?.email || '',
        phone: visitorData?.phone || booking.players?.[0]?.phone || '',
        address: '',
      },
      invoiceData: {
        invoiceNumber,
        reference: bookingId,
        items: [
          {
            description: `場地租賃 / Court booking`,
            details,
            quantity: 1,
            unitPrice: total,
            total,
          },
        ],
        subtotal: total,
        total,
      },
      paymentData: {
        method: booking.payment?.method || 'points',
        transactionId: booking.payment?.transactionId || bookingId,
        paidAt: booking.payment?.paidAt || booking.createdAt || new Date(),
        amount: total,
      },
    };
  }

  /**
   * 由 Recharge document 組發票 payload
   */
  buildRechargeInvoicePayload(user, recharge) {
    const id = String(recharge._id);
    const invoiceNumber = `INV-${id.slice(-8).toUpperCase()}`;
    const amount = Number(recharge.amount) || 0;
    const points = Number(recharge.points) || amount;

    return {
      userData: {
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: '',
      },
      invoiceData: {
        invoiceNumber,
        reference: id,
        items: [
          {
            description: '帳戶充值 / Account recharge',
            details: `獲得積分 ${points}`,
            quantity: 1,
            unitPrice: amount,
            total: amount,
          },
        ],
        subtotal: amount,
        total: amount,
      },
      paymentData: {
        method: recharge.payment?.method || 'stripe',
        transactionId: recharge.payment?.transactionId || id,
        paidAt: recharge.payment?.paidAt || recharge.updatedAt || new Date(),
        amount,
      },
    };
  }
}

module.exports = new PDFService();
