require('dotenv').config();
const mongoose = require('mongoose');
const Court = require('./server/models/Court');
const Booking = require('./server/models/Booking');

async function testConflictDetection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    // 測試的場地和時間
    const courtId = '68e230e6144bd265e244a370'; // 比賽場
    const date = '2025-10-20';
    const testTimeSlots = [
      { startTime: '01:00', endTime: '02:00' }, // 應該可用（在管理員預約之前）
      { startTime: '02:00', endTime: '04:00' }, // 應該衝突（與管理員預約重疊）
      { startTime: '03:00', endTime: '05:00' }, // 應該衝突（與管理員預約重疊）
      { startTime: '06:00', endTime: '08:00' }, // 應該衝突（與管理員預約重疊）
      { startTime: '08:00', endTime: '10:00' }, // 應該可用（在管理員預約之後）
    ];

    console.log(`🔍 測試場地: 比賽場 (${courtId})`);
    console.log(`📅 測試日期: ${date}`);
    console.log(`⏰ 管理員預約時間: 02:00 - 08:00\n`);

    for (const slot of testTimeSlots) {
      const hasConflict = await Booking.checkTimeConflict(
        courtId,
        date,
        slot.startTime,
        slot.endTime
      );

      const icon = hasConflict ? '❌' : '✅';
      const status = hasConflict ? '衝突（已預約）' : '可用';
      console.log(`${icon} ${slot.startTime} - ${slot.endTime}: ${status}`);
    }

    // 直接查詢數據庫確認 - 方式1
    console.log('\n📊 直接查詢數據庫確認（方式1: new Date）：');
    const bookings1 = await Booking.find({
      court: courtId,
      date: new Date(date),
      status: { $in: ['confirmed', 'pending'] }
    }).select('startTime endTime status court');

    console.log(`找到 ${bookings1.length} 條預約：`);
    bookings1.forEach(b => {
      console.log(`  - ${b.startTime} - ${b.endTime} (${b.status}), court: ${b.court}`);
    });

    // 直接查詢數據庫確認 - 方式2（不篩選場地）
    console.log('\n📊 直接查詢數據庫確認（方式2: 不篩選場地）：');
    const bookings2 = await Booking.find({
      date: new Date(date),
      status: { $in: ['confirmed', 'pending'] }
    }).select('startTime endTime status court');

    console.log(`找到 ${bookings2.length} 條預約：`);
    bookings2.forEach(b => {
      console.log(`  - ${b.startTime} - ${b.endTime} (${b.status}), court: ${b.court}`);
    });

    // 檢查 courtId 類型
    console.log('\n🔍 Court ID 檢查：');
    console.log(`courtId (字符串): ${courtId}`);
    console.log(`courtId 類型: ${typeof courtId}`);
    const courtObjectId = new mongoose.Types.ObjectId(courtId);
    console.log(`courtId (ObjectId): ${courtObjectId}`);
    console.log(`是否相等: ${courtId === courtObjectId.toString()}`);

    await mongoose.disconnect();
    console.log('\n✅ 測試完成，數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

testConflictDetection();

