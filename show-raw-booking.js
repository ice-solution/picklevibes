require('dotenv').config();
const mongoose = require('mongoose');

async function showRawBooking() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // 直接從集合中查詢原始數據
    const rawBookings = await bookingsCollection.find({
      bypassRestrictions: true
    }).toArray();

    console.log(`📊 找到 ${rawBookings.length} 條管理員預約：\n`);

    rawBookings.forEach((booking, index) => {
      console.log(`預約 ${index + 1}:`);
      console.log('  _id:', booking._id);
      console.log('  court:', booking.court);
      console.log('  court 類型:', typeof booking.court);
      console.log('  date:', booking.date);
      console.log('  date 類型:', typeof booking.date);
      console.log('  startTime:', booking.startTime);
      console.log('  endTime:', booking.endTime);
      console.log('  status:', booking.status);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ 數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

showRawBooking();

