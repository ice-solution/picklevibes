const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');

class FullVenueService {
  /**
   * 創建包場預約
   * @param {Object} bookingData - 預約數據
   * @param {Object} user - 用戶對象
   * @returns {Object} 創建結果
   */
  async createFullVenueBooking(bookingData, user, options = {}) {
    try {
      console.log('🏢 開始創建包場預約...');

      // 獲取包場需要的3個特定場地
      const soloCourt = await Court.findOne({ type: 'solo', isActive: true });
      const trainingCourt = await Court.findOne({ type: 'training', isActive: true });
      const competitionCourt = await Court.findOne({ type: 'competition', isActive: true });
      
      if (!soloCourt || !trainingCourt || !competitionCourt) {
        throw new Error('找不到包場所需的場地（單人場、訓練場、比賽場）');
      }
      
      const courts = [soloCourt, trainingCourt, competitionCourt];

      // 檢查時間衝突
      const conflictCheck = await this.checkTimeConflicts(bookingData.date, bookingData.startTime, bookingData.endTime);
      if (conflictCheck.hasConflict) {
        throw new Error(`時間衝突：${conflictCheck.conflictDetails.join(', ')}`);
      }

      // 處理積分扣除（如果指定了）
      let pointsDeducted = 0;
      if (options.pointsDeduction && options.pointsDeduction > 0) {
        pointsDeducted = options.pointsDeduction;
        console.log(`💰 包場積分扣除: ${pointsDeducted} 分`);
      }

      // 計算包場總價格
      let totalPrice = 0;
      const courtBookings = [];

      // 為每個場地創建預約記錄
      for (const court of courts) {
        const courtPrice = court.getPriceForTime(bookingData.startTime, bookingData.date);
        const courtBooking = new Booking({
          user: user._id,
          court: court._id,
          date: bookingData.date,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          duration: bookingData.duration,
          players: bookingData.players,
          totalPlayers: bookingData.totalPlayers,
          isFullVenue: false, // 所有預約都是普通預約
          status: 'confirmed',
          pricing: {
            basePrice: courtPrice,
            totalPrice: courtPrice,
            discount: 0,
            finalPrice: courtPrice,
            pointsDeducted: pointsDeducted // 每個預約都記錄積分扣除
          },
          notes: `🏢 包場預約 - ${court.name}\n📅 預約日期: ${bookingData.date.toLocaleDateString('zh-TW')}\n⏰ 時間: ${bookingData.startTime}-${bookingData.endTime}\n👥 參與人數: ${bookingData.totalPlayers}人\n💰 場地費用: ${courtPrice}積分${bookingData.notes ? `\n📝 備註: ${bookingData.notes}` : ''}`,
          createdBy: 'admin'
        });

        courtBookings.push(courtBooking);
        totalPrice += courtPrice;
      }

      // 保存所有預約
      const savedBookings = await Booking.insertMany(courtBookings);

      // 如果有積分扣除，創建積分扣除記錄
      if (pointsDeducted > 0) {
        const UserBalance = require('../models/UserBalance');
        let userBalance = await UserBalance.findOne({ user: user._id });
        
        if (!userBalance) {
          userBalance = new UserBalance({ user: user._id });
          await userBalance.save();
        }

        // 扣除積分並關聯到第一個預約記錄
        await userBalance.deductBalance(
          pointsDeducted,
          `包場預約積分扣除 - ${savedBookings.length}個場地`,
          savedBookings[0]._id // 關聯到第一個預約記錄
        );
        
        console.log(`💰 包場積分扣除: ${pointsDeducted} 分`);
      }

      console.log(`✅ 包場預約創建成功: ${savedBookings.length} 個場地`);
      console.log(`💰 總價格: $${totalPrice}`);

      return {
        success: true,
        bookings: savedBookings, // 所有預約記錄
        totalPrice: totalPrice,
        message: `包場預約創建成功，共 ${savedBookings.length} 個場地，總價 $${totalPrice}`
      };

    } catch (error) {
      console.error('❌ 創建包場預約失敗:', error);
      throw error;
    }
  }

  /**
   * 檢查時間衝突
   * @param {Date} date - 預約日期
   * @param {String} startTime - 開始時間
   * @param {String} endTime - 結束時間
   * @returns {Object} 衝突檢查結果
   */
  async checkTimeConflicts(date, startTime, endTime) {
    try {
      // 獲取包場需要的3個特定場地
      const soloCourt = await Court.findOne({ type: 'solo', isActive: true });
      const trainingCourt = await Court.findOne({ type: 'training', isActive: true });
      const competitionCourt = await Court.findOne({ type: 'competition', isActive: true });
      
      if (!soloCourt || !trainingCourt || !competitionCourt) {
        throw new Error('找不到包場所需的場地（單人場、訓練場、比賽場）');
      }
      
      const courts = [soloCourt, trainingCourt, competitionCourt];
      
      // 使用 Booking 模型的標準時間衝突檢查方法
      const conflicts = [];
      
      // 檢查每個場地是否有時間衝突
      for (const court of courts) {
        const hasConflict = await Booking.checkTimeConflict(court._id, date, startTime, endTime);
        if (hasConflict) {
          conflicts.push({
            court: court.name,
            type: court.type
          });
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflictDetails: conflicts.map(conflict => 
          `${conflict.court} (${conflict.type})`
        )
      };

    } catch (error) {
      console.error('❌ 檢查時間衝突失敗:', error);
      throw error;
    }
  }

  /**
   * 取消包場預約
   * @param {String} mainBookingId - 主預約ID
   * @returns {Object} 取消結果
   */
  async cancelFullVenueBooking(mainBookingId) {
    try {
      console.log('🗑️ 開始取消包場預約...');

      const mainBooking = await Booking.findById(mainBookingId);
      if (!mainBooking || !mainBooking.isFullVenue) {
        throw new Error('找不到包場預約或不是包場預約');
      }

      // 取消所有關聯的預約
      const cancelResult = await Booking.updateMany(
        { _id: { $in: mainBooking.fullVenueBookings } },
        { status: 'cancelled' }
      );

      // 取消主預約
      mainBooking.status = 'cancelled';
      await mainBooking.save();

      console.log(`✅ 包場預約取消成功: ${cancelResult.modifiedCount} 個場地`);

      return {
        success: true,
        cancelledCount: cancelResult.modifiedCount + 1,
        message: `包場預約取消成功，共取消 ${cancelResult.modifiedCount + 1} 個預約`
      };

    } catch (error) {
      console.error('❌ 取消包場預約失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取包場預約詳情
   * @param {String} mainBookingId - 主預約ID
   * @returns {Object} 包場預約詳情
   */
  async getFullVenueBookingDetails(mainBookingId) {
    try {
      const mainBooking = await Booking.findById(mainBookingId)
        .populate('user', 'name email phone')
        .populate('court', 'name type')
        .populate('fullVenueBookings');

      if (!mainBooking || !mainBooking.isFullVenue) {
        throw new Error('找不到包場預約或不是包場預約');
      }

      // 獲取所有場地預約詳情
      const courtBookings = await Booking.find({
        _id: { $in: mainBooking.fullVenueBookings }
      }).populate('court', 'name type number');

      return {
        mainBooking: mainBooking,
        courtBookings: courtBookings,
        totalCourts: courtBookings.length,
        totalPrice: mainBooking.pricing.finalPrice
      };

    } catch (error) {
      console.error('❌ 獲取包場預約詳情失敗:', error);
      throw error;
    }
  }

  /**
   * 獲取包場預約列表
   * @param {Object} filters - 篩選條件
   * @returns {Array} 包場預約列表
   */
  async getFullVenueBookings(filters = {}) {
    try {
      const query = { isFullVenue: true };
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.date) {
        const startDate = new Date(filters.date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.date);
        endDate.setHours(23, 59, 59, 999);
        query.date = { $gte: startDate, $lte: endDate };
      }

      const bookings = await Booking.find(query)
        .populate('user', 'name email phone')
        .populate('court', 'name type')
        .populate('fullVenueBookings')
        .sort({ date: 1, startTime: 1 });

      return bookings;

    } catch (error) {
      console.error('❌ 獲取包場預約列表失敗:', error);
      throw error;
    }
  }
}

module.exports = new FullVenueService();
