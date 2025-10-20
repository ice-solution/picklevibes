const GoogleCalendarService = require('./googleCalendarService');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Court = require('../models/Court');

class SmartGoogleCalendarSync {
  constructor() {
    this.googleCalendarService = new GoogleCalendarService();
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await this.googleCalendarService.initialize();
      this.isInitialized = true;
    }
  }

  /**
   * 智能同步：只同步需要同步的預約
   * @param {Object} options 同步選項
   * @param {Date} options.startDate 開始日期（可選）
   * @param {Date} options.endDate 結束日期（可選）
   * @param {boolean} options.forceSync 強制同步所有預約（可選）
   */
  async smartSync(options = {}) {
    try {
      await this.initialize();

      const { startDate, endDate, forceSync = false } = options;
      
      console.log('🧠 開始智能同步...\n');

      // 構建查詢條件
      const query = { status: 'confirmed' };
      
      if (!forceSync) {
        // 只同步待同步或同步失敗的預約
        query.$or = [
          { googleSyncStatus: 'pending' },
          { googleSyncStatus: 'failed' },
          { googleSyncStatus: { $exists: false } } // 兼容舊數據
        ];
      }

      // 添加日期範圍
      if (startDate) {
        query.date = { ...query.date, $gte: startDate };
      }
      if (endDate) {
        query.date = { ...query.date, $lte: endDate };
      }

      // 獲取需要同步的預約
      const bookings = await Booking.find(query)
        .populate('user', 'name email')
        .populate('court', 'name')
        .sort({ date: 1, startTime: 1 });

      console.log(`📋 找到 ${bookings.length} 個需要同步的預約`);

      if (bookings.length === 0) {
        console.log('✅ 沒有需要同步的預約');
        return { synced: 0, updated: 0, failed: 0 };
      }

      let syncedCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      // 處理每個預約
      for (const booking of bookings) {
        try {
          let result = null;

          if (booking.googleEventId && booking.googleSyncStatus === 'synced') {
            // 更新現有事件
            result = await this.googleCalendarService.updateEvent(
              booking,
              booking.googleEventId,
              booking.googlePrivateEventId
            );
            updatedCount++;
            console.log(`✅ 已更新預約: ${booking._id}`);
          } else {
            // 創建新事件
            result = await this.googleCalendarService.createEvent(booking);
            syncedCount++;
            console.log(`✅ 已創建預約: ${booking._id}`);
          }

          if (result) {
            // 更新同步狀態
            await Booking.findByIdAndUpdate(booking._id, {
              googleEventId: result.publicEventId,
              googlePrivateEventId: result.privateEventId,
              googleSyncStatus: 'synced',
              googleSyncAt: new Date()
            }, { runValidators: false });
          }

        } catch (error) {
          console.error(`❌ 同步預約 ${booking._id} 失敗:`, error.message);
          
          // 更新失敗狀態
          await Booking.findByIdAndUpdate(booking._id, {
            googleSyncStatus: 'failed',
            googleSyncAt: new Date()
          }, { runValidators: false });
          
          failedCount++;
        }
      }

      console.log(`\n🎯 智能同步完成:`);
      console.log(`- 新同步: ${syncedCount} 個`);
      console.log(`- 更新: ${updatedCount} 個`);
      console.log(`- 失敗: ${failedCount} 個`);

      return { synced: syncedCount, updated: updatedCount, failed: failedCount };

    } catch (error) {
      console.error('❌ 智能同步失敗:', error);
      throw error;
    }
  }

  /**
   * 同步取消的預約
   */
  async syncCancelledBookings() {
    try {
      await this.initialize();

      console.log('🔄 同步取消的預約...\n');

      // 獲取已取消且有Google Calendar事件ID的預約
      const cancelledBookings = await Booking.find({
        status: 'cancelled',
        googleEventId: { $exists: true, $ne: null }
      });

      console.log(`📋 找到 ${cancelledBookings.length} 個已取消的預約需要處理`);

      let deletedCount = 0;
      let failedCount = 0;

      for (const booking of cancelledBookings) {
        try {
          const success = await this.googleCalendarService.deleteEvent(
            booking.googleEventId,
            booking.googlePrivateEventId
          );

          if (success) {
            // 清除Google Calendar事件ID
            await Booking.findByIdAndUpdate(booking._id, {
              $unset: {
                googleEventId: 1,
                googlePrivateEventId: 1
              },
              googleSyncStatus: 'pending',
              googleSyncAt: new Date()
            }, { runValidators: false });

            deletedCount++;
            console.log(`✅ 已刪除取消的預約: ${booking._id}`);
          }
        } catch (error) {
          console.error(`❌ 刪除取消預約 ${booking._id} 失敗:`, error.message);
          failedCount++;
        }
      }

      console.log(`\n🎯 取消預約處理完成:`);
      console.log(`- 已刪除: ${deletedCount} 個`);
      console.log(`- 失敗: ${failedCount} 個`);

      return { deleted: deletedCount, failed: failedCount };

    } catch (error) {
      console.error('❌ 同步取消預約失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取同步統計
   */
  async getSyncStats() {
    try {
      const stats = await Booking.aggregate([
        {
          $group: {
            _id: '$googleSyncStatus',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        pending: 0,
        synced: 0,
        failed: 0,
        total: 0
      };

      stats.forEach(stat => {
        if (stat._id === 'pending' || stat._id === null || stat._id === undefined) {
          result.pending = stat.count;
        } else if (stat._id === 'synced') {
          result.synced = stat.count;
        } else if (stat._id === 'failed') {
          result.failed = stat.count;
        }
        result.total += stat.count;
      });

      return result;
    } catch (error) {
      console.error('❌ 獲取同步統計失敗:', error);
      throw error;
    }
  }
}

module.exports = SmartGoogleCalendarSync;
