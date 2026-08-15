const pug = require('pug');
const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { pathToFileURL } = require('url');

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

const CJK_FONT_FILE = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTC-Variable.ttf');

class PDFService {
  constructor() {
    this.invoiceTemplatePath = path.join(__dirname, '..', 'templates', 'invoice.pug');
    this.bookingTemplatePath = path.join(__dirname, '..', 'templates', 'booking-confirmation.pug');
    this.logoSrc = null;
    this.cjkFontReady = null; // Promise<boolean>
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

  async hasCjkFontFile() {
    if (this.cjkFontReady !== null) return this.cjkFontReady;
    this.cjkFontReady = fs
      .access(CJK_FONT_FILE)
      .then(() => true)
      .catch(() => false);
    return this.cjkFontReady;
  }

  /**
   * 用相對路徑引用字型（寫入 tmp 目錄後 page.goto file://），
   * 避免把 11MB font base64 塞進 HTML 導致 navigation timeout。
   */
  buildCjkFontCss(fontUrl) {
    if (fontUrl) {
      return `
@font-face {
  font-family: 'PickleVibes CJK';
  src: url('${fontUrl}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
:root {
  --display: 'PickleVibes CJK', 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif !important;
  --body: 'PickleVibes CJK', 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif !important;
  --mono: 'PickleVibes CJK', 'Noto Sans TC', ui-monospace, monospace !important;
}
html, body, .sheet, button, input, textarea, select {
  font-family: 'PickleVibes CJK', 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif !important;
}
`;
    }
    return `
:root {
  --display: 'Noto Sans TC', 'Noto Sans CJK TC', 'WenQuanYi Zen Hei', 'PingFang TC', sans-serif !important;
  --body: 'Noto Sans TC', 'Noto Sans CJK TC', 'WenQuanYi Zen Hei', 'PingFang TC', sans-serif !important;
  --mono: 'Noto Sans TC', 'Noto Sans CJK TC', ui-monospace, monospace !important;
}
html, body, .sheet {
  font-family: 'Noto Sans TC', 'Noto Sans CJK TC', 'WenQuanYi Zen Hei', 'PingFang TC', sans-serif !important;
}
`;
  }

  injectCjkFont(html, fontCss) {
    const tag = `<style data-pdf-cjk="1">${fontCss}</style>`;
    if (/<\/head>/i.test(html)) {
      return html.replace(/<\/head>/i, `${tag}</head>`);
    }
    return `${tag}${html}`;
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
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pv-pdf-'));
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
        '--allow-file-access-from-files',
      ],
    });

    try {
      let fontUrl = '';
      if (await this.hasCjkFontFile()) {
        const tmpFont = path.join(tmpDir, 'NotoSansTC-Variable.ttf');
        await fs.copyFile(CJK_FONT_FILE, tmpFont);
        fontUrl = './NotoSansTC-Variable.ttf';
      } else {
        console.warn('⚠️ 找不到 PDF 中文字型:', CJK_FONT_FILE);
      }

      const htmlWithFont = this.injectCjkFont(html, this.buildCjkFontCss(fontUrl));
      const htmlPath = path.join(tmpDir, 'doc.html');
      await fs.writeFile(htmlPath, htmlWithFont, 'utf8');

      const page = await browser.newPage();
      page.setDefaultNavigationTimeout(60000);
      // file:// + load：比 setContent(networkidle0)+11MB base64 快很多，避免 UAT 30s timeout
      await page.goto(pathToFileURL(htmlPath).href, {
        waitUntil: 'load',
        timeout: 60000,
      });
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close().catch(() => {});
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
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
