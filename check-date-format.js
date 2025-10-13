require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('./server/models/Booking');

async function checkDateFormat() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    // 查找最近的幾條預約
    const bookings = await Booking.find({ bypassRestrictions: true })
      .select('court date startTime endTime status')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📊 找到 ${bookings.length} 條管理員預約：\n`);

    bookings.forEach((booking, index) => {
      console.log(`${index + 1}. ID: ${booking._id}`);
      console.log(`   date 字段類型: ${typeof booking.date}`);
      console.log(`   date 值: ${booking.date}`);
      console.log(`   date ISO: ${booking.date.toISOString()}`);
      console.log(`   date 日期部分: ${booking.date.toISOString().split('T')[0]}`);
      console.log(`   startTime: ${booking.startTime}`);
      console.log(`   endTime: ${booking.endTime}`);
      console.log(`   status: ${booking.status}\n`);
    });

    // 測試不同的日期查詢方式
    const testDate = '2025-10-20';
    console.log(`🔍 測試查詢日期 "${testDate}"：\n`);

    // 方式1: 直接使用字符串
    const result1 = await Booking.find({
      date: testDate,
      status: { $in: ['confirmed', 'pending'] }
    });
    console.log(`方式1 (直接字符串): ${result1.length} 條`);

    // 方式2: new Date()
    const result2 = await Booking.find({
      date: new Date(testDate),
      status: { $in: ['confirmed', 'pending'] }
    });
    console.log(`方式2 (new Date()): ${result2.length} 條`);

    // 方式3: 日期範圍
    const startOfDay = new Date(testDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(testDate);
    endOfDay.setHours(23, 59, 59, 999);

    const result3 = await Booking.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    });
    console.log(`方式3 (日期範圍): ${result3.length} 條`);

    await mongoose.disconnect();
    console.log('\n✅ 數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

checkDateFormat();

