const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Court = require('../models/Court');
const User = require('../models/User');

function normalizeDateTime(date, time) {
  const normalizedDate = new Date(date);
  if (time === '24:00') {
    normalizedDate.setDate(normalizedDate.getDate() + 1);
    return { date: normalizedDate, time: '00:00' };
  }
  return { date: normalizedDate, time };
}

/**
 * 建立管理員繞過限制之預約（不扣積分），並做時段衝突檢查。
 * 日期／時間計算與 POST /api/bookings 一致。
 */
async function createAdminBypassBooking({
  userId,
  courtId,
  dateInput,
  startTime,
  endTime: endTimeRaw,
  specialRequests
}) {
  const courtDoc = await Court.findById(courtId);
  if (!courtDoc) {
    throw new Error('場地不存在');
  }

  const bookingUser = await User.findById(userId);
  if (!bookingUser) {
    throw new Error('用戶不存在');
  }

  const normalizedEndTime = normalizeDateTime(dateInput, endTimeRaw);
  let endTime = normalizedEndTime.time;
  const bookingDate = new Date(dateInput);

  const hasConflict = await Booking.checkTimeConflict(
    courtId,
    dateInput,
    startTime,
    endTime
  );
  if (hasConflict) {
    throw new Error('該時間段已被預約');
  }

  const startMinutes =
    parseInt(startTime.split(':')[0], 10) * 60 + parseInt(startTime.split(':')[1], 10);
  let endMinutes =
    parseInt(endTime.split(':')[0], 10) * 60 + parseInt(endTime.split(':')[1], 10);
  if (endTimeRaw === '24:00') {
    endMinutes = 24 * 60;
  }
  const isOvernight = endMinutes <= startMinutes;
  if (isOvernight) {
    endMinutes += 24 * 60;
  }
  const duration = endMinutes - startMinutes;
  if (duration <= 0) {
    throw new Error('結束時間必須晚於開始時間');
  }

  const calculatedEndDate = new Date(bookingDate);
  if (isOvernight) {
    calculatedEndDate.setDate(calculatedEndDate.getDate() + 1);
  }

  const isMember = bookingUser.membershipLevel !== 'basic';
  const isVip = bookingUser.membershipLevel === 'vip';
  const phoneRaw = bookingUser.phone ? String(bookingUser.phone).replace(/\D/g, '') : '';
  const players = [
    {
      name: bookingUser.name || '教練',
      email: bookingUser.email || 'coach@picklevibes.local',
      phone: phoneRaw.length >= 8 ? phoneRaw : '00000000'
    }
  ];
  const totalPlayers = 1;

  const tempBooking = new Booking({
    user: userId,
    court: courtId,
    date: bookingDate,
    endDate: calculatedEndDate,
    startTime,
    endTime,
    duration,
    players,
    totalPlayers,
    specialRequests: specialRequests || ''
  });
  tempBooking.calculatePrice(courtDoc, isMember);
  let pointsToDeduct = Math.round(tempBooking.pricing.totalPrice);
  if (isVip) {
    pointsToDeduct = Math.round(pointsToDeduct * 0.8);
  }

  const bypassRestrictions = true;
  const userObjectId =
    typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  const courtObjectId =
    typeof courtId === 'string' ? new mongoose.Types.ObjectId(courtId) : courtId;

  const bookingData = {
    user: userObjectId,
    court: courtObjectId,
    date: bookingDate,
    endDate: calculatedEndDate,
    startTime,
    endTime,
    duration,
    players,
    totalPlayers,
    specialRequests: specialRequests || '',
    includeSoloCourt: false,
    bypassRestrictions,
    noUserBalanceDebited: true,
    status: 'confirmed',
    payment: {
      status: 'paid',
      paidAt: new Date(),
      method: 'admin_waived',
      pointsDeducted: 0,
      originalPrice: tempBooking.pricing.totalPrice,
      discount: isVip ? 20 : 0
    },
    pricing: {
      basePrice: tempBooking.pricing.basePrice,
      memberDiscount: tempBooking.pricing.memberDiscount,
      totalPrice: pointsToDeduct,
      originalPrice: tempBooking.pricing.totalPrice,
      pointsDeducted: 0,
      vipDiscount: isVip
        ? Math.round(tempBooking.pricing.totalPrice * 0.2)
        : 0,
      soloCourtFee: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await Booking.collection.insertOne(bookingData);
  const booking = await Booking.findById(result.insertedId);
  await booking.populate('court', 'name number type amenities');
  return booking;
}

module.exports = { createAdminBypassBooking };
