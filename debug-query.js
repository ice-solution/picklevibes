require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./server/models/Booking');

async function debugQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    const courtId = '68e230e6144bd265e244a370';
    const date = '2025-10-20';
    const startTime = '02:00';
    const endTime = '04:00';

    // 模擬 checkTimeConflict 內部的查詢
    const bookingDate = new Date(date);
    const courtObjectId = new mongoose.Types.ObjectId(courtId);

    console.log('🔍 查詢參數：');
    console.log(`courtId (ObjectId): ${courtObjectId}`);
    console.log(`bookingDate: ${bookingDate}`);
    console.log(`bookingDate ISO: ${bookingDate.toISOString()}\n`);

    const query = {
      court: courtObjectId,
      status: { $in: ['confirmed', 'pending'] },
      $or: [
        { date: bookingDate },
        { date: bookingDate }
      ]
    };

    console.log('📝 查詢條件：', JSON.stringify(query, null, 2), '\n');

    const conflictingBookings = await Booking.find(query);
    
    console.log(`📊 查詢結果: 找到 ${conflictingBookings.length} 條預約`);
    
    conflictingBookings.forEach((booking, index) => {
      console.log(`\n預約 ${index + 1}:`);
      console.log(`  ID: ${booking._id}`);
      console.log(`  Court: ${booking.court}`);
      console.log(`  Date: ${booking.date}`);
      console.log(`  Date ISO: ${booking.date.toISOString()}`);
      console.log(`  Start: ${booking.startTime}`);
      console.log(`  End: ${booking.endTime}`);
      console.log(`  Status: ${booking.status}`);
    });

    await mongoose.disconnect();
    console.log('\n✅ 數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

debugQuery();

