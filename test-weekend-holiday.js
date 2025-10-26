const mongoose = require('mongoose');
const Court = require('./server/models/Court');
const weekendService = require('./server/services/weekendService');

// 連接資料庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testWeekendHoliday() {
  try {
    console.log('🧪 測試國定假日功能...\n');

    // 測試日期
    const testDates = [
      { date: '2024-10-30', description: '重陽節 (國定假日)' },
      { date: '2024-10-29', description: '重陽節前一天 (平日)' },
      { date: '2024-10-31', description: '重陽節後一天 (平日)' },
      { date: '2024-12-25', description: '聖誕節 (國定假日)' },
      { date: '2024-12-24', description: '平安夜 (平日)' }
    ];

    // 獲取一個場地進行測試
    const court = await Court.findOne({ type: 'competition' });
    if (!court) {
      console.log('❌ 找不到測試場地');
      return;
    }

    console.log(`🏟️ 使用場地: ${court.name}`);
    console.log(`💰 場地價格設定:`);
    console.log(`   - 貓頭鷹時間: $${court.pricing.timeSlots.find(s => s.name === '貓頭鷹時間')?.price || 'N/A'}`);
    console.log(`   - 非繁忙時間: $${court.pricing.timeSlots.find(s => s.name === '非繁忙時間')?.price || 'N/A'}`);
    console.log(`   - 繁忙時間: $${court.pricing.timeSlots.find(s => s.name === '繁忙時間')?.price || 'N/A'}\n`);

    // 測試每個日期
    for (const test of testDates) {
      const testDate = new Date(test.date);
      console.log(`📅 ${test.description} (${test.date})`);
      
      // 檢查是否為週末/國定假日
      const isWeekend = weekendService.isWeekend(testDate);
      const isHoliday = weekendService.isHoliday(testDate);
      const weekendType = weekendService.getWeekendType(testDate);
      
      console.log(`   - 是否週末: ${isWeekend ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 是否國定假日: ${isHoliday ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 週末類型: ${weekendType}`);
      
      // 測試不同時間段的價格
      const timeSlots = ['08:00', '14:00', '20:00', '02:00'];
      console.log(`   - 價格測試:`);
      
      for (const time of timeSlots) {
        const price = court.getPriceForTime(time, testDate);
        const timeSlotName = court.getTimeSlotName(time, testDate);
        console.log(`     ${time}: $${price} (${timeSlotName})`);
      }
      
      console.log('');
    }

    console.log('✅ 測試完成！');
    console.log('\n📋 總結:');
    console.log('- 國定假日會使用週末收費模式（繁忙時間價格）');
    console.log('- 平日國定假日：08:00-24:00 使用繁忙時間價格');
    console.log('- 國定假日深夜：00:00-08:00 使用貓頭鷹時間價格');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    mongoose.connection.close();
  }
}

testWeekendHoliday();
