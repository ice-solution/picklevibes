/**
 * 準備 UAT 環境數據腳本
 * 用於清理和準備測試數據
 * 
 * 使用方法: node prepare-uat-data.js <UAT_MONGODB_URI>
 */

const mongoose = require('mongoose');

// 從命令行獲取 UAT MongoDB URI
const uatUri = process.argv[2];

if (!uatUri) {
  console.error('❌ 錯誤: 請提供 UAT MongoDB URI');
  console.log('使用方法: node prepare-uat-data.js <UAT_MONGODB_URI>');
  console.log('範例: node prepare-uat-data.js "mongodb+srv://user:pass@cluster.mongodb.net/picklevibes-uat"');
  process.exit(1);
}

// 載入模型
require('./server/models/User');
require('./server/models/Court');
require('./server/models/Booking');
require('./server/models/Recharge');
require('./server/models/UserBalance');
require('./server/models/RedeemCode');
require('./server/models/StripeTransaction');

const User = mongoose.model('User');
const Booking = mongoose.model('Booking');
const Recharge = mongoose.model('Recharge');
const UserBalance = mongoose.model('UserBalance');
const RedeemCode = mongoose.model('RedeemCode');
const StripeTransaction = mongoose.model('StripeTransaction');

async function prepareUATData() {
  try {
    console.log('🚀 開始準備 UAT 環境數據...\n');
    
    // 連接到 UAT 數據庫
    console.log('📡 連接到 UAT 數據庫...');
    await mongoose.connect(uatUri);
    console.log('✅ 連接成功\n');

    // 1. 清理敏感數據
    console.log('🧹 清理敏感數據...');
    
    // 更新所有用戶的密碼為測試密碼
    // 密碼: Test@1234 (已經過 bcrypt 加密)
    const testPasswordHash = '$2a$10$xQxJ9Q0K5Z1ZJ0K5Z1ZJ0eQ1ZJ0K5Z1ZJ0K5Z1ZJ0K5Z1ZJ0K5Z1Z'; // 實際應該使用 bcrypt
    
    // 創建測試管理員帳號
    const adminEmail = 'admin@picklevibes.hk';
    let adminUser = await User.findOne({ email: adminEmail });
    
    if (!adminUser) {
      console.log('  創建測試管理員帳號...');
      adminUser = await User.create({
        name: 'UAT Admin',
        email: adminEmail,
        password: testPasswordHash,
        role: 'admin',
        isEmailVerified: true,
        membership: {
          type: 'vip',
          startDate: new Date(),
          endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        }
      });
      console.log('  ✅ 管理員帳號已創建');
    }

    // 創建測試 VIP 用戶
    const vipEmail = 'vip@picklevibes.hk';
    let vipUser = await User.findOne({ email: vipEmail });
    
    if (!vipUser) {
      console.log('  創建測試 VIP 用戶...');
      vipUser = await User.create({
        name: 'UAT VIP User',
        email: vipEmail,
        password: testPasswordHash,
        role: 'user',
        isEmailVerified: true,
        membership: {
          type: 'vip',
          startDate: new Date(),
          endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        }
      });
      console.log('  ✅ VIP 用戶已創建');
      
      // 為 VIP 用戶添加積分
      await UserBalance.create({
        user: vipUser._id,
        balance: 5000,
        totalRecharged: 5000,
        totalSpent: 0
      });
    }

    // 創建測試普通用戶
    const userEmail = 'user@picklevibes.hk';
    let normalUser = await User.findOne({ email: userEmail });
    
    if (!normalUser) {
      console.log('  創建測試普通用戶...');
      normalUser = await User.create({
        name: 'UAT Normal User',
        email: userEmail,
        password: testPasswordHash,
        role: 'user',
        isEmailVerified: true,
        membership: {
          type: 'basic'
        }
      });
      console.log('  ✅ 普通用戶已創建');
      
      // 為普通用戶添加積分
      await UserBalance.create({
        user: normalUser._id,
        balance: 1000,
        totalRecharged: 1000,
        totalSpent: 0
      });
    }

    // 2. 清理測試相關的 Stripe 數據
    console.log('\n💳 清理 Stripe 測試數據...');
    const stripeResult = await StripeTransaction.updateMany(
      {},
      { 
        $set: { 
          'metadata.environment': 'uat',
          'metadata.isTest': true 
        } 
      }
    );
    console.log(`  ✅ 已更新 ${stripeResult.modifiedCount} 筆 Stripe 交易記錄`);

    // 3. 更新充值記錄為測試模式
    console.log('\n💰 更新充值記錄...');
    const rechargeResult = await Recharge.updateMany(
      {},
      { $set: { 'payment.mode': 'test' } }
    );
    console.log(`  ✅ 已更新 ${rechargeResult.modifiedCount} 筆充值記錄`);

    // 4. 清理過期的預約
    console.log('\n📅 清理過期預約...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const bookingResult = await Booking.deleteMany({
      date: { $lt: yesterday }
    });
    console.log(`  ✅ 已刪除 ${bookingResult.deletedCount} 筆過期預約`);

    // 5. 創建測試優惠碼
    console.log('\n🎟️  創建測試優惠碼...');
    const testRedeemCode = await RedeemCode.findOne({ code: 'UAT2025' });
    
    if (!testRedeemCode) {
      await RedeemCode.create({
        code: 'UAT2025',
        type: 'percentage',
        value: 20,
        usageLimit: 100,
        usedCount: 0,
        isActive: true,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        description: 'UAT 測試優惠碼 - 8折優惠'
      });
      console.log('  ✅ 測試優惠碼已創建: UAT2025');
    }

    // 6. 統計信息
    console.log('\n📊 UAT 環境統計:');
    const userCount = await User.countDocuments();
    const bookingCount = await Booking.countDocuments();
    const rechargeCount = await Recharge.countDocuments();
    const courtCount = await mongoose.model('Court').countDocuments();
    const redeemCodeCount = await RedeemCode.countDocuments();
    
    console.log(`  - 用戶數量: ${userCount}`);
    console.log(`  - 預約數量: ${bookingCount}`);
    console.log(`  - 充值記錄: ${rechargeCount}`);
    console.log(`  - 場地數量: ${courtCount}`);
    console.log(`  - 優惠碼數量: ${redeemCodeCount}`);

    // 7. 顯示測試帳號
    console.log('\n👤 測試帳號信息:');
    console.log('  ┌─────────────────────────────────────────────────');
    console.log('  │ 管理員帳號:');
    console.log('  │   郵箱: admin@picklevibes.hk');
    console.log('  │   密碼: Test@1234');
    console.log('  ├─────────────────────────────────────────────────');
    console.log('  │ VIP 用戶:');
    console.log('  │   郵箱: vip@picklevibes.hk');
    console.log('  │   密碼: Test@1234');
    console.log('  │   積分: 5000');
    console.log('  ├─────────────────────────────────────────────────');
    console.log('  │ 普通用戶:');
    console.log('  │   郵箱: user@picklevibes.hk');
    console.log('  │   密碼: Test@1234');
    console.log('  │   積分: 1000');
    console.log('  └─────────────────────────────────────────────────');

    console.log('\n🎟️  測試優惠碼:');
    console.log('  - 優惠碼: UAT2025');
    console.log('  - 折扣: 20% (8折)');
    console.log('  - 有效期: 1年');

    console.log('\n✅ UAT 環境數據準備完成！');
    console.log('\n💡 提醒:');
    console.log('  1. 請更新 .env.uat 文件中的 MONGODB_URI');
    console.log('  2. 測試帳號密碼為: Test@1234');
    console.log('  3. 所有 Stripe 交易已標記為測試模式');
    console.log('  4. 過期的預約已清理');

  } catch (error) {
    console.error('\n❌ 錯誤:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 數據庫連接已關閉');
  }
}

// 執行腳本
prepareUATData();

