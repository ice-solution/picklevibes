const mongoose = require('mongoose');
const weekendService = require('./server/services/weekendService');

// 連接資料庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function addHoliday() {
  try {
    const holiday = process.argv[2];
    
    if (!holiday) {
      console.log('❌ 請提供國定假日日期');
      console.log('使用方法: node add-holiday.js 2024-10-30');
      return;
    }

    // 驗證日期格式
    const date = new Date(holiday);
    if (isNaN(date.getTime())) {
      console.log('❌ 日期格式不正確，請使用 YYYY-MM-DD 格式');
      return;
    }

    console.log(`📅 添加國定假日: ${holiday}`);
    
    // 添加國定假日
    await weekendService.initialize();
    await weekendService.addHolidays([holiday]);
    
    console.log('✅ 國定假日添加成功！');
    console.log(`📋 當前國定假日列表:`);
    weekendService.config.holidays.forEach(h => console.log(`   - ${h}`));
    
    // 測試該日期是否會被識別為週末
    const isWeekend = weekendService.isWeekend(date);
    const isHoliday = weekendService.isHoliday(date);
    const weekendType = weekendService.getWeekendType(date);
    
    console.log(`\n🧪 測試結果:`);
    console.log(`   - 是否週末: ${isWeekend ? '✅ 是' : '❌ 否'}`);
    console.log(`   - 是否國定假日: ${isHoliday ? '✅ 是' : '❌ 否'}`);
    console.log(`   - 週末類型: ${weekendType}`);
    
    if (isWeekend) {
      console.log(`\n💰 收費模式: 該日期將使用週末收費模式（繁忙時間價格）`);
    }

  } catch (error) {
    console.error('❌ 添加國定假日失敗:', error);
  } finally {
    mongoose.connection.close();
  }
}

addHoliday();
