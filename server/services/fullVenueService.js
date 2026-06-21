const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');
const {
  normalizeBookingDateInput,
  getHKCalendarYMD
} = require('../utils/bookingDateTime');

function describeBookingConflict(booking, court) {
  const ymd = getHKCalendarYMD(booking.date);
  const userName =
    booking.user?.name ||
    booking.players?.[0]?.name ||
    '（未知用戶）';

  let source = '一般預約';
  if (booking.relatedActivity) {
    const title =
      typeof booking.relatedActivity === 'object' && booking.relatedActivity.title
        ? booking.relatedActivity.title
        : '';
    source = title ? `活動佔場：${title}` : '活動佔場';
  } else if (booking.venueBundleKind === 'activity_hold') {
    source = '活動佔場';
  } else if (
    booking.venueBundleKind === 'full_venue' ||
    booking.isFullVenue ||
    (booking.specialRequests && String(booking.specialRequests).includes('包場'))
  ) {
    source = '包場預約';
  } else if (
    booking.specialRequests &&
    String(booking.specialRequests).includes('活動')
  ) {
    source = '活動佔場';
  }

  const statusLabel =
    booking.status === 'pending'
      ? '待確認'
      : booking.status === 'confirmed'
        ? '已確認'
        : booking.status;

  return {
    bookingId: String(booking._id),
    courtId: String(court._id),
    courtName: court.name,
    courtType: court.type,
    date: ymd,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    statusLabel,
    userName,
    source,
    summary: `${court.name} · ${ymd} ${booking.startTime}–${booking.endTime} · ${source} · ${userName}（${statusLabel}）`
  };
}

function buildConflictError(conflictCheck) {
  const err = new Error(
    conflictCheck.conflictDetails.length
      ? `時間衝突：${conflictCheck.conflictDetails.map((c) => c.summary).join('；')}`
      : '時間衝突'
  );
  err.statusCode = 409;
  err.conflicts = conflictCheck.conflicts;
  return err;
}

/** 包場 = 店鋪內所有可預約場地（不限類型；排除 full_venue 虛擬類型） */
async function resolveStoreCourtsForFullVenue(storeId, options = {}) {
  const courtQuery = {
    store: storeId,
    type: { $ne: 'full_venue' },
  };
  if (!options.includeInactive) {
    courtQuery.isActive = true;
  }
  const courts = await Court.find(courtQuery).sort({ number: 1, name: 1 });
  if (!courts.length) {
    throw new Error('此店鋪沒有可包場的場地');
  }
  return courts;
}

/** 按場地牌價比例分配自訂總價，最後一場補齊舍入差額 */
function allocateChargeAcrossCourts(chargeTotal, courtPrices) {
  const listTotal = courtPrices.reduce((sum, cp) => sum + cp.courtPrice, 0);
  if (chargeTotal <= 0 || !courtPrices.length) return courtPrices.map(() => 0);
  if (listTotal <= 0) {
    const even = Math.floor(chargeTotal / courtPrices.length);
    return courtPrices.map((_, i) =>
      i === courtPrices.length - 1 ? chargeTotal - even * (courtPrices.length - 1) : even
    );
  }
  let allocated = 0;
  return courtPrices.map((cp, i) => {
    if (i === courtPrices.length - 1) return chargeTotal - allocated;
    const share = Math.round((chargeTotal * cp.courtPrice) / listTotal);
    allocated += share;
    return share;
  });
}

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

      const storeId = options.storeId;
      if (!storeId) {
        throw new Error('請選擇店鋪');
      }

      const courts = await resolveStoreCourtsForFullVenue(storeId, options);
      console.log(`🏢 包場場地：${courts.length} 個（${courts.map((c) => c.name).join('、')}）`);

      const bookingDate = normalizeBookingDateInput(bookingData.date);
      bookingData.date = bookingDate;

      const conflictCheck = await this.checkTimeConflicts(
        bookingDate,
        bookingData.startTime,
        bookingData.endTime,
        storeId
      );
      if (conflictCheck.hasConflict) {
        throw buildConflictError(conflictCheck);
      }

      const bypassRestrictions = options.bypassRestrictions === true;
      /** 管理員輸入的包場扣款／議價（bypass 時仍保存，供結算與顯示） */
      const requestedCharge = Math.max(0, Number(options.pointsDeduction) || 0);
      const useCustomCharge = requestedCharge > 0;

      // 計算包場牌價總和
      let listTotalPrice = 0;
      const courtBookings = [];
      const courtPrices = [];
      const venueBundleId = new mongoose.Types.ObjectId();

      for (const court of courts) {
        const courtPrice = court.getPriceForTime(bookingData.startTime, bookingData.date);
        courtPrices.push({ court, courtPrice });
        listTotalPrice += courtPrice;
      }

      const chargeTotal = useCustomCharge ? requestedCharge : listTotalPrice;
      const allocatedCharges = allocateChargeAcrossCourts(chargeTotal, courtPrices);
      const balanceDeduction = bypassRestrictions ? 0 : chargeTotal;
      const unpaidHold = bypassRestrictions || balanceDeduction <= 0;

      courtPrices.forEach(({ court, courtPrice }, index) => {
        const courtCharge = allocatedCharges[index] || 0;
        const courtPointsShare = unpaidHold ? 0 : courtCharge;

        const courtBooking = new Booking({
          user: user._id,
          store: storeId,
          court: court._id,
          date: bookingData.date,
          startTime: bookingData.startTime,
          endTime: bookingData.endTime,
          duration: bookingData.duration,
          players: bookingData.players,
          totalPlayers: bookingData.totalPlayers,
          venueBundleId,
          venueBundleKind: 'full_venue',
          isFullVenue: false,
          bypassRestrictions: bypassRestrictions,
          noUserBalanceDebited: unpaidHold,
          status: 'confirmed',
          pricing: {
            basePrice: courtPrice,
            totalPrice: courtCharge,
            memberDiscount: 0,
            pointsDeducted: courtPointsShare,
            isCustomPoints: useCustomCharge,
            customPoints: useCustomCharge ? courtCharge : undefined,
            originalPrice: courtPrice,
          },
          payment: {
            status: 'paid',
            method: unpaidHold ? 'admin_waived' : 'points',
            pointsDeducted: courtPointsShare,
            originalPrice: courtPrice,
            paidAt: new Date(),
          },
          specialRequests: `🏢 包場預約 - ${court.name}\n📅 預約日期: ${bookingData.date.toLocaleDateString('zh-TW')}\n⏰ 時間: ${bookingData.startTime}-${bookingData.endTime}\n👥 參與人數: ${bookingData.totalPlayers}人\n💰 場地費用: ${courtCharge}積分${useCustomCharge ? `（議價總額 ${chargeTotal}）` : ''}${bookingData.notes ? `\n📝 備註: ${bookingData.notes}` : ''}`
        });

        courtBookings.push(courtBooking);
      });

      // 保存所有預約
      const savedBookings = await Booking.insertMany(courtBookings);

      // 舊版「主預約」標記：第一筆為主並指向其餘場地，供舊 cancel API 相容
      if (savedBookings.length > 1) {
        const [main, ...rest] = savedBookings;
        await Booking.updateOne(
          { _id: main._id },
          {
            $set: {
              isFullVenue: true,
              fullVenueBookings: rest.map((b) => b._id)
            }
          }
        );
      }

      // 非 bypass 且有指定扣款：從用戶餘額扣除（CreateBookingModal 可能已先 manual-deduct，此處僅在直接 API 建單時生效）
      if (balanceDeduction > 0 && !bypassRestrictions) {
        const UserBalance = require('../models/UserBalance');
        let userBalance = await UserBalance.findOne({ user: user._id });

        if (!userBalance) {
          userBalance = new UserBalance({ user: user._id });
          await userBalance.save();
        }

        await userBalance.deductBalance(
          balanceDeduction,
          `包場預約積分扣除 - ${savedBookings.length}個場地${useCustomCharge ? `（議價 ${chargeTotal}）` : ''}`,
          savedBookings[0]._id
        );

        console.log(`💰 包場積分扣除: ${balanceDeduction} 分`);
      }

      console.log(`✅ 包場預約創建成功: ${savedBookings.length} 個場地`);
      console.log(`💰 包場總價: ${chargeTotal}（牌價 ${listTotalPrice}）`);

      return {
        success: true,
        bookings: savedBookings,
        totalPrice: chargeTotal,
        listTotalPrice,
        message: `包場預約創建成功，共 ${savedBookings.length} 個場地，總價 ${chargeTotal} 積分`
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
  async checkTimeConflicts(date, startTime, endTime, storeId, options = {}) {
    try {
      if (!storeId) {
        throw new Error('請選擇店鋪');
      }
      const courts = await resolveStoreCourtsForFullVenue(storeId, options);
      const conflicts = [];
      const seenBookingIds = new Set();

      const normalizedDate = normalizeBookingDateInput(date);

      for (const court of courts) {
        const overlapping = await Booking.findTimeConflicts(
          court._id,
          normalizedDate,
          startTime,
          endTime
        );
        for (const booking of overlapping) {
          const key = String(booking._id);
          if (seenBookingIds.has(key)) continue;
          seenBookingIds.add(key);
          conflicts.push(describeBookingConflict(booking, court));
        }
      }

      return {
        hasConflict: conflicts.length > 0,
        conflicts,
        conflictDetails: conflicts
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
      if (!mainBooking) {
        throw new Error('找不到包場預約');
      }

      const cancellation = {
        cancelledAt: new Date(),
        cancelledBy: 'admin',
        reason: '包場預約取消'
      };

      if (mainBooking.venueBundleId) {
        const cancelResult = await Booking.updateMany(
          {
            venueBundleId: mainBooking.venueBundleId,
            status: { $in: ['pending', 'confirmed'] }
          },
          { $set: { status: 'cancelled', cancellation } }
        );
        console.log(`✅ 包場預約取消成功: ${cancelResult.modifiedCount} 個場地`);
        return {
          success: true,
          cancelledCount: cancelResult.modifiedCount,
          message: `包場預約取消成功，共取消 ${cancelResult.modifiedCount} 個預約`
        };
      }

      if (!mainBooking.isFullVenue) {
        throw new Error('找不到包場預約或不是包場預約');
      }

      const cancelResult = await Booking.updateMany(
        { _id: { $in: mainBooking.fullVenueBookings } },
        { $set: { status: 'cancelled', cancellation } }
      );

      mainBooking.status = 'cancelled';
      mainBooking.cancellation = cancellation;
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
