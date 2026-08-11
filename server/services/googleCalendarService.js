const { google } = require('googleapis');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Court = require('../models/Court');

class GoogleCalendarService {
  constructor() {
    this.calendar = null;
    this.isInitialized = false;
    
    // 根據環境設置不同的日曆ID
    const env = process.env.NODE_ENV || 'development';
    this.setCalendarIdsByEnvironment(env);
  }

  setCalendarIdsByEnvironment(env) {
    // 直接從 .env 中讀取對應環境的日曆ID
    const envKey = env.toUpperCase();
    this.publicCalendarId = process.env[`GOOGLE_CALENDAR_${envKey}_ID`] || 'primary';
    this.privateCalendarId = process.env[`GOOGLE_CALENDAR_${envKey}_PRIVATE_ID`] || null;
    
    console.log(`🔧 使用 ${env} 環境日曆配置`);
    console.log(`📅 公開日曆ID: ${this.publicCalendarId}`);
    console.log(`📅 私人日曆ID: ${this.privateCalendarId || '未設置'}`);
  }

  async initialize() {
    try {
      // 從環境變量獲取Google Calendar配置
      const credentials = {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
      };

      // 創建JWT認證
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar']
      );

      // 初始化Calendar API
      this.calendar = google.calendar({ version: 'v3', auth });
      
      // 暫停私人日曆功能
      // await this.setupPrivateCalendar();
      
      this.isInitialized = true;

      console.log('✅ Google Calendar 服務初始化成功');
      return true;
    } catch (error) {
      console.error('❌ Google Calendar 服務初始化失敗:', error);
      return false;
    }
  }

  async setupPrivateCalendar() {
    try {
      const calendarName = 'PickCourt 預約詳情';
      
      // 檢查是否已存在私人日曆
      const calendarList = await this.calendar.calendarList.list();
      const existingCalendar = calendarList.data.items.find(
        calendar => calendar.summary === calendarName
      );

      if (existingCalendar) {
        this.privateCalendarId = existingCalendar.id;
        console.log(`✅ 找到現有私人日曆: ${this.privateCalendarId}`);
      } else {
        // 創建新的私人日曆
        const newCalendar = await this.calendar.calendars.insert({
          requestBody: {
            summary: calendarName,
            description: 'PickCourt 預約詳細信息日曆（包含個人資料）',
            timeZone: 'Asia/Hong_Kong'
          }
        });
        
        this.privateCalendarId = newCalendar.data.id;
        console.log(`✅ 創建新私人日曆: ${this.privateCalendarId}`);
      }
    } catch (error) {
      console.error('❌ 設置私人日曆失敗:', error);
      // 如果創建失敗，使用主日曆
      this.privateCalendarId = 'primary';
    }
  }

  async createEvent(booking) {
    if (!this.isInitialized) {
      console.error('Google Calendar 服務未初始化');
      return null;
    }

    try {
      // 獲取用戶和場地信息
      const [user, court] = await Promise.all([
        User.findById(booking.user),
        Court.findById(booking.court)
      ]);

      if (!user || !court) {
        console.error('找不到用戶或場地信息');
        return null;
      }

      // 調試：檢查booking數據格式
      console.log('Booking數據:', {
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime
      });

      // 格式化日期為ISO字符串
      const dateStr = booking.date instanceof Date 
        ? booking.date.toISOString().split('T')[0] 
        : booking.date.toString().split('T')[0];

      console.log('格式化後的日期:', dateStr);

      // 創建公開事件（只包含場地和時間）
      const publicEvent = {
        summary: `匹克球預約 - ${court.name}`,
        description: `
預約詳情：
- 場地：${court.name}
- 時間：${dateStr} ${booking.startTime}-${booking.endTime}
        `.trim(),
        start: {
          dateTime: dateStr + 'T' + booking.startTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        end: {
          dateTime: dateStr + 'T' + booking.endTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1天前
            { method: 'popup', minutes: 30 }       // 30分鐘前
          ]
        }
      };

      // 創建私人事件（包含所有詳細信息）
      const privateEvent = {
        summary: `匹克球預約 - ${court.name} (${user.name})`,
        description: `
預約詳情：
- 場地：${court.name}
- 時間：${dateStr} ${booking.startTime}-${booking.endTime}
- 參與者：${booking.playerName}
- 聯繫方式：${booking.playerEmail} / ${booking.playerPhone}
- 預約ID：${booking._id}
- 狀態：${booking.status}
- 用戶ID：${user._id}
        `.trim(),
        start: {
          dateTime: dateStr + 'T' + booking.startTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        end: {
          dateTime: dateStr + 'T' + booking.endTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        // 移除attendees，因為服務帳戶無法邀請參與者
        // attendees: [
        //   {
        //     email: user.email,
        //     displayName: user.name,
        //     responseStatus: 'accepted'
        //   }
        // ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1天前
            { method: 'popup', minutes: 30 }       // 30分鐘前
          ]
        },
        extendedProperties: {
          private: {
            bookingId: booking._id.toString(),
            userId: user._id.toString(),
            courtId: court._id.toString()
          }
        }
      };

      // 只創建公開事件（暫停私人日曆）
      const publicResponse = await this.calendar.events.insert({
        calendarId: this.publicCalendarId,
        resource: publicEvent
      });

      console.log(`✅ 已創建公開事件: ${publicResponse.data.id}`);
      
      return {
        publicEventId: publicResponse.data.id,
        privateEventId: null // 暫停私人日曆
      };
    } catch (error) {
      console.error('❌ 創建Google Calendar事件失敗:', error);
      if (error.response) {
        console.error('錯誤詳情:', error.response.data);
        console.error('請求詳情:', {
          calendarId: this.publicCalendarId,
          dateStr: dateStr,
          startTime: booking.startTime,
          endTime: booking.endTime
        });
      }
      return null;
    }
  }

  async updateEvent(booking, googleEventId, googlePrivateEventId) {
    if (!this.isInitialized || !googleEventId || !googlePrivateEventId) {
      console.error('Google Calendar 服務未初始化或缺少事件ID');
      return null;
    }

    try {
      // 獲取用戶和場地信息
      const [user, court] = await Promise.all([
        User.findById(booking.user),
        Court.findById(booking.court)
      ]);

      if (!user || !court) {
        console.error('找不到用戶或場地信息');
        return null;
      }

      // 格式化日期為ISO字符串
      const dateStr = booking.date instanceof Date 
        ? booking.date.toISOString().split('T')[0] 
        : booking.date.toString().split('T')[0];

      // 構建更新的公開事件
      const publicEvent = {
        summary: `匹克球預約 - ${court.name}`,
        description: `
預約詳情：
- 場地：${court.name}
- 時間：${dateStr} ${booking.startTime}-${booking.endTime}
        `.trim(),
        start: {
          dateTime: dateStr + 'T' + booking.startTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        end: {
          dateTime: dateStr + 'T' + booking.endTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };

      // 構建更新的私人事件
      const privateEvent = {
        summary: `匹克球預約 - ${court.name} (${user.name})`,
        description: `
預約詳情：
- 場地：${court.name}
- 時間：${dateStr} ${booking.startTime}-${booking.endTime}
- 參與者：${booking.playerName}
- 聯繫方式：${booking.playerEmail} / ${booking.playerPhone}
- 預約ID：${booking._id}
- 狀態：${booking.status}
- 用戶ID：${user._id}
        `.trim(),
        start: {
          dateTime: dateStr + 'T' + booking.startTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        end: {
          dateTime: dateStr + 'T' + booking.endTime + ':00+08:00',
          timeZone: 'Asia/Hong_Kong'
        },
        // 移除attendees，因為服務帳戶無法邀請參與者
        // attendees: [
        //   {
        //     email: user.email,
        //     displayName: user.name,
        //     responseStatus: 'accepted'
        //   }
        // ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        },
        extendedProperties: {
          private: {
            bookingId: booking._id.toString(),
            userId: user._id.toString(),
            courtId: court._id.toString()
          }
        }
      };

      // 只更新公開事件（暫停私人日曆）
      const publicResponse = await this.calendar.events.update({
        calendarId: this.publicCalendarId,
        eventId: googleEventId,
        resource: publicEvent
      });

      console.log(`✅ 已更新公開事件: ${googleEventId}`);
      
      return {
        publicEventId: publicResponse.data.id,
        privateEventId: null // 暫停私人日曆
      };
    } catch (error) {
      console.error('❌ 更新Google Calendar事件失敗:', error);
      return null;
    }
  }

  async deleteEvent(googleEventId, googlePrivateEventId) {
    if (!this.isInitialized || !googleEventId || !googlePrivateEventId) {
      console.error('Google Calendar 服務未初始化或缺少事件ID');
      return false;
    }

    try {
      // 只刪除公開事件（暫停私人日曆）
      await this.calendar.events.delete({
        calendarId: this.publicCalendarId,
        eventId: googleEventId
      });

      console.log(`✅ 已刪除公開事件: ${googleEventId}`);
      return true;
    } catch (error) {
      console.error('❌ 刪除Google Calendar事件失敗:', error);
      return false;
    }
  }

  async syncAllBookings() {
    if (!this.isInitialized) {
      console.log('Google Calendar 服務未初始化，跳過同步');
      return;
    }

    try {
      console.log('🔄 開始單向同步：服務器數據 → Google Calendar...');

      // 獲取所有已確認的預約（不管是否已有Google Calendar事件ID）
      const bookings = await Booking.find({ 
        status: 'confirmed'
      }).populate('user court');

      if (bookings.length === 0) {
        console.log('✅ 沒有需要同步的預約');
        return;
      }

      console.log(`📋 找到 ${bookings.length} 個預約需要同步到Google Calendar`);

      let syncedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const booking of bookings) {
        try {
          if (booking.googleEventId && booking.googlePrivateEventId) {
            // 如果已有事件ID，則更新現有事件
            const updated = await this.updateEvent(booking, booking.googleEventId, booking.googlePrivateEventId);
            if (updated) {
              updatedCount++;
            } else {
              errorCount++;
            }
          } else {
            // 如果沒有事件ID，則創建新事件
            const googleEvents = await this.createEvent(booking);
            if (googleEvents) {
              // 保存Google Calendar事件ID到預約記錄（跳過validation）
              await Booking.findByIdAndUpdate(booking._id, {
                googleEventId: googleEvents.publicEventId,
                googlePrivateEventId: googleEvents.privateEventId
              }, { runValidators: false });
              syncedCount++;
            } else {
              errorCount++;
            }
          }
        } catch (error) {
          console.error(`❌ 同步預約 ${booking._id} 失敗:`, error);
          errorCount++;
        }
      }

      console.log(`✅ 單向同步完成: ${syncedCount} 個新事件，${updatedCount} 個更新，${errorCount} 個失敗`);
    } catch (error) {
      console.error('❌ 同步預約到Google Calendar失敗:', error);
    }
  }

  async syncBookingChanges() {
    if (!this.isInitialized) {
      console.log('Google Calendar 服務未初始化，跳過同步');
      return;
    }

    try {
      console.log('🔄 開始單向同步預約變更：服務器數據 → Google Calendar...');

      // 只處理取消的預約（刪除Google Calendar事件）
      const cancelledBookings = await Booking.find({ 
        status: 'cancelled',
        googleEventId: { $exists: true },
        googlePrivateEventId: { $exists: true }
      });

      let deletedCount = 0;
      let errorCount = 0;

      for (const booking of cancelledBookings) {
        try {
          // 刪除Google Calendar事件
          const deleted = await this.deleteEvent(booking.googleEventId, booking.googlePrivateEventId);
          if (deleted) {
            booking.googleEventId = undefined;
            booking.googlePrivateEventId = undefined;
            await booking.save();
            deletedCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ 刪除預約 ${booking._id} 的Google Calendar事件失敗:`, error);
          errorCount++;
        }
      }

      console.log(`✅ 單向同步變更完成: ${deletedCount} 個事件已刪除，${errorCount} 個失敗`);
    } catch (error) {
      console.error('❌ 單向同步預約變更到Google Calendar失敗:', error);
    }
  }
}

module.exports = GoogleCalendarService;
