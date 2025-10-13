require('dotenv').config();
const mongoose = require('mongoose');
const Court = require('./server/models/Court');
const Booking = require('./server/models/Booking');

async function checkAdminBookings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 數據庫連接成功\n');

    // 查找所有管理員創建的預約（bypassRestrictions = true）
    const adminBookings = await Booking.find({ 
      bypassRestrictions: true 
    })
    .select('court date startTime endTime status bypassRestrictions')
    .populate('court', 'name')
    .sort({ date: -1, startTime: 1 })
    .limit(10);

    console.log(`📊 找到 ${adminBookings.length} 條管理員創建的預約：\n`);

    adminBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.court.name}`);
      console.log(`   日期: ${booking.date.toISOString().split('T')[0]}`);
      console.log(`   時間: ${booking.startTime} - ${booking.endTime}`);
      console.log(`   狀態: ${booking.status}`);
      console.log(`   bypassRestrictions: ${booking.bypassRestrictions}`);
      console.log('');
    });

    // 測試時間衝突檢查
    if (adminBookings.length > 0) {
      const testBooking = adminBookings[0];
      console.log('\n🔍 測試時間衝突檢查：');
      console.log(`場地: ${testBooking.court._id}`);
      console.log(`日期: ${testBooking.date.toISOString().split('T')[0]}`);
      console.log(`時間: ${testBooking.startTime} - ${testBooking.endTime}\n`);

      const hasConflict = await Booking.checkTimeConflict(
        testBooking.court._id,
        testBooking.date,
        testBooking.startTime,
        testBooking.endTime,
        testBooking._id
      );

      console.log(`衝突檢查結果: ${hasConflict ? '❌ 有衝突' : '✅ 無衝突'}`);
    }

    await mongoose.disconnect();
    console.log('\n✅ 數據庫連接已關閉');
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

checkAdminBookings();

