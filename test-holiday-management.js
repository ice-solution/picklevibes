const mongoose = require('mongoose');
const weekendService = require('./server/services/weekendService');

// 連接資料庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testHolidayManagement() {
  try {
    console.log('🧪 測試國定假日管理功能...\n');

    // 測試不同地區的節日
    const testDates = [
      { date: '2024-10-30', description: '重陽節 (香港)', region: 'hongkong' },
      { date: '2024-10-10', description: '國慶日 (台灣)', region: 'taiwan' },
      { date: '2024-08-09', description: '國慶日 (新加坡)', region: 'singapore' },
      { date: '2024-12-25', description: '聖誕節 (全球)', region: 'global' },
      { date: '2024-10-29', description: '平日', region: 'weekday' }
    ];

    console.log('📅 測試不同日期的週末判定:');
    console.log('=' .repeat(60));
    
    for (const test of testDates) {
      const testDate = new Date(test.date);
      const isWeekend = weekendService.isWeekend(testDate);
      const isHoliday = weekendService.isHoliday(testDate);
      const weekendType = weekendService.getWeekendType(testDate);
      
      console.log(`\n📅 ${test.description} (${test.date})`);
      console.log(`   - 地區: ${test.region}`);
      console.log(`   - 是否週末: ${isWeekend ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 是否國定假日: ${isHoliday ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 週末類型: ${weekendType}`);
      
      if (isWeekend) {
        console.log(`   💰 收費模式: 週末收費模式 (繁忙時間價格)`);
      } else {
        console.log(`   💰 收費模式: 平日收費模式`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 當前國定假日列表:');
    weekendService.config.holidays.forEach(holiday => {
      const date = new Date(holiday);
      const dayName = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
      console.log(`   - ${holiday} (${dayName})`);
    });

    console.log('\n✅ 測試完成！');
    console.log('\n🎯 功能說明:');
    console.log('- 國定假日會自動使用週末收費模式');
    console.log('- 支援不同地區的節日模板');
    console.log('- 可以手動添加/移除特定節日');
    console.log('- 節日會按日期排序顯示');

  } catch (error) {
    console.error('❌ 測試失敗:', error);
  } finally {
    mongoose.connection.close();
  }
}

testHolidayManagement();
