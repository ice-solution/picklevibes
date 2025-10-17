const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.logoBase64 = null;
    this.initializeTransporter();
    this.loadLogo();
  }

  /**
   * 初始化郵件傳輸器
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });
      console.log('✅ 郵件服務初始化成功');
    } catch (error) {
      console.error('❌ 郵件服務初始化失敗:', error.message);
    }
  }

  /**
   * 加載 Logo
   */
  async loadLogo() {
    try {
      const logoPath = path.join(__dirname, '../../uploads/static/logo192.png');
      const logoBuffer = await fs.readFile(logoPath);
      this.logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      console.log('✅ Logo 加載成功');
    } catch (error) {
      console.error('❌ Logo 加載失敗:', error.message);
      this.logoBase64 = null;
    }
  }

  /**
   * 生成開門通知郵件模板
   */
  async generateAccessEmailTemplate(visitorData, bookingData, qrCodeData = null, password = null) {
    const { name, email, phone } = visitorData;
    const { date, startTime, endTime, courtName, bookingId } = bookingData;
    
    const bookingDate = new Date(date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return {
      subject: `🏓 PickleVibes 場地預約確認 - ${courtName}`,
      html: `
        <!DOCTYPE html>
        <html lang="zh-TW">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>場地預約確認</title>
          <style>
            body {
              font-family: 'Microsoft JhengHei', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #4CAF50;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 28px;
              font-weight: bold;
              color: #4CAF50;
              margin-bottom: 10px;
            }
            .booking-info {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin: 10px 0;
              padding: 8px 0;
              border-bottom: 1px solid #eee;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            .info-value {
              color: #333;
            }
            .access-instructions {
              background-color: #e3f2fd;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #2196F3;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .highlight {
              background-color: #fff3cd;
              padding: 15px;
              border-radius: 5px;
              border-left: 4px solid #ffc107;
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes Logo" style="max-width: 100px; height: auto; display: block; margin: 0 auto 20px;">` : '<div class="logo">🏓 PickleVibes</div>'}
              <h2>場地預約確認通知</h2>
            </div>

            <p>親愛的 <strong>${name}</strong>，</p>
            
            <p>您的場地預約已成功確認！以下是您的預約詳情：</p>

            <div class="booking-info">
              <h3>📅 預約詳情</h3>
              <div class="info-row">
                <span class="info-label">預約編號：</span>
                <span class="info-value">${bookingId}</span>
              </div>
              <div class="info-row">
                <span class="info-label">場地名稱：</span>
                <span class="info-value">${courtName}</span>
              </div>
              <div class="info-row">
                <span class="info-label">預約日期：</span>
                <span class="info-value">${bookingDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">使用時間：</span>
                <span class="info-value">${startTime} - ${endTime}</span>
              </div>
              <div class="info-row">
                <span class="info-label">聯絡電話：</span>
                <span class="info-value">${phone}</span>
              </div>
            </div>

            <div class="access-instructions">
              <h3>🚪 進場指引</h3>
              <p>您的訪客記錄已成功創建，請按照以下步驟進場：</p>
              <ol>
                <li>請在預約時間前 10 分鐘到達場地</li>
                <li>系統將自動為您開啟門禁</li>
                <li>如有任何問題，請聯繫場地管理員</li>
              </ol>
              
              ${qrCodeData ? `
              <div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h4 style="color: #333; margin: 0 0 15px 0;">📱 開門二維碼</h4>
                <p style="color: #666; font-size: 14px; margin: 0 0 15px 0;">請使用以下二維碼進行開門：</p>
                <img src="cid:qrcode" alt="開門二維碼" style="max-width: 200px; height: auto; border: 2px solid #ddd; border-radius: 8px; display: block; margin: 0 auto;" />
                <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">請在門禁設備前掃描此二維碼</p>
              </div>
              ` : ''}
              
              ${password ? `
              <div style="text-align: center; margin: 20px 0; padding: 20px; background-color: #e8f5e8; border: 2px solid #4CAF50;">
                <h4 style="color: #2e7d32; margin: 0 0 15px 0;">🔑 開門密碼</h4>
                <p style="color: #666; font-size: 14px; margin: 0 0 15px 0;">如果二維碼無法使用，您也可以使用以下密碼：</p>
                <div style="background-color: #fff; padding: 15px; border: 2px dashed #4CAF50; margin: 10px 0;">
                  <span style="font-size: 24px; font-weight: bold; color: #2e7d32; font-family: monospace; letter-spacing: 2px;">${password}</span>
                </div>
                <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">請在門禁設備上輸入此密碼</p>
              </div>
              ` : ''}
            </div>

            <div class="highlight">
              <strong>⚠️ 重要提醒：</strong>
              <ul>
                <li>請保持場地整潔，使用完畢後請清理現場</li>
                <li>如需取消或修改預約，請提前 24 小時聯繫我們</li>
              </ul>
            </div>

            <p>感謝您選擇 PickleVibes，祝您運動愉快！</p>

            <div class="footer">
              <p>此郵件由系統自動發送，請勿回覆</p>
              <p>如有疑問，請聯繫客服：<a href="mailto:info@picklevibes.hk">info@picklevibes.hk</a></p>
              <p>© 2025 PickleVibes. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        PickleVibes 場地預約確認
        
        親愛的 ${name}，
        
        您的場地預約已成功確認！
        
        預約詳情：
        - 預約編號：${bookingId}
        - 場地名稱：${courtName}
        - 預約日期：${bookingDate}
        - 使用時間：${startTime} - ${endTime}
        - 聯絡電話：${phone}
        
        進場指引：
        1. 請在預約時間前 10 分鐘到達場地
        2. 系統將自動為您開啟門禁
        3. 如有任何問題，請聯繫場地管理員 6190 2761
        
        ${password ? `
        開門方式：
        - 二維碼：請查看郵件中的二維碼圖片
        - 密碼：${password}（如果二維碼無法使用）
        ` : ''}
        
        重要提醒：
        - 請準時到達，遲到超過 15 分鐘將視為取消預約
        - 請保持場地整潔，使用完畢後請清理現場
        - 如需取消或修改預約，請提前 24 小時聯繫我們
        
        感謝您選擇 PickleVibes，祝您運動愉快！
        
        此郵件由系統自動發送，請勿回覆
        info@picklevibes.hk
        © 2025 PickleVibes. All rights reserved.
      `
    };
  }

  /**
   * 發送開門通知郵件
   */
  async sendAccessEmail(visitorData, bookingData, qrCodeData = null, password = null) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      const emailTemplate = await this.generateAccessEmailTemplate(visitorData, bookingData, qrCodeData, password);
      
      // 準備附件
      const attachments = [];
      
      // 添加 Logo 作為附件
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo' // Content ID for referencing in HTML
        });
      }
      
      // 添加二維碼作為附件
      if (qrCodeData) {
        attachments.push({
          filename: 'qrcode.png',
          content: qrCodeData,
          encoding: 'base64',
          cid: 'qrcode' // Content ID for referencing in HTML
        });
      }
      
      const mailOptions = {
        from: `"PickleVibes" <${process.env.GMAIL_USER}>`,
        to: visitorData.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        attachments: attachments
      };

      console.log('📧 正在發送開門通知郵件...', {
        to: visitorData.email,
        subject: emailTemplate.subject,
        attachments: attachments.length,
        hasQRCode: !!qrCodeData,
        hasPassword: !!password
      });

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ 開門通知郵件發送成功:', result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        message: '開門通知郵件發送成功'
      };
    } catch (error) {
      console.error('❌ 發送開門通知郵件失敗:', error.message);
      throw new Error(`發送開門通知郵件失敗: ${error.message}`);
    }
  }

  /**
   * 生成歡迎郵件模板
   */
  async generateWelcomeEmailTemplate(userData) {
    const { name, email, password, role, membershipLevel, membershipExpiry } = userData;
    
    // 格式化會員等級顯示
    const membershipDisplay = membershipLevel === 'vip' ? 'VIP會員' : '普通會員';
    const membershipInfo = membershipLevel === 'vip' && membershipExpiry 
      ? `，有效期至 ${new Date(membershipExpiry).toLocaleDateString('zh-TW')}`
      : '';

    const subject = `🎉 歡迎加入 PickleVibes！您的帳戶已創建成功`;

    const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>歡迎加入 PickleVibes</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background-color: white;
                border-radius: 12px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 20px;
            }
            .logo-text {
                color: white;
                font-size: 32px;
                font-weight: bold;
            }
            .title {
                color: #2d3748;
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .subtitle {
                color: #718096;
                font-size: 16px;
            }
            .content {
                margin-bottom: 30px;
            }
            .welcome-text {
                font-size: 18px;
                color: #2d3748;
                margin-bottom: 20px;
            }
            .account-info {
                background-color: #f7fafc;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #667eea;
            }
            .info-item {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
            }
            .info-label {
                font-weight: bold;
                color: #4a5568;
                min-width: 100px;
            }
            .info-value {
                color: #2d3748;
                font-family: monospace;
                background-color: #e2e8f0;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 14px;
            }
            .login-section {
                background-color: #e6fffa;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #38b2ac;
            }
            .login-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: bold;
                margin: 10px 0;
                transition: transform 0.2s;
            }
            .login-button:hover {
                transform: translateY(-2px);
            }
            .security-note {
                background-color: #fff5f5;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                border-left: 4px solid #f56565;
            }
            .security-note h4 {
                color: #c53030;
                margin: 0 0 10px 0;
            }
            .security-note p {
                color: #742a2a;
                margin: 0;
                font-size: 14px;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
                color: #718096;
                font-size: 14px;
            }
            .features {
                margin: 20px 0;
            }
            .feature-item {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
                color: #4a5568;
            }
            .feature-icon {
                color: #48bb78;
                margin-right: 10px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">
                    <span class="logo-text">P</span>
                </div>
                <h1 class="title">歡迎加入 PickleVibes！</h1>
                <p class="subtitle">您的帳戶已成功創建</p>
            </div>

            <div class="content">
                <p class="welcome-text">
                    親愛的 <strong>${name}</strong>，<br>
                    歡迎加入 PickleVibes 大家庭！我們很高興為您提供優質的場地預約服務。
                </p>

                <div class="account-info">
                    <h3 style="margin-top: 0; color: #2d3748;">您的帳戶信息</h3>
                    <div class="info-item">
                        <span class="info-label">姓名：</span>
                        <span class="info-value">${name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">郵箱：</span>
                        <span class="info-value">${email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">角色：</span>
                        <span class="info-value">${role === 'admin' ? '管理員' : role === 'coach' ? '教練' : '普通用戶'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">會員等級：</span>
                        <span class="info-value">${membershipDisplay}${membershipInfo}</span>
                    </div>
                </div>

                <div class="login-section">
                    <h3 style="margin-top: 0; color: #2d3748;">立即開始使用</h3>
                    <p>您可以使用以下信息登入您的帳戶：</p>
                    <div class="info-item">
                        <span class="info-label">登入網址：</span>
                        <span class="info-value">${process.env.CLIENT_URL || 'https://picklevibes.hk'}/login</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">郵箱：</span>
                        <span class="info-value">${email}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">密碼：</span>
                        <span class="info-value">${password}</span>
                    </div>
                    <br>
                    <a href="${process.env.CLIENT_URL || 'https://picklevibes.hk'}/login" class="login-button">
                        🚀 立即登入
                    </a>
                </div>

                <div class="features">
                    <h3 style="color: #2d3748;">您可以使用以下功能：</h3>
                    <div class="feature-item">
                        <span class="feature-icon">🏟️</span>
                        <span>預約場地</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📅</span>
                        <span>管理預約</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">💳</span>
                        <span>在線支付</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">📱</span>
                        <span>WhatsApp 通知</span>
                    </div>
                    ${membershipLevel === 'vip' ? `
                    <div class="feature-item">
                        <span class="feature-icon">⭐</span>
                        <span>VIP 專享優惠</span>
                    </div>
                    ` : ''}
                </div>

                <div class="security-note">
                    <h4>🔒 安全提醒</h4>
                    <p>
                        為了您的帳戶安全，建議您首次登入後立即修改密碼。
                        請妥善保管您的登入信息，不要與他人分享。
                    </p>
                </div>
            </div>

            <div class="footer">
                <p>
                    如有任何問題，請聯繫我們的客服團隊。<br>
                    <strong>PickleVibes</strong> - 讓運動更精彩！
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
                    此郵件由系統自動發送，請勿回覆。
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
歡迎加入 PickleVibes！

親愛的 ${name}，

歡迎加入 PickleVibes 大家庭！我們很高興為您提供優質的場地預約服務。

您的帳戶信息：
- 姓名：${name}
- 郵箱：${email}
- 角色：${role === 'admin' ? '管理員' : role === 'coach' ? '教練' : '普通用戶'}
- 會員等級：${membershipDisplay}${membershipInfo}

登入信息：
- 登入網址：${process.env.CLIENT_URL || 'https://picklevibes.hk'}/login
- 郵箱：${email}
- 密碼：${password}

功能特色：
- 🏟️ 預約場地
- 📅 管理預約
- 💳 充值支援(積分)
${membershipLevel === 'vip' ? '- ⭐ VIP 專享優惠' : ''}

安全提醒：
為了您的帳戶安全，建議您首次登入後立即修改密碼。
請妥善保管您的登入信息，不要與他人分享。

如有任何問題，請聯繫我們的客服團隊。
PickleVibes - 讓匹克球24小時隨時預約！

此郵件由系統自動發送，請勿回覆。
    `;

    return {
      subject,
      html,
      text
    };
  }

  /**
   * 發送歡迎郵件
   */
  async sendWelcomeEmail(userData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      const emailTemplate = await this.generateWelcomeEmailTemplate(userData);
      
      // 準備附件
      const attachments = [];
      
      // 添加 Logo 作為附件
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo' // Content ID for referencing in HTML
        });
      }
      
      const mailOptions = {
        from: `"PickleVibes" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        attachments: attachments
      };

      console.log('📧 正在發送歡迎郵件...', {
        to: userData.email,
        subject: emailTemplate.subject,
        attachments: attachments.length
      });

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ 歡迎郵件發送成功:', result.messageId);
      return {
        success: true,
        messageId: result.messageId,
        message: '歡迎郵件發送成功'
      };
    } catch (error) {
      console.error('❌ 發送歡迎郵件失敗:', error.message);
      throw new Error(`發送歡迎郵件失敗: ${error.message}`);
    }
  }
}

module.exports = new EmailService();

