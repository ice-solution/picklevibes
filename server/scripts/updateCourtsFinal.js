const mongoose = require('mongoose');
const Court = require('../models/Court');

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateCourtsFinal() {
  try {
    console.log('開始更新場地數據...');

    // 更新 A場 - 比賽場
    await Court.findOneAndUpdate(
      { number: 1 },
      {
        name: 'A場 - 比賽場',
        type: 'competition',
        description: '專業比賽場地，適合正式比賽和訓練',
        capacity: 8,
        amenities: ['air_conditioning', 'lighting', 'shower'],
        operatingHours: {
          monday: { start: '00:00', end: '24:00', isOpen: true },
          tuesday: { start: '00:00', end: '24:00', isOpen: true },
          wednesday: { start: '00:00', end: '24:00', isOpen: true },
          thursday: { start: '00:00', end: '24:00', isOpen: true },
          friday: { start: '00:00', end: '24:00', isOpen: true },
          saturday: { start: '00:00', end: '24:00', isOpen: true },
          sunday: { start: '00:00', end: '24:00', isOpen: true }
        },
        pricing: {
          peakHour: 80, // 繁忙時間
          offPeak: 60,  // 非繁忙時間
          memberDiscount: 0,
          timeSlots: [
            { startTime: '00:00', endTime: '07:00', price: 80, name: '貓頭鷹時間' },
            { startTime: '07:00', endTime: '16:00', price: 60, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 80, name: '繁忙時間' },
            { startTime: '23:00', endTime: '24:00', price: 80, name: '貓頭鷹時間' }
          ]
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ A場 - 比賽場 更新完成');

    // 更新 B場 - 訓練場
    await Court.findOneAndUpdate(
      { number: 2 },
      {
        name: 'B場 - 訓練場',
        type: 'training',
        description: '專業訓練場地，適合個人和團體訓練',
        capacity: 6,
        amenities: ['air_conditioning', 'lighting', 'shower'],
        operatingHours: {
          monday: { start: '00:00', end: '24:00', isOpen: true },
          tuesday: { start: '00:00', end: '24:00', isOpen: true },
          wednesday: { start: '00:00', end: '24:00', isOpen: true },
          thursday: { start: '00:00', end: '24:00', isOpen: true },
          friday: { start: '00:00', end: '24:00', isOpen: true },
          saturday: { start: '00:00', end: '24:00', isOpen: true },
          sunday: { start: '00:00', end: '24:00', isOpen: true }
        },
        pricing: {
          peakHour: 70, // 繁忙時間
          offPeak: 50,  // 非繁忙時間
          memberDiscount: 0,
          timeSlots: [
            { startTime: '00:00', endTime: '07:00', price: 70, name: '貓頭鷹時間' },
            { startTime: '07:00', endTime: '16:00', price: 50, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 70, name: '繁忙時間' },
            { startTime: '23:00', endTime: '24:00', price: 70, name: '貓頭鷹時間' }
          ]
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ B場 - 訓練場 更新完成');

    // 更新 C場 - 單人場
    await Court.findOneAndUpdate(
      { number: 3 },
      {
        name: 'C場 - 單人場',
        type: 'solo',
        description: '單人練習場地，適合個人訓練和練習',
        capacity: 4,
        amenities: ['air_conditioning', 'lighting', 'shower'],
        operatingHours: {
          monday: { start: '08:00', end: '23:00', isOpen: true },
          tuesday: { start: '08:00', end: '23:00', isOpen: true },
          wednesday: { start: '08:00', end: '23:00', isOpen: true },
          thursday: { start: '08:00', end: '23:00', isOpen: true },
          friday: { start: '08:00', end: '23:00', isOpen: true },
          saturday: { start: '08:00', end: '23:00', isOpen: true },
          sunday: { start: '08:00', end: '23:00', isOpen: true }
        },
        pricing: {
          peakHour: 60, // 繁忙時間
          offPeak: 40,  // 非繁忙時間
          memberDiscount: 0,
          timeSlots: [
            { startTime: '08:00', endTime: '16:00', price: 40, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 60, name: '繁忙時間' }
          ]
        }
      },
      { upsert: true, new: true }
    );
    console.log('✅ C場 - 單人場 更新完成');

    console.log('🎉 所有場地數據更新完成！');
    
    // 顯示更新後的場地
    const courts = await Court.find().sort({ number: 1 });
    console.log('\n📋 更新後的場地列表:');
    courts.forEach(court => {
      console.log(`- ${court.name} (${court.type}) - ${court.capacity}人`);
      console.log(`  設施: [${court.amenities.join(', ')}]`);
      console.log(`  營業時間: ${court.operatingHours.monday.start}-${court.operatingHours.monday.end}`);
      console.log(`  價格: ${court.pricing.offPeak}-${court.pricing.peakHour} 積分/小時\n`);
    });

  } catch (error) {
    console.error('❌ 更新場地數據時發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

// 執行更新
updateCourtsFinal();
