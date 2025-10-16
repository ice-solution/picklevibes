const axios = require('axios');
const emailService = require('./emailService');
const QRCode = require('qrcode');

class AccessControlService {
  constructor() {
    this.baseURL = 'https://isgp-team.hikcentralconnect.com/api/hccgw/platform/v1';
    this.token = null;
    this.tokenExpiry = null;
  }

  /**
   * 獲取訪問令牌
   */
  async getToken() {
    try {
      // 如果已有有效令牌，直接返回
      if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.token;
      }

      console.log('🔑 正在獲取門禁系統訪問令牌...');
      
      const response = await axios.post(`${this.baseURL}/token/get`, {
        appKey: process.env.HIKKEY,
        secretKey: process.env.HIKSECRET
      });

      console.log('🔍 門禁系統 API 響應:', JSON.stringify(response.data, null, 2));

      // 嘗試不同的響應格式
      let accessToken = null;
      if (response.data && response.data.data && response.data.data.accessToken) {
        accessToken = response.data.data.accessToken;
      } else if (response.data && response.data.accessToken) {
        accessToken = response.data.accessToken;
      } else if (response.data && response.data.token) {
        accessToken = response.data.token;
      } else if (response.data && response.data.access_token) {
        accessToken = response.data.access_token;
      }

      if (accessToken) {
        this.token = accessToken;
        // 設置令牌過期時間（通常為2小時，提前5分鐘刷新）
        this.tokenExpiry = new Date(Date.now() + (2 * 60 * 60 * 1000) - (5 * 60 * 1000));
        
        console.log('✅ 門禁系統訪問令牌獲取成功');
        return this.token;
      } else {
        throw new Error(`門禁系統返回的令牌格式不正確。響應數據: ${JSON.stringify(response.data)}`);
      }
    } catch (error) {
      console.error('❌ 獲取門禁系統訪問令牌失敗:', error.response?.data || error.message);
      throw new Error(`獲取門禁系統訪問令牌失敗: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 將時間提前15分鐘
   */
  subtractMinutes(timeString, minutes = 15) {
    try {
      // 解析時間字符串 (格式: HH:MM)
      const [hours, mins] = timeString.split(':').map(Number);
      
      // 創建日期對象
      const date = new Date();
      date.setHours(hours, mins, 0, 0);
      
      // 減去指定分鐘數
      date.setMinutes(date.getMinutes() - minutes);
      
      // 返回格式化的時間字符串
      const newHours = date.getHours().toString().padStart(2, '0');
      const newMins = date.getMinutes().toString().padStart(2, '0');
      
      const result = `${newHours}:${newMins}`;
      console.log(`⏰ 時間調整: ${timeString} → ${result} (提前${minutes}分鐘)`);
      
      return result;
    } catch (error) {
      console.error('❌ 時間調整失敗:', error.message);
      return timeString; // 如果調整失敗，返回原時間
    }
  }

  /**
   * 創建臨時授權
   */
  async createTempAuth(visitorData, bookingData) {
    try {
      const token = await this.getToken();
      
      // 將開始時間提前15分鐘，讓用戶可以提早進場
      const earlyStartTime = this.subtractMinutes(bookingData.startTime, 15);
      
      console.log('👤 正在創建臨時授權...', {
        name: visitorData.name,
        phone: visitorData.phone,
        email: visitorData.email,
        originalStartTime: bookingData.startTime,
        earlyStartTime: earlyStartTime,
        endTime: bookingData.endTime
      });

      // 將時間轉換為 ISO 字符串格式
      const startTime = this.convertToISOString(bookingData.date, earlyStartTime);
      const endTime = this.convertToISOString(bookingData.date, bookingData.endTime);

      const requestBody = {
        name: visitorData.name,
        openCount: 100, // 默認開門次數
        startTime: startTime,
        endTime: endTime,
        clientLocalTime: startTime,
        alIds: [process.env.HIKACCESSLEVELID]
      };

      console.log('📤 發送請求數據:', requestBody);

      const response = await axios.post('https://isgp.hikcentralconnect.com/api/hccgw/vims/v1/tempauth/add', requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'token': token
        }
      });

      console.log('🔍 臨時授權 API 響應:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.errorCode === '0') {
        console.log('✅ 臨時授權創建成功:', response.data.data);
        return response.data.data;
      } else {
        throw new Error(`創建臨時授權失敗: ${response.data?.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('❌ 創建臨時授權失敗:', error.response?.data || error.message);
      throw new Error(`創建臨時授權失敗: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * 將日期和時間轉換為帶時區的 ISO 字符串格式
   */
  convertToISOString(date, time) {
    try {
      // 處理日期格式
      let dateStr;
      if (date instanceof Date) {
        dateStr = date.toISOString().split('T')[0]; // 轉換為 YYYY-MM-DD 格式
      } else {
        dateStr = date;
      }
      
      // 將日期和時間組合成帶時區的 ISO 字符串格式
      // 格式: 2025-09-29T00:00:00+08:00
      const isoString = `${dateStr}T${time}:00+08:00`;
      
      console.log('🕐 轉換結果:', {
        inputDate: date,
        inputTime: time,
        outputISO: isoString
      });
      
      return isoString;
    } catch (error) {
      console.error('❌ 時間轉換失敗:', error);
      throw new Error(`時間轉換失敗: ${error.message}`);
    }
  }

  /**
   * 發送開門通知郵件
   */
  async sendAccessEmail(visitorData, bookingData, qrCodeData = null, password = null) {
    try {
      console.log('📧 正在發送開門通知郵件...', {
        email: visitorData.email,
        bookingDate: bookingData.date,
        courtName: bookingData.courtName,
        hasQRCode: !!qrCodeData,
        hasPassword: !!password
      });

      const result = await emailService.sendAccessEmail(visitorData, bookingData, qrCodeData, password);
      console.log('✅ 開門通知郵件發送成功');
      return result;
    } catch (error) {
      console.error('❌ 發送開門通知郵件失敗:', error.message);
      throw new Error(`發送開門通知郵件失敗: ${error.message}`);
    }
  }

  /**
   * 完整的開門流程
   */
  async processAccessControl(visitorData, bookingData) {
    try {
      console.log('🚪 開始處理開門系統流程...');
      
      // 1. 獲取令牌
      await this.getToken();
      
      // 2. 創建臨時授權
      const tempAuth = await this.createTempAuth(visitorData, bookingData);
      
      // 3. 處理二維碼數據
      let qrCodeData = null;
      if (tempAuth && tempAuth.code) {
        try {
          console.log('📱 正在處理二維碼數據...');
          // API 返回的 code 已經是 base64 編碼的圖片數據
          // 直接使用，不需要重新生成
          qrCodeData = tempAuth.code;
          console.log('✅ 二維碼數據處理成功');
        } catch (qrError) {
          console.error('❌ 二維碼數據處理失敗:', qrError.message);
          // 不影響整個流程，繼續發送郵件
        }
      }
      
      // 4. 發送郵件（包含二維碼和密碼）
      await this.sendAccessEmail(visitorData, bookingData, qrCodeData, tempAuth.password);
      
      console.log('✅ 開門系統流程處理完成');
      return {
        success: true,
        tempAuth: tempAuth,
        message: '開門系統流程處理成功'
      };
    } catch (error) {
      console.error('❌ 開門系統流程處理失敗:', error.message);
      throw error;
    }
  }
}

module.exports = new AccessControlService();

