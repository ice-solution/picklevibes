const mongoose = require('mongoose');
const Court = require('../models/Court');

// 使用正確的 MongoDB Atlas 連接
const MONGODB_URI = 'mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/picklevibes';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateCourtsPricing() {
  try {
    console.log('開始更新場地價格...');

    // 更新 A場 - 比賽場
    await Court.findOneAndUpdate(
      { number: 1 },
      {
        pricing: {
          peakHour: 600,    // 繁忙時間: $600/HR
          offPeak: 380,     // 非繁忙時間: $380/HR
          memberDiscount: 0,
          timeSlots: [
            { startTime: '00:00', endTime: '07:00', price: 320, name: '貓頭鷹時間' },
            { startTime: '07:00', endTime: '16:00', price: 380, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 600, name: '繁忙時間' },
            { startTime: '23:00', endTime: '24:00', price: 320, name: '貓頭鷹時間' }
          ]
        }
      },
      { new: true }
    );
    console.log('✅ A場 - 比賽場 價格更新完成');
    
    // 更新 B場 - 訓練場
    await Court.findOneAndUpdate(
      { number: 2 },
      {
        pricing: {
          peakHour: 380,    // 繁忙時間: $380/HR
          offPeak: 320,     // 非繁忙時間: $320/HR
          memberDiscount: 0,
          timeSlots: [
            { startTime: '00:00', endTime: '07:00', price: 250, name: '貓頭鷹時間' },
            { startTime: '07:00', endTime: '16:00', price: 320, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 380, name: '繁忙時間' },
            { startTime: '23:00', endTime: '24:00', price: 250, name: '貓頭鷹時間' }
          ]
        }
      },
      { new: true }
    );
    console.log('✅ B場 - 訓練場 價格更新完成');
    
    // 更新 C場 - 單人場
    await Court.findOneAndUpdate(
      { number: 3 },
      {
        pricing: {
          peakHour: 380,    // 繁忙時間: $380/HR
          offPeak: 250,     // 非繁忙時間: $250/HR
          memberDiscount: 0,
          timeSlots: [
            { startTime: '08:00', endTime: '16:00', price: 250, name: '非繁忙時間' },
            { startTime: '16:00', endTime: '23:00', price: 380, name: '繁忙時間' }
          ]
        }
      },
      { new: true }
    );
    console.log('✅ C場 - 單人場 價格更新完成');
    
    const allCourts = await Court.find().sort({ number: 1 });
    console.log('\n📋 更新後的場地價格:');
    allCourts.forEach(court => {
      console.log(`- ${court.name}:`);
      console.log(`  非繁忙時間: ${court.pricing.offPeak} 積分/小時`);
      console.log(`  繁忙時間: ${court.pricing.peakHour} 積分/小時`);
      if (court.pricing.timeSlots && court.pricing.timeSlots.length > 0) {
        const owlTime = court.pricing.timeSlots.find(slot => slot.name === '貓頭鷹時間');
        if (owlTime) {
          console.log(`  貓頭鷹時間: ${owlTime.price} 積分/小時`);
        }
      }
      console.log('');
    });
    
    console.log('🎉 所有場地價格更新完成！');

  } catch (error) {
    console.error('❌ 更新場地價格時發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

// 執行更新
updateCourtsPricing();
