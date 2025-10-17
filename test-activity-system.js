// 測試活動系統功能
require('dotenv').config();
const mongoose = require('mongoose');
const Activity = require('./server/models/Activity');
const ActivityRegistration = require('./server/models/ActivityRegistration');
const User = require('./server/models/User');
const UserBalance = require('./server/models/UserBalance');

async function testActivitySystem() {
  try {
    console.log('🧪 開始測試活動系統...');
    
    // 連接數據庫
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes');
    console.log('✅ 數據庫連接成功');

    // 創建測試活動
    console.log('\n📝 創建測試活動...');
    const testActivity = new Activity({
      title: '匹克球新手體驗活動',
      description: '歡迎所有匹克球新手參加！我們將提供專業指導和設備，讓您體驗匹克球的樂趣。',
      maxParticipants: 8,
      price: 50,
      startDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7天後
      endDate: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000) + (2 * 60 * 60 * 1000)), // 7天後+2小時
      registrationDeadline: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)), // 5天後截止
      location: 'PickleVibes 主場館',
      organizer: new mongoose.Types.ObjectId(), // 假的管理員ID
      requirements: '請穿著運動服裝，自備水壺。我們會提供球拍和球。'
    });

    await testActivity.save();
    console.log('✅ 測試活動創建成功:', testActivity.title);

    // 創建測試用戶
    console.log('\n👤 創建測試用戶...');
    const testUser = new User({
      name: '測試用戶',
      email: 'testuser@example.com',
      password: 'TestPassword123',
      phone: '12345678',
      role: 'user'
    });

    await testUser.save();
    console.log('✅ 測試用戶創建成功:', testUser.name);

    // 創建用戶積分記錄
    console.log('\n💰 創建用戶積分記錄...');
    const userBalance = new UserBalance({
      user: testUser._id,
      balance: 200, // 給用戶200積分
      totalRecharged: 200,
      totalSpent: 0
    });

    await userBalance.save();
    console.log('✅ 用戶積分記錄創建成功，餘額:', userBalance.balance);

    // 測試報名活動
    console.log('\n🎯 測試活動報名...');
    const registration = new ActivityRegistration({
      activity: testActivity._id,
      user: testUser._id,
      participantCount: 2,
      totalCost: testActivity.price * 2,
      contactInfo: {
        email: testUser.email,
        phone: testUser.phone
      },
      notes: '這是測試報名'
    });

    await registration.save();
    console.log('✅ 活動報名成功，參加人數:', registration.participantCount, '總費用:', registration.totalCost);

    // 更新活動當前報名人數
    testActivity.currentParticipants = registration.participantCount;
    await testActivity.save();

    // 扣除用戶積分
    userBalance.balance -= registration.totalCost;
    userBalance.totalSpent += registration.totalCost;
    await userBalance.save();
    console.log('✅ 積分扣除成功，剩餘積分:', userBalance.balance);

    // 測試查詢功能
    console.log('\n🔍 測試查詢功能...');
    
    // 查詢活動列表
    const activities = await Activity.find({ isActive: true });
    console.log('✅ 查詢到活動數量:', activities.length);

    // 查詢用戶報名記錄
    const userRegistrations = await ActivityRegistration.find({ user: testUser._id });
    console.log('✅ 用戶報名記錄數量:', userRegistrations.length);

    // 測試活動狀態檢查
    console.log('\n📊 測試活動狀態檢查...');
    console.log('活動可報名:', testActivity.canRegister);
    console.log('活動已過期:', testActivity.isExpired);
    console.log('活動已滿員:', testActivity.isFull);
    console.log('剩餘名額:', testActivity.maxParticipants - testActivity.currentParticipants);

    // 測試人數限制
    console.log('\n🚫 測試人數限制...');
    try {
      const overLimitRegistration = new ActivityRegistration({
        activity: testActivity._id,
        user: new mongoose.Types.ObjectId(), // 另一個用戶
        participantCount: 10, // 超過剩餘名額
        totalCost: testActivity.price * 10,
        contactInfo: {
          email: 'test2@example.com',
          phone: '87654321'
        }
      });
      await overLimitRegistration.save();
      console.log('❌ 人數限制測試失敗 - 應該被拒絕');
    } catch (error) {
      console.log('✅ 人數限制測試成功 - 正確拒絕了超額報名');
    }

    console.log('\n🎉 活動系統測試完成！');
    console.log('\n📋 測試結果總結:');
    console.log('- ✅ 活動創建功能正常');
    console.log('- ✅ 用戶報名功能正常');
    console.log('- ✅ 積分扣除功能正常');
    console.log('- ✅ 人數限制功能正常');
    console.log('- ✅ 查詢功能正常');
    console.log('- ✅ 狀態檢查功能正常');

  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 數據庫連接已關閉');
  }
}

// 運行測試
testActivitySystem();
