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
   * 處理 24:00 的情況（轉換為 00:00 再計算）
   */
  subtractMinutes(timeString, minutes = 15) {
    try {
      // 處理 24:00 的情況
      let normalizedTime = timeString;
      if (timeString === '24:00') {
        normalizedTime = '00:00';
      }
      
      // 解析時間字符串 (格式: HH:MM)
      const [hours, mins] = normalizedTime.split(':').map(Number);
      
      // 創建日期對象（使用固定日期作為基準，避免時區問題）
      const date = new Date('2000-01-01T00:00:00');
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
      // 傳入 endDate 和 earlyStartTime 用於判斷 endTime 是否為跨天
      const startTime = this.convertToISOString(bookingData.date, earlyStartTime);
      const endTime = this.convertToISOString(
        bookingData.date, 
        bookingData.endTime, 
        bookingData.endDate || null, 
        earlyStartTime
      );

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
   * 處理 24:00 的情況，轉換為下一天的 00:00
   * @param {Date|String} date - 日期
   * @param {String} time - 時間 (HH:MM 格式)
   * @param {Date|String} endDate - 結束日期（如果存在且與 date 不同，表示跨天）
   * @param {String} startTime - 開始時間（用於判斷跨天，當 endDate 不存在時）
   */
  convertToISOString(date, time, endDate = null, startTime = null) {
    try {
      // 處理日期格式
      let dateObj;
      if (date instanceof Date) {
        dateObj = new Date(date);
      } else {
        // 如果是字符串，嘗試解析
        dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          // 如果解析失敗，假設是 YYYY-MM-DD 格式
          dateObj = new Date(date + 'T00:00:00');
        }
      }
      
      // 處理 24:00 的情況
      let finalDate = new Date(dateObj);
      let finalTime = time;
      
      if (time === '24:00') {
        // 24:00 轉換為下一天的 00:00
        finalDate.setDate(finalDate.getDate() + 1);
        finalTime = '00:00';
        console.log('⏰ 檢測到 24:00，轉換為下一天的 00:00');
      } else {
        // 判斷是否需要跨天（適用於所有時間，不僅僅是 00:00）
        let isOvernight = false;
        
        if (endDate) {
          // 如果有 endDate，比較 endDate 和 date 是否不同
          let endDateObj;
          if (endDate instanceof Date) {
            endDateObj = new Date(endDate);
          } else {
            endDateObj = new Date(endDate);
            if (isNaN(endDateObj.getTime())) {
              endDateObj = new Date(endDate + 'T00:00:00');
            }
          }
          
          // 比較日期（只比較年月日，忽略時間）
          const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
          const endDateOnly = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate());
          
          if (endDateOnly.getTime() > dateOnly.getTime()) {
            isOvernight = true;
            console.log('⏰ 檢測到跨天情況（endDate > date），轉換為下一天');
          }
        } else if (startTime) {
          // 如果沒有 endDate，使用 startTime 判斷跨天
          // 將時間轉換為分鐘數以便比較
          const parseTimeToMinutes = (timeStr) => {
            const [hours, mins] = timeStr.split(':').map(Number);
            return hours * 60 + mins;
          };
          
          const startMinutes = parseTimeToMinutes(startTime);
          const endMinutes = parseTimeToMinutes(time);
          
          // 如果 endTime 早於 startTime，表示跨天
          // 或者如果 startTime >= 22:00（晚上10點後），endTime 很可能是跨天
          if (endMinutes < startMinutes || startMinutes >= 22 * 60) {
            isOvernight = true;
            console.log(`⏰ 檢測到跨天情況（startTime: ${startTime}, endTime: ${time}），轉換為下一天`);
          }
        }
        
        if (isOvernight) {
          finalDate.setDate(finalDate.getDate() + 1);
        }
      }
      
      // 格式化日期為 YYYY-MM-DD
      const year = finalDate.getFullYear();
      const month = String(finalDate.getMonth() + 1).padStart(2, '0');
      const day = String(finalDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // 將日期和時間組合成帶時區的 ISO 字符串格式
      // 格式: 2025-09-29T00:00:00+08:00
      const isoString = `${dateStr}T${finalTime}:00+08:00`;
      
      console.log('🕐 轉換結果:', {
        inputDate: date,
        inputTime: time,
        endDate: endDate,
        outputDate: dateStr,
        outputTime: finalTime,
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
      
      // 計算開始和結束時間（ISO 格式）
      // 傳入 endDate 和 earlyStartTime 用於判斷 endTime 是否為跨天
      const earlyStartTime = this.subtractMinutes(bookingData.startTime, 15);
      const startTimeISO = this.convertToISOString(bookingData.date, earlyStartTime);
      const endTimeISO = this.convertToISOString(
        bookingData.date, 
        bookingData.endTime, 
        bookingData.endDate || null, 
        earlyStartTime
      );
      
      console.log('✅ 開門系統流程處理完成');
      return {
        success: true,
        tempAuth: {
          ...tempAuth,
          startTime: startTimeISO,
          endTime: endTimeISO
        },
        message: '開門系統流程處理成功',
        qrCodeData: qrCodeData,
        password: tempAuth.password
      };
    } catch (error) {
      console.error('❌ 開門系統流程處理失敗:', error.message);
      throw error;
    }
  }
}

module.exports = new AccessControlService();

