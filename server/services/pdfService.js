const pug = require('pug');
const puppeteer = require('puppeteer');
const path = require('path');
const { getEmailBrand } = require('../utils/emailBrand');

class PDFService {
  constructor() {
    this.templatePath = path.join(__dirname, '..', 'templates', 'invoice.pug');
  }

  /**
   * 生成發票 PDF
   * @param {Object} userData - 用戶數據
   * @param {Object} invoiceData - 發票數據
   * @param {Object} paymentData - 付款數據
   * @returns {Buffer} PDF Buffer
   */
  async generateInvoicePDF(userData, invoiceData, paymentData) {
    try {
      console.log('📄 開始生成發票 PDF...');
      const brand = getEmailBrand();

      // 準備模板數據
      const templateData = {
        userData,
        invoiceData,
        paymentData,
        brand,
        issueDate: this.formatDate(new Date()),
        dueDate: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        formatCurrency: this.formatCurrency,
        formatDate: this.formatDate
      };

      // 編譯 Pug 模板
      const compiledTemplate = pug.compileFile(this.templatePath);
      const html = compiledTemplate(templateData);

      // 啟動 Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // 設置頁面內容
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // 生成 PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      await browser.close();

      console.log('✅ 發票 PDF 生成成功');
      return pdfBuffer;

    } catch (error) {
      console.error('❌ 生成發票 PDF 失敗:', error.message);
      throw error;
    }
  }

  /**
   * 格式化貨幣
   * @param {number} amount - 金額
   * @returns {string} 格式化後的貨幣字符串
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'HKD'
    }).format(amount);
  }

  /**
   * 格式化日期
   * @param {Date} date - 日期
   * @returns {string} 格式化後的日期字符串
   */
  formatDate(date) {
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long'
    });
  }

  /**
   * 生成發票 HTML（用於電郵）
   * @param {Object} userData - 用戶數據
   * @param {Object} invoiceData - 發票數據
   * @param {Object} paymentData - 付款數據
   * @returns {string} HTML 字符串
   */
  async generateInvoiceHTML(userData, invoiceData, paymentData) {
    try {
      // 準備模板數據
      const templateData = {
        userData,
        invoiceData,
        paymentData,
        issueDate: this.formatDate(new Date()),
        dueDate: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        formatCurrency: this.formatCurrency,
        formatDate: this.formatDate
      };

      // 編譯 Pug 模板
      const compiledTemplate = pug.compileFile(this.templatePath);
      const html = compiledTemplate(templateData);

      return html;

    } catch (error) {
      console.error('❌ 生成發票 HTML 失敗:', error.message);
      throw error;
    }
  }
}

module.exports = new PDFService();
