const mongoose = require('mongoose');
const Court = require('../models/Court');

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function updateCourtsFacilities() {
  try {
    console.log('開始更新場地設施...');

    // 更新所有場地的設施，只保留空調、照明、淋浴設施
    const courts = await Court.find();
    
    for (const court of courts) {
      await Court.findByIdAndUpdate(
        court._id,
        {
          amenities: ['air_conditioning', 'lighting', 'shower']
        },
        { new: true }
      );
      console.log(`✅ ${court.name} 設施更新完成`);
    }

    console.log('🎉 所有場地設施更新完成！');
    
    // 顯示更新後的場地
    const updatedCourts = await Court.find().sort({ number: 1 });
    console.log('\n📋 更新後的場地設施:');
    updatedCourts.forEach(court => {
      console.log(`- ${court.name}: ${court.amenities.join(', ')}`);
    });

  } catch (error) {
    console.error('❌ 更新場地設施時發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

// 執行更新
updateCourtsFacilities();
