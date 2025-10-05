const twilio = require('twilio');

class WhatsAppService {
  constructor() {
    // 檢查必要的環境變量
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.error('❌ Twilio 環境變量未設置：');
      console.error('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '已設置' : '未設置');
      console.error('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '已設置' : '未設置');
      this.client = null;
    } else {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      console.log('✅ Twilio 客戶端初始化成功');
    }
    // WhatsApp Sandbox 默認號碼
    this.fromNumber = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    
    // 檢查 From 號碼格式
    if (!this.fromNumber.startsWith('whatsapp:')) {
      this.fromNumber = `whatsapp:${this.fromNumber}`;
    }
  }

  /**
   * 發送 WhatsApp 訊息
   * @param {string} to - 接收者電話號碼 (格式: +85212345678 或 whatsapp:+85212345678)
   * @param {string} message - 訊息內容
   * @returns {Promise<Object>} Twilio 回應
   */
  async sendMessage(to, message) {
    try {
      // 檢查客戶端是否已初始化
      if (!this.client) {
        throw new Error('Twilio 客戶端未初始化，請檢查環境變量設置');
      }

      // 確保電話號碼格式正確
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      
      const response = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedTo
      });

      console.log('✅ WhatsApp 訊息發送成功:', {
        sid: response.sid,
        to: formattedTo,
        status: response.status
      });

      return {
        success: true,
        sid: response.sid,
        status: response.status,
        to: formattedTo
      };
    } catch (error) {
      console.error('❌ WhatsApp 訊息發送失敗:', error);
      
      // 提供更詳細的錯誤信息
      let errorMessage = error.message;
      let errorCode = error.code;
      
      if (error.message.includes('Channel with the specified From address')) {
        errorMessage = 'WhatsApp Sandbox 未正確設置，請檢查 TWILIO_WHATSAPP_FROM 環境變量';
        errorCode = 'WHATSAPP_SANDBOX_NOT_SETUP';
      } else if (error.message.includes('username is required')) {
        errorMessage = 'Twilio 認證信息缺失，請檢查 TWILIO_ACCOUNT_SID 和 TWILIO_AUTH_TOKEN';
        errorCode = 'TWILIO_AUTH_MISSING';
      }
      
      return {
        success: false,
        error: errorMessage,
        code: errorCode,
        originalError: error.message
      };
    }
  }

  /**
   * 發送預約確認訊息
   * @param {Object} booking - 預約資料
   * @param {string} phoneNumber - 接收者電話號碼
   * @returns {Promise<Object>} 發送結果
   */
  async sendBookingConfirmation(booking, phoneNumber) {
    const message = this.formatBookingConfirmationMessage(booking);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * 發送預約提醒訊息
   * @param {Object} booking - 預約資料
   * @param {string} phoneNumber - 接收者電話號碼
   * @returns {Promise<Object>} 發送結果
   */
  async sendBookingReminder(booking, phoneNumber) {
    const message = this.formatBookingReminderMessage(booking);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * 發送預約取消訊息
   * @param {Object} booking - 預約資料
   * @param {string} phoneNumber - 接收者電話號碼
   * @returns {Promise<Object>} 發送結果
   */
  async sendBookingCancellation(booking, phoneNumber) {
    const message = this.formatBookingCancellationMessage(booking);
    return await this.sendMessage(phoneNumber, message);
  }

  /**
   * 格式化預約確認訊息
   * @param {Object} booking - 預約資料
   * @returns {string} 格式化後的訊息
   */
  formatBookingConfirmationMessage(booking) {
    const date = new Date(booking.date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `🏓 *預約確認通知*

場地：${booking.court?.name || '未知場地'}
日期：${date}
時間：${booking.startTime} - ${booking.endTime}
人數：${booking.totalPlayers} 人
總價：${booking.pricing?.totalPrice || 0} 積分

預約編號：${booking._id}
狀態：已確認

感謝您的預約！如有任何問題，請聯繫我們。`;
  }

  /**
   * 格式化預約提醒訊息
   * @param {Object} booking - 預約資料
   * @returns {string} 格式化後的訊息
   */
  formatBookingReminderMessage(booking) {
    const date = new Date(booking.date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `⏰ *預約提醒*

您的預約即將開始：

場地：${booking.court?.name || '未知場地'}
日期：${date}
時間：${booking.startTime} - ${booking.endTime}

請提前15分鐘到達場地。如有任何問題，請聯繫我們。`;
  }

  /**
   * 格式化預約取消訊息
   * @param {Object} booking - 預約資料
   * @returns {string} 格式化後的訊息
   */
  formatBookingCancellationMessage(booking) {
    const date = new Date(booking.date).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });

    return `❌ *預約取消通知*

您的預約已被取消：

場地：${booking.court?.name || '未知場地'}
日期：${date}
時間：${booking.startTime} - ${booking.endTime}

如有任何問題，請聯繫我們。`;
  }

  /**
   * 驗證電話號碼格式
   * @param {string} phoneNumber - 電話號碼
   * @returns {boolean} 是否有效
   */
  isValidPhoneNumber(phoneNumber) {
    // 簡單的電話號碼驗證（可根據需要調整）
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/^whatsapp:/, ''));
  }
}

module.exports = WhatsAppService;
