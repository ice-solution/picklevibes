const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const pdfService = require('./pdfService');

class EmailService {
  constructor() {
    this.transporter = null;
    this.logoBase64 = null;
    this.initializeTransporter();
    this.loadLogo();
  }

  /**
   * 確保 Logo 已加載
   */
  async ensureLogoLoaded() {
    if (!this.logoBase64) {
      await this.loadLogo();
    }
    return this.logoBase64;
  }

  /**
   * 格式化貨幣
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'HKD'
    }).format(amount);
  }

  /**
   * 取得伺服器對外可訪問的基底 URL
   */
  getServerBaseUrl() {
    const candidates = [
      process.env.SERVER_PUBLIC_URL,
      process.env.SERVER_URL,
      process.env.API_BASE_URL,
      process.env.REACT_APP_SERVER_URL,
      process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/api$/, '') : null,
      process.env.CLIENT_URL
    ];

    for (const url of candidates) {
      if (url && typeof url === 'string' && url.trim()) {
        return url.replace(/\/$/, '');
      }
    }

    return 'http://localhost:5001';
  }

  /**
   * 建立活動圖片附件 (inline CID)
   */
  async buildActivityImageAttachment(posterPathOrUrl, cid) {
    try {
      if (!posterPathOrUrl) {
        return null;
      }

      if (posterPathOrUrl.startsWith('http')) {
        let filename = 'activity-banner';
        try {
          const url = new URL(posterPathOrUrl);
          filename = path.basename(url.pathname) || filename;
        } catch (error) {
          filename = `activity-banner-${Date.now()}`;
        }

        return {
          filename,
          path: posterPathOrUrl,
          cid
        };
      }

      const normalizedPath = posterPathOrUrl.startsWith('/')
        ? posterPathOrUrl
        : `/${posterPathOrUrl}`;
      const absolutePath = path.join(__dirname, '..', '..', normalizedPath);

      return {
        filename: path.basename(absolutePath) || 'activity-banner',
        path: absolutePath,
        cid
      };
    } catch (error) {
      console.error('❌ 建立活動圖片附件失敗:', error.message);
      return null;
    }
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
   * 生成活動報名確認郵件模板
   */
  async generateActivityRegistrationEmailTemplate(activityData, userData, registrationData, options = {}) {
    // 確保 logo 已加載
    await this.ensureLogoLoaded();
    
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        timeZone: 'Asia/Hong_Kong',
        hour12: false
      });
    };

    const formatTime = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Hong_Kong',
        hour12: false
      });
    };

    const startDate = formatDate(activityData.startDate);
    const endTime = formatTime(activityData.endDate);
    const registrationDeadline = formatDate(activityData.registrationDeadline);

    return `
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>活動報名確認 - PickleVibes</title>
        <style>
          body {
            font-family: 'Microsoft JhengHei', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
          }
          .logo {
            max-width: 120px;
            height: auto;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
          }
          .content {
            padding: 40px 30px;
          }
          .greeting {
            font-size: 18px;
            color: #2c3e50;
            margin-bottom: 30px;
          }
          .activity-banner {
            width: 100%;
            max-width: 500px;
            height: 200px;
            object-fit: cover;
            border-radius: 10px;
            margin: 20px 0;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          }
          .activity-info {
            background-color: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            margin: 25px 0;
            border-left: 4px solid #667eea;
          }
          .activity-title {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 15px;
          }
          .activity-description {
            color: #555;
            margin-bottom: 20px;
            line-height: 1.6;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
          }
          .info-item {
            display: flex;
            align-items: center;
            padding: 10px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          }
          .info-icon {
            width: 20px;
            height: 20px;
            margin-right: 10px;
            color: #667eea;
          }
          .info-label {
            font-weight: bold;
            color: #2c3e50;
            margin-right: 5px;
          }
          .info-value {
            color: #555;
          }
          .registration-details {
            background-color: #e8f5e8;
            border-radius: 10px;
            padding: 20px;
            margin: 25px 0;
            border-left: 4px solid #28a745;
          }
          .footer {
            background-color: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
          }
          .footer p {
            margin: 5px 0;
          }
          .contact-info {
            margin-top: 20px;
            font-size: 14px;
            color: #bdc3c7;
          }
          @media (max-width: 600px) {
            .info-grid {
              grid-template-columns: 1fr;
            }
            .content {
              padding: 20px 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes Logo" class="logo">` : '<div class="logo">🏓 PickleVibes</div>'}
            <h1>活動報名確認</h1>
          </div>
          
          <div class="content">
            <div class="greeting">
              親愛的 ${userData.name}，<br>
              感謝您參加 <strong>${activityData.title}</strong> 的活動！
            </div>
            
            ${activityData.poster && options.activityImageCid ? `
              <img src="cid:${options.activityImageCid}" 
                   alt="活動海報" class="activity-banner">
            ` : ''}
            
            <div class="activity-info">
              <div class="activity-title">${activityData.title}</div>
              <div class="activity-description">${activityData.description}</div>
              
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-icon">📅</span>
                  <span class="info-label">活動日期：</span>
                  <span class="info-value">${startDate}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon">⏰</span>
                  <span class="info-label">結束時間：</span>
                  <span class="info-value">${endTime}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon">📍</span>
                  <span class="info-label">活動地點：</span>
                  <span class="info-value">${activityData.location}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon">💰</span>
                  <span class="info-label">活動費用：</span>
                  <span class="info-value">${activityData.price} 積分/人</span>
                </div>
                <div class="info-item">
                  <span class="info-icon">👥</span>
                  <span class="info-label">報名截止：</span>
                  <span class="info-value">${registrationDeadline}</span>
                </div>
                <div class="info-item">
                  <span class="info-icon">📋</span>
                  <span class="info-label">活動要求：</span>
                  <span class="info-value">${activityData.requirements || '無特殊要求'}</span>
                </div>
              </div>
            </div>
            
            <div class="registration-details">
              <h3 style="margin-top: 0; color: #28a745;">📝 您的報名詳情</h3>
              <p><strong>報名人數：</strong> ${registrationData.participantCount} 人</p>
              <p><strong>總費用：</strong> ${registrationData.totalCost} 積分</p>
              <p><strong>報名時間：</strong> ${new Date(registrationData.createdAt).toLocaleString('zh-TW')}</p>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #856404;">⚠️ 重要提醒</h3>
              <ul style="margin: 10px 0; padding-left: 20px; color: #856404;">
                <li>請準時出席活動，遲到可能影響活動體驗</li>
                <li>如有任何問題，請提前聯繫我們</li>
                <li>活動當天請攜帶有效身份證明</li>
                ${activityData.requirements ? `<li>${activityData.requirements}</li>` : ''}
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; color: #2c3e50; margin: 0;">
                期待與您在活動中見面！🎾
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>PickleVibes 匹克球場</strong></p>
            <p>專業匹克球場地服務</p>
            <div class="contact-info">
              <p>如有任何疑問，請聯繫我們</p>
              <p>電話：+852 6190 2761 | 電郵：info@picklevibes.hk</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
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

  /**
   * 發送充值發票郵件
   * @param {Object} userData - 用戶數據
   * @param {Object} rechargeData - 充值數據
   */
  async sendRechargeInvoiceEmail(userData, rechargeData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      const emailTemplate = await this.generateRechargeInvoiceTemplate(userData, rechargeData);
      
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

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 充值發票郵件發送成功:', result.messageId);
      return result;

    } catch (error) {
      console.error('❌ 發送充值發票郵件失敗:', error);
      throw error;
    }
  }

  /**
   * 生成充值發票郵件模板
   * @param {Object} userData - 用戶數據
   * @param {Object} rechargeData - 充值數據
   */
  async generateRechargeInvoiceTemplate(userData, rechargeData) {
    const invoiceNumber = `INV-${rechargeData._id.toString().slice(-8).toUpperCase()}`;
    const transactionDate = new Date(rechargeData.payment.paidAt).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subject = `PickleVibes 充值發票 - ${invoiceNumber}`;

    const html = `
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>充值發票</title>
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
                background: white;
                border-radius: 10px;
                padding: 30px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #e9ecef;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                max-width: 150px;
                height: auto;
                margin-bottom: 15px;
            }
            .invoice-title {
                color: #2c3e50;
                font-size: 24px;
                font-weight: bold;
                margin: 0;
            }
            .invoice-number {
                color: #7f8c8d;
                font-size: 14px;
                margin-top: 5px;
            }
            .invoice-details {
                background: #f8f9fa;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding: 5px 0;
            }
            .detail-label {
                font-weight: 600;
                color: #495057;
            }
            .detail-value {
                color: #212529;
            }
            .amount-section {
                background: #e8f5e8;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
            }
            .amount-label {
                font-size: 16px;
                color: #28a745;
                margin-bottom: 5px;
            }
            .amount-value {
                font-size: 28px;
                font-weight: bold;
                color: #28a745;
            }
            .points-info {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .points-label {
                font-weight: 600;
                color: #856404;
                margin-bottom: 5px;
            }
            .points-value {
                font-size: 18px;
                color: #856404;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
                color: #6c757d;
                font-size: 14px;
            }
            .thank-you {
                background: #d1ecf1;
                border: 1px solid #bee5eb;
                padding: 15px;
                border-radius: 8px;
                margin: 20px 0;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="cid:logo" alt="PickleVibes Logo" class="logo">
                <h1 class="invoice-title">充值發票</h1>
                <p class="invoice-number">發票編號: ${invoiceNumber}</p>
            </div>

            <div class="invoice-details">
                <div class="detail-row">
                    <span class="detail-label">客戶姓名:</span>
                    <span class="detail-value">${userData.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">客戶郵箱:</span>
                    <span class="detail-value">${userData.email}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">交易時間:</span>
                    <span class="detail-value">${transactionDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">交易ID:</span>
                    <span class="detail-value">${rechargeData.payment.transactionId}</span>
                </div>
            </div>

            <div class="amount-section">
                <div class="amount-label">充值金額</div>
                <div class="amount-value">HK$${rechargeData.amount}</div>
            </div>

            <div class="points-info">
                <div class="points-label">獲得積分</div>
                <div class="points-value">${rechargeData.points} 分</div>
            </div>

            <div class="thank-you">
                <h3 style="color: #0c5460; margin: 0 0 10px 0;">🎉 充值成功！</h3>
                <p style="margin: 0; color: #0c5460;">感謝您的充值，積分已成功添加到您的帳戶中。</p>
            </div>

            <div class="footer">
                <p>此發票由 PickleVibes 系統自動生成</p>
                <p>如有疑問，請聯繫客服</p>
                <p>© 2024 PickleVibes. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
PickleVibes 充值發票

發票編號: ${invoiceNumber}

客戶信息:
- 姓名: ${userData.name}
- 郵箱: ${userData.email}
- 交易時間: ${transactionDate}
- 交易ID: ${rechargeData.payment.transactionId}

充值詳情:
- 充值金額: HK$${rechargeData.amount}
- 獲得積分: ${rechargeData.points} 分

感謝您的充值，積分已成功添加到您的帳戶中。

此發票由 PickleVibes 系統自動生成
如有疑問，請聯繫客服

© 2024 PickleVibes. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * 生成活動提醒郵件模板
   */
  async generateActivityReminderEmailTemplate(activityData, userData, registrationData, options = {}) {
    await this.ensureLogoLoaded();

    const formatDateTime = (dateString) => {
      if (!dateString) return '待定';
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return '待定';
      }
      return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        timeZone: 'Asia/Hong_Kong',
        hour12: false
      });
    };

    const startDate = formatDateTime(activityData.startDate);
    const endDate = formatDateTime(activityData.endDate);

    const html = `
      <!DOCTYPE html>
      <html lang="zh-TW">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>活動提醒 - ${activityData.title}</title>
          <style>
            body {
              font-family: 'Microsoft JhengHei', Arial, sans-serif;
              background-color: #f5f7fb;
              color: #2c3e50;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 620px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #20B2AA 0%, #3CB371 100%);
              color: #ffffff;
              text-align: center;
              padding: 32px 20px;
            }
            .header img {
              max-width: 110px;
              height: auto;
              margin-bottom: 18px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              letter-spacing: 1px;
            }
            .content {
              padding: 36px 32px;
            }
            .greeting {
              font-size: 18px;
              margin-bottom: 20px;
            }
            .highlight {
              background-color: #e8f8f6;
              border-left: 4px solid #20B2AA;
              padding: 18px 20px;
              border-radius: 10px;
              margin-bottom: 24px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .info-card {
              background-color: #f8fafc;
              border-radius: 10px;
              padding: 16px;
              border: 1px solid #eef2f7;
            }
            .info-title {
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 6px;
            }
            .footer {
              text-align: center;
              padding: 24px 20px;
              background-color: #f1f5f9;
              color: #64748b;
              font-size: 14px;
            }
            .footer p {
              margin: 6px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes Logo" />` : ''}
              <h1>活動提醒</h1>
              <p style="margin-top: 6px;">${activityData.title}</p>
            </div>
            <div class="content">
              <p class="greeting">親愛的 ${userData.name} 您好，</p>
              ${activityData.poster && options.activityImageCid ? `
                <div style="text-align: center; margin-bottom: 24px;">
                  <img src="cid:${options.activityImageCid}"
                       alt="活動海報"
                       style="width: 100%; max-width: 480px; height: auto; border-radius: 12px; box-shadow: 0 6px 16px rgba(15, 23, 42, 0.15);">
                </div>
              ` : ''}
              <div class="highlight">
                <p style="margin: 0; font-size: 16px;">
                  這是一個友善提醒，PickleVibes 的活動 <strong>${activityData.title}</strong> 即將開始。<br />
                  請預留足夠時間到達場地辦理報到，期待與您見面！
                </p>
              </div>
              <div class="info-grid">
                <div class="info-card">
                  <div class="info-title">活動時間</div>
                  <div>${startDate}</div>
                  ${activityData.endDate ? `<div style="margin-top:8px;">至 ${endDate}</div>` : ''}
                </div>
                <div class="info-card">
                  <div class="info-title">活動地點</div>
                  <div>${activityData.location || 'PickleVibes 匹克球場'}</div>
                </div>
                <div class="info-card">
                  <div class="info-title">報名資訊</div>
                  <div>報名人數：${registrationData.participantCount} 人</div>
                  <div>聯絡電郵：${registrationData.contactInfo?.email || userData.email}</div>
                  ${registrationData.contactInfo?.phone ? `<div>聯絡電話：${registrationData.contactInfo.phone}</div>` : ''}
                </div>
              </div>
              ${activityData.requirements ? `
                <div class="info-card" style="margin-bottom: 24px;">
                  <div class="info-title">活動注意事項</div>
                  <div>${activityData.requirements}</div>
                </div>
              ` : ''}
              <p style="font-size: 15px; color: #334155; margin-bottom: 0;">
                如需更改或取消參加，請盡早與我們聯絡，以便安排。<br />
                感謝您的支持，PickleVibes 團隊期待與您在活動中見面！
              </p>
            </div>
            <div class="footer">
              <p>如有任何疑問，請隨時聯繫我們</p>
              <p>📧 info@picklevibes.hk | 📞 +852 6190 2761</p>
              <p>© ${new Date().getFullYear()} PickleVibes. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
PickleVibes 活動提醒 - ${activityData.title}

親愛的 ${userData.name} 您好，

這是一個提醒，PickleVibes 的活動「${activityData.title}」即將開始。請準時出席：
- 活動時間：${startDate}${activityData.endDate ? ` - ${endDate}` : ''}
- 活動地點：${activityData.location || 'PickleVibes 匹克球場'}
- 報名人數：${registrationData.participantCount} 人
- 聯絡資訊：${registrationData.contactInfo?.email || userData.email}${registrationData.contactInfo?.phone ? ` / ${registrationData.contactInfo.phone}` : ''}

${activityData.requirements ? `活動注意事項：${activityData.requirements}\n\n` : ''}如需協助，請聯絡我們：info@picklevibes.hk 或 +852 6190 2761。

PickleVibes 團隊
    `;

    return { html, text };
  }

  /**
   * 發送活動報名確認郵件
   */
  async sendActivityRegistrationEmail(userData, activityData, registrationData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      await this.ensureLogoLoaded();

      // 準備附件
      const attachments = [];
      let activityImageCid = null;

      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo'
        });
      }

      if (activityData.poster) {
        const posterCid = `activity-banner-${registrationData?._id || Date.now()}`;
        const posterAttachment = await this.buildActivityImageAttachment(activityData.poster, posterCid);
        if (posterAttachment) {
          attachments.push(posterAttachment);
          activityImageCid = posterCid;
        }
      }

      const emailTemplate = await this.generateActivityRegistrationEmailTemplate(
        activityData,
        userData,
        registrationData,
        { activityImageCid }
      );
      
      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: `🎾 活動報名確認 - ${activityData.title}`,
        html: emailTemplate,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ 活動報名確認郵件已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送活動報名確認郵件失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 發送活動提醒郵件
   */
  async sendActivityReminderEmail(userData, activityData, registrationData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      await this.ensureLogoLoaded();

      const attachments = [];
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo'
        });
      }

      let activityImageCid = null;
      if (activityData.poster) {
        const posterCid = `activity-reminder-banner-${registrationData?._id || Date.now()}`;
        const posterAttachment = await this.buildActivityImageAttachment(activityData.poster, posterCid);
        if (posterAttachment) {
          attachments.push(posterAttachment);
          activityImageCid = posterCid;
        }
      }

      const { html, text } = await this.generateActivityReminderEmailTemplate(
        activityData,
        userData,
        registrationData,
        { activityImageCid }
      );

      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: `⏰ 活動提醒 - ${activityData.title}`,
        html,
        text,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ 活動提醒郵件已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送活動提醒郵件失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成發票電郵模板
   */
  async generateInvoiceEmailTemplate(invoiceData, userData, paymentData) {
    // 確保 logo 已加載
    await this.ensureLogoLoaded();
    
    try {
      // 使用 PDF 服務生成 HTML
      const html = await pdfService.generateInvoiceHTML(userData, invoiceData, paymentData);
      
      const invoiceNumber = invoiceData.invoiceNumber || `INV-${Date.now()}`;
      
      return {
        subject: `🧾 發票確認 - ${invoiceNumber} | PickleVibes`,
        html: html,
        text: `發票確認 - ${invoiceNumber}\n\n感謝您選擇 PickleVibes！\n\n發票詳情：\n- 發票號碼: ${invoiceNumber}\n- 總金額: ${this.formatCurrency(invoiceData.total)}\n- 付款狀態: 已付款\n\n如有任何疑問，請聯繫我們。`
      };
    } catch (error) {
      console.error('❌ 生成發票模板失敗:', error.message);
      throw error;
    }
  }

  /**
   * 發送發票電郵 (PDF 附件版本)
   */
  async sendInvoiceEmail(userData, invoiceData, paymentData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      const invoiceNumber = invoiceData.invoiceNumber || `INV-${Date.now()}`;
      
      // 生成 PDF 發票
      console.log('📄 正在生成 PDF 發票...');
      const pdfBuffer = await pdfService.generateInvoicePDF(userData, invoiceData, paymentData);
      
      // 準備附件
      const attachments = [];
      
      // 添加 PDF 發票作為附件
      attachments.push({
        filename: `發票_${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
      
      // 添加 Logo 作為附件 (用於 PDF 中的顯示)
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo' // Content ID for referencing in PDF
        });
      }
      
      // 創建簡單的電郵內容
      const currentDate = new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      });
      
      const emailSubject = `🧾 發票確認 - ${invoiceNumber} | PickleVibes`;
      const emailText = `
親愛的 ${userData.name || '客戶'}，

感謝您選擇 PickleVibes！

您的發票已準備就緒，詳情如下：
- 發票號碼：${invoiceNumber}
- 發票日期：${currentDate}
- 總金額：${this.formatCurrency(invoiceData.total)}
- 付款狀態：已付款

發票 PDF 已作為附件發送給您，請查收。

如有任何疑問，請隨時聯繫我們。

此致
PickleVibes 團隊
      `;
      
      const emailHtml = `
        <div style="font-family: 'Microsoft JhengHei', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #20B2AA; margin-bottom: 10px;">🧾 發票確認</h2>
            <p style="color: #666; font-size: 16px;">感謝您選擇 PickleVibes！</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-bottom: 15px;">發票詳情</h3>
            <p><strong>發票號碼：</strong>${invoiceNumber}</p>
            <p><strong>發票日期：</strong>${currentDate}</p>
            <p><strong>總金額：</strong>${this.formatCurrency(invoiceData.total)}</p>
            <p><strong>付款狀態：</strong><span style="color: #28a745; font-weight: bold;">已付款</span></p>
          </div>
          
          <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin-bottom: 20px;">
            <p style="margin: 0; color: #333;">
              <strong>📄 發票 PDF 已作為附件發送給您，請查收。</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              如有任何疑問，請隨時聯繫我們：<br>
              📧 info@picklevibes.hk | 📞 +852 6190-2761
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 15px;">
              此致<br>
              PickleVibes 團隊
            </p>
          </div>
        </div>
      `;
      
      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ PDF 發票電郵已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送 PDF 發票電郵失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 發送訂單確認郵件
   */
  async sendOrderConfirmationEmail(userData, orderData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      await this.ensureLogoLoaded();

      const emailSubject = `訂單確認 - ${orderData.orderNumber}`;
      
      const itemsHtml = orderData.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
            HK$${item.price.toFixed(2)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
            HK$${item.subtotal.toFixed(2)}
          </td>
        </tr>
      `).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes" style="max-width: 200px; margin-bottom: 20px;">` : ''}
            
            <h2 style="color: #333; margin-bottom: 20px;">訂單確認</h2>
            
            <p style="color: #666; line-height: 1.6;">
              親愛的 ${userData.name}，<br><br>
              感謝您的訂購！您的訂單已成功建立，訂單詳情如下：
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>訂單編號：</strong>${orderData.orderNumber}</p>
              <p style="margin: 0 0 10px 0;"><strong>訂單日期：</strong>${new Date(orderData.createdAt).toLocaleString('zh-TW')}</p>
              <p style="margin: 0;"><strong>訂單狀態：</strong><span style="color: #ff9800; font-weight: bold;">待處理</span></p>
            </div>

            <h3 style="color: #333; margin-top: 30px; margin-bottom: 15px;">訂單項目</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">產品名稱</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">數量</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">單價</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">小計</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span><strong>小計：</strong></span>
                <span><strong>HK$${orderData.subtotal.toFixed(2)}</strong></span>
              </div>
              ${orderData.discount > 0 ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: #28a745;">
                <span>折扣${orderData.redeemCodeName ? ` (${orderData.redeemCodeName})` : ''}：</span>
                <span>-HK$${orderData.discount.toFixed(2)}</span>
              </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; padding-top: 10px; border-top: 2px solid #ddd; font-size: 18px;">
                <span><strong>總計：</strong></span>
                <span style="color: #ff6b35; font-weight: bold;">HK$${orderData.total.toFixed(2)}</span>
              </div>
            </div>

            <h3 style="color: #333; margin-top: 30px; margin-bottom: 15px;">收貨地址</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>${orderData.shippingAddress.name}</strong></p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.phone}</p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.address}</p>
              ${orderData.shippingAddress.district ? `<p style="margin: 5px 0;">${orderData.shippingAddress.district}</p>` : ''}
              ${orderData.shippingAddress.postalCode ? `<p style="margin: 5px 0;">${orderData.shippingAddress.postalCode}</p>` : ''}
            </div>

            ${orderData.notes ? `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0;"><strong>備註：</strong>${orderData.notes}</p>
            </div>
            ` : ''}

            <div style="background: #e8f5e8; padding: 20px; border-radius: 10px; border-left: 4px solid #28a745; margin-top: 20px;">
              <p style="margin: 0; color: #333;">
                <strong>📦 我們將盡快處理您的訂單，並在出貨時發送通知郵件給您。</strong>
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">
                如有任何疑問，請隨時聯繫我們：<br>
                📧 info@picklevibes.hk | 📞 +852 6190-2761
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 15px;">
                此致<br>
                PickleVibes 團隊
              </p>
            </div>
          </div>
        </div>
      `;

      const emailText = `
訂單確認

親愛的 ${userData.name}，

感謝您的訂購！您的訂單已成功建立。

訂單編號：${orderData.orderNumber}
訂單日期：${new Date(orderData.createdAt).toLocaleString('zh-TW')}
訂單狀態：待處理

訂單項目：
${orderData.items.map(item => `- ${item.name} x ${item.quantity} = HK$${item.subtotal.toFixed(2)}`).join('\n')}

小計：HK$${orderData.subtotal.toFixed(2)}
${orderData.discount > 0 ? `折扣：-HK$${orderData.discount.toFixed(2)}\n` : ''}總計：HK$${orderData.total.toFixed(2)}

收貨地址：
${orderData.shippingAddress.name}
${orderData.shippingAddress.phone}
${orderData.shippingAddress.address}
${orderData.shippingAddress.district || ''}
${orderData.shippingAddress.postalCode || ''}

我們將盡快處理您的訂單，並在出貨時發送通知郵件給您。

如有任何疑問，請隨時聯繫我們：
📧 info@picklevibes.hk | 📞 +852 6190-2761

此致
PickleVibes 團隊
      `;

      const attachments = [];
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo'
        });
      }

      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ 訂單確認郵件已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送訂單確認郵件失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 發送出貨通知郵件
   */
  async sendOrderShippedEmail(userData, orderData) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      await this.ensureLogoLoaded();

      const emailSubject = `訂單已出貨 - ${orderData.orderNumber}`;
      
      const itemsHtml = orderData.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">
            <strong>${item.name}</strong>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
            ${item.quantity}
          </td>
        </tr>
      `).join('');

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes" style="max-width: 200px; margin-bottom: 20px;">` : ''}
            
            <h2 style="color: #333; margin-bottom: 20px;">訂單已出貨 🚚</h2>
            
            <p style="color: #666; line-height: 1.6;">
              親愛的 ${userData.name}，<br><br>
              您的訂單已出貨！我們已將您的商品寄出，<strong>請留意收件時間並準備收貨</strong>。詳情如下：
            </p>
            
            <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>訂單編號：</strong>${orderData.orderNumber}</p>
              <p style="margin: 0 0 10px 0;"><strong>出貨日期：</strong>${new Date(orderData.shippedAt).toLocaleString('zh-TW')}</p>
              ${orderData.trackingNumber ? `<p style="margin: 0;"><strong>追蹤號碼：</strong><span style="color: #ff6b35; font-weight: bold;">${orderData.trackingNumber}</span></p>` : ''}
            </div>

            <h3 style="color: #333; margin-top: 30px; margin-bottom: 15px;">出貨項目</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">產品名稱</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">數量</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <h3 style="color: #333; margin-top: 30px; margin-bottom: 15px;">收貨地址</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>${orderData.shippingAddress.name}</strong></p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.phone}</p>
              <p style="margin: 5px 0;">${orderData.shippingAddress.address}</p>
              ${orderData.shippingAddress.district ? `<p style="margin: 5px 0;">${orderData.shippingAddress.district}</p>` : ''}
              ${orderData.shippingAddress.postalCode ? `<p style="margin: 5px 0;">${orderData.shippingAddress.postalCode}</p>` : ''}
            </div>

            <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin-top: 20px;">
              <p style="margin: 0 0 8px 0; color: #333;">
                <strong>📦 請留意收件時間，提前準備收貨並注意查收您的包裹。</strong>
              </p>
              <p style="margin: 0; color: #666; font-size: 14px;">如有任何問題，請隨時聯繫我們。</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">
                如有任何疑問，請隨時聯繫我們：<br>
                📧 info@picklevibes.hk | 📞 +852 6190-2761
              </p>
              <p style="color: #999; font-size: 12px; margin-top: 15px;">
                此致<br>
                PickleVibes 團隊
              </p>
            </div>
          </div>
        </div>
      `;

      const emailText = `
訂單已出貨

親愛的 ${userData.name}，

您的訂單已出貨！我們已將您的商品寄出，請留意收件時間並準備收貨。

訂單編號：${orderData.orderNumber}
出貨日期：${new Date(orderData.shippedAt).toLocaleString('zh-TW')}
${orderData.trackingNumber ? `追蹤號碼：${orderData.trackingNumber}\n` : ''}

出貨項目：
${orderData.items.map(item => `- ${item.name} x ${item.quantity}`).join('\n')}

收貨地址：
${orderData.shippingAddress.name}
${orderData.shippingAddress.phone}
${orderData.shippingAddress.address}
${orderData.shippingAddress.district || ''}
${orderData.shippingAddress.postalCode || ''}

請留意收件時間，提前準備收貨並注意查收您的包裹。如有任何問題，請隨時聯繫我們。

如有任何疑問，請隨時聯繫我們：
📧 info@picklevibes.hk | 📞 +852 6190-2761

此致
PickleVibes 團隊
      `;

      const attachments = [];
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo'
        });
      }

      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        attachments: attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ 出貨通知郵件已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送出貨通知郵件失敗:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 發送訂單取消通知郵件
   * @param {Object} userData - 用戶資料
   * @param {Object} orderData - 訂單資料
   * @param {Object} options - { pointsRefunded: number } 若有退還積分
   */
  async sendOrderCancelledEmail(userData, orderData, options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('郵件服務未初始化');
      }

      await this.ensureLogoLoaded();

      const emailSubject = `訂單已取消 - ${orderData.orderNumber}`;
      const { pointsRefunded } = options;

      const itemsHtml = orderData.items.map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;"><strong>${item.name}</strong></td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">HK$${item.subtotal.toFixed(2)}</td>
        </tr>
      `).join('');

      const refundNote = pointsRefunded > 0
        ? `<div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 15px 0;">
            <p style="margin: 0;"><strong>退款說明：</strong>已為您退還訂單實付金額 HK$${orderData.total.toFixed(2)} 對應之積分（${pointsRefunded} 分）至帳戶餘額；兌換碼使用次數亦已退還。</p>
          </div>`
        : `<div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="margin: 0;">若此訂單曾使用兌換碼，其使用次數已退還，您可再次使用。</p>
          </div>`;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            ${this.logoBase64 ? `<img src="cid:logo" alt="PickleVibes" style="max-width: 200px; margin-bottom: 20px;">` : ''}
            <h2 style="color: #333; margin-bottom: 20px;">訂單已取消</h2>
            <p style="color: #666; line-height: 1.6;">
              親愛的 ${userData.name}，<br><br>
              您的訂單 <strong>${orderData.orderNumber}</strong> 已取消。
            </p>
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>訂單編號：</strong>${orderData.orderNumber}</p>
              <p style="margin: 0 0 10px 0;"><strong>原訂單金額：</strong>小計 HK$${orderData.subtotal.toFixed(2)}${orderData.discount > 0 ? `，折扣 -HK$${orderData.discount.toFixed(2)}` : ''}，總計 <strong>HK$${orderData.total.toFixed(2)}</strong></p>
            </div>
            <h3 style="color: #333; margin-top: 20px; margin-bottom: 10px;">原訂單項目</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">產品</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">數量</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">小計</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            ${refundNote}
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">如有任何疑問，請聯繫我們：<br>📧 info@picklevibes.hk | 📞 +852 6190-2761</p>
              <p style="color: #999; font-size: 12px; margin-top: 15px;">此致<br>PickleVibes 團隊</p>
            </div>
          </div>
        </div>
      `;

      const emailText = `
訂單已取消

親愛的 ${userData.name}，

您的訂單 ${orderData.orderNumber} 已取消。

原訂單總計：HK$${orderData.total.toFixed(2)}
${pointsRefunded > 0 ? `已退還 ${pointsRefunded} 分至您的帳戶餘額；兌換碼使用次數已退還。\n` : '若曾使用兌換碼，其使用次數已退還。\n'}

如有任何疑問，請聯繫我們：📧 info@picklevibes.hk | 📞 +852 6190-2761

此致
PickleVibes 團隊
      `;

      const attachments = [];
      if (this.logoBase64) {
        attachments.push({
          filename: 'picklevibes-logo.png',
          content: this.logoBase64.replace('data:image/png;base64,', ''),
          encoding: 'base64',
          cid: 'logo'
        });
      }

      const mailOptions = {
        from: `"PickleVibes 匹克球場" <${process.env.GMAIL_USER}>`,
        to: userData.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ 訂單取消通知郵件已發送給 ${userData.email}: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ 發送訂單取消通知郵件失敗:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();

