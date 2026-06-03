const axios = require('axios');
const emailService = require('./emailService');
const QRCode = require('qrcode');

class AccessControlService {
  constructor() {
    this.baseURL = 'https://isgp-team.hikcentralconnect.com/api/hccgw/platform/v1';
    this.tokenCache = new Map();
  }

  _cacheKey(hikConfig) {
    return hikConfig?.appKey || process.env.HIKKEY || 'default';
  }

  /**
   * 獲取訪問令牌
   * @param {object} [hikConfig] - { appKey, secretKey, accessLevelId }
   */
  async getToken(hikConfig = null) {
    try {
      const appKey = hikConfig?.appKey || process.env.HIKKEY;
      const secretKey = hikConfig?.secretKey || process.env.HIKSECRET;
      const cacheKey = this._cacheKey(hikConfig);
      const cached = this.tokenCache.get(cacheKey);
      if (cached?.token && cached?.tokenExpiry && new Date() < cached.tokenExpiry) {
        return cached.token;
      }

      console.log('🔑 正在獲取門禁系統訪問令牌...');
      
      const response = await axios.post(`${this.baseURL}/token/get`, {
        appKey,
        secretKey,
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
        this.tokenCache.set(cacheKey, {
          token: accessToken,
          tokenExpiry: new Date(Date.now() + (2 * 60 * 60 * 1000) - (5 * 60 * 1000)),
        });
        
        console.log('✅ 門禁系統訪問令牌獲取成功');
        return accessToken;
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
   * 將時間加上指定分鐘（門禁結束時間延長用）
   * 回傳 { time: 'HH:MM', addDays }；若跨午夜則 addDays 為 1
   */
  addMinutes(timeString, minutes = 15) {
    try {
      const normalizedTime = timeString === '24:00' ? '00:00' : timeString;
      const [hours, mins] = normalizedTime.split(':').map(Number);
      const base = new Date(2000, 0, 1, hours, mins, 0, 0);
      const beforeDay = base.getDate();
      base.setMinutes(base.getMinutes() + minutes);
      const afterDay = base.getDate();
      const addDays = afterDay !== beforeDay ? 1 : 0;
      const newHours = base.getHours().toString().padStart(2, '0');
      const newMins = base.getMinutes().toString().padStart(2, '0');
      const resultTime = `${newHours}:${newMins}`;
      console.log(
        `⏰ 結束時間延長: ${timeString} → ${resultTime} (+${minutes}分鐘${addDays ? ', 跨日+1' : ''})`
      );
      return { time: resultTime, addDays };
    } catch (error) {
      console.error('❌ 結束時間延長失敗:', error.message);
      return { time: timeString, addDays: 0 };
    }
  }

  /**
   * 門禁 API 用：預約結束時間 +15 分鐘，供 convertToISOString 使用
   */
  getExtendedEndForHik(bookingData, extendMinutes = 15) {
    const extended = this.addMinutes(bookingData.endTime, extendMinutes);
    let endDateParam = bookingData.endDate || null;
    if (extended.addDays > 0) {
      let base;
      if (endDateParam) {
        base =
          endDateParam instanceof Date
            ? new Date(endDateParam.getTime())
            : new Date(
                String(endDateParam).includes('T')
                  ? endDateParam
                  : `${endDateParam}T12:00:00`
              );
      } else {
        const bd = bookingData.date;
        base =
          bd instanceof Date
            ? new Date(bd.getTime())
            : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(bd).trim()) ? `${bd}T12:00:00` : bd);
      }
      if (Number.isNaN(base.getTime())) {
        throw new Error('無法解析預約日期以延長門禁結束時間');
      }
      base.setDate(base.getDate() + extended.addDays);
      endDateParam = base;
    }
    return { endTimeStr: extended.time, endDateParam };
  }

  /**
   * 創建臨時授權
   */
  async createTempAuth(visitorData, bookingData, hikConfig = null) {
    try {
      const token = await this.getToken(hikConfig);
      const accessLevelId = hikConfig?.accessLevelId || process.env.HIKACCESSLEVELID;
      
      // 將開始時間提前15分鐘，讓用戶可以提早進場
      const earlyStartTime = this.subtractMinutes(bookingData.startTime, 15);
      const { endTimeStr, endDateParam } = this.getExtendedEndForHik(bookingData, 15);
      
      console.log('👤 正在創建臨時授權...', {
        name: visitorData.name,
        phone: visitorData.phone,
        email: visitorData.email,
        originalStartTime: bookingData.startTime,
        earlyStartTime: earlyStartTime,
        bookingEndTime: bookingData.endTime,
        hikEndTime: endTimeStr
      });

      // 將時間轉換為 ISO 字符串格式
      // earlyStartTime 若大於 startTime（如 23:45 > 00:00）表示跨越前一天，開門日需減一天
      const usePreviousDayForEarly = this._timeToMinutes(earlyStartTime) > this._timeToMinutes(bookingData.startTime);
      const startTime = this.convertToISOString(bookingData.date, earlyStartTime, null, null, usePreviousDayForEarly);
      const endTime = this.convertToISOString(
        bookingData.date,
        endTimeStr,
        endDateParam,
        earlyStartTime
      );

      const requestBody = {
        name: visitorData.name,
        openCount: 100, // 默認開門次數
        startTime: startTime,
        endTime: endTime,
        clientLocalTime: startTime,
        alIds: [accessLevelId]
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
   * 將 HH:MM 轉為分鐘數
   */
  _timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const normalized = timeStr === '24:00' ? '00:00' : timeStr;
    const [hours, mins] = normalized.split(':').map(Number);
    return (hours || 0) * 60 + (mins || 0);
  }

  /**
   * 將日期和時間轉換為帶時區的 ISO 字符串格式
   * 處理 24:00 的情況，轉換為下一天的 00:00
   * @param {Date|String} date - 日期
   * @param {String} time - 時間 (HH:MM 格式)
   * @param {Date|String} endDate - 結束日期（如果存在且與 date 不同，表示跨天）
   * @param {String} startTime - 開始時間（用於判斷跨天，當 endDate 不存在時）
   * @param {Boolean} usePreviousDay - 若為 true，使用前一天的日期（例如 00:00 提前 15 分鐘為 23:45 前一天）
   */
  convertToISOString(date, time, endDate = null, startTime = null, usePreviousDay = false) {
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
      
      // 處理 24:00 或需使用前一日的情況
      let finalDate = new Date(dateObj);
      let finalTime = time;
      if (usePreviousDay) {
        finalDate.setDate(finalDate.getDate() - 1);
        console.log('⏰ 開門時間提前至前一日（例如 00:00 提前 15 分鐘）');
      }
      
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
  async processAccessControl(visitorData, bookingData, hikConfig = null) {
    try {
      console.log('🚪 開始處理開門系統流程...');
      
      // 1. 獲取令牌
      await this.getToken(hikConfig);
      
      // 2. 創建臨時授權
      const tempAuth = await this.createTempAuth(visitorData, bookingData, hikConfig);
      
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
      
      // 計算開始和結束時間（ISO 格式，與送 Hik 的授權窗一致：開始提前 15 分、結束延後 15 分）
      const earlyStartTime = this.subtractMinutes(bookingData.startTime, 15);
      const usePreviousDayForEarly = this._timeToMinutes(earlyStartTime) > this._timeToMinutes(bookingData.startTime);
      const startTimeISO = this.convertToISOString(bookingData.date, earlyStartTime, null, null, usePreviousDayForEarly);
      const { endTimeStr, endDateParam } = this.getExtendedEndForHik(bookingData, 15);
      const endTimeISO = this.convertToISOString(
        bookingData.date,
        endTimeStr,
        endDateParam,
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

