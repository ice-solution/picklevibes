const mongoose = require('mongoose');
const Booking = require('./server/models/Booking');
const StripeTransaction = require('./server/models/StripeTransaction');

// 使用正確的 MongoDB 連接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://icesolution19:jLuZY1Lbi5UQNtyz@cluster0.nky9l.mongodb.net/picklevibes';

async function checkBookingStatus() {
  try {
    console.log('🔗 連接到數據庫...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ 數據庫連接成功');

    // 查找最近的預約
    const recentBookings = await Booking.find({})
      .populate('court', 'name')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\n📋 最近的預約記錄:');
    console.log('='.repeat(80));
    
    recentBookings.forEach((booking, index) => {
      console.log(`\n${index + 1}. 預約 ID: ${booking._id}`);
      console.log(`   場地: ${booking.court.name}`);
      console.log(`   用戶: ${booking.user.name} (${booking.user.email})`);
      console.log(`   日期: ${booking.date.toLocaleDateString('zh-TW')}`);
      console.log(`   時間: ${booking.startTime} - ${booking.endTime}`);
      console.log(`   預約狀態: ${booking.status}`);
      console.log(`   支付狀態: ${booking.payment.status}`);
      console.log(`   交易ID: ${booking.payment.transactionId || '無'}`);
      console.log(`   支付時間: ${booking.payment.paidAt ? booking.payment.paidAt.toLocaleString('zh-TW') : '未支付'}`);
      console.log(`   總價: HK$${booking.pricing.totalPrice}`);
    });

    // 查找待處理的預約
    const pendingBookings = await Booking.find({ status: 'pending' })
      .populate('court', 'name')
      .populate('user', 'name email');

    console.log('\n\n⏳ 待處理的預約:');
    console.log('='.repeat(80));
    
    if (pendingBookings.length === 0) {
      console.log('沒有待處理的預約');
    } else {
      pendingBookings.forEach((booking, index) => {
        console.log(`\n${index + 1}. ${booking.court.name} - ${booking.user.name}`);
        console.log(`   預約ID: ${booking._id}`);
        console.log(`   交易ID: ${booking.payment.transactionId || '無'}`);
        console.log(`   創建時間: ${booking.createdAt.toLocaleString('zh-TW')}`);
      });
    }

    // 查找交易記錄
    const transactions = await StripeTransaction.find({})
      .populate('booking')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log('\n\n💳 最近的交易記錄:');
    console.log('='.repeat(80));
    
    if (transactions.length === 0) {
      console.log('沒有交易記錄');
    } else {
      transactions.forEach((txn, index) => {
        console.log(`\n${index + 1}. 交易 ID: ${txn.paymentIntentId}`);
        console.log(`   預約ID: ${txn.booking?._id || '無'}`);
        console.log(`   金額: HK$${txn.amount / 100}`);
        console.log(`   狀態: ${txn.status}`);
        console.log(`   支付時間: ${txn.paidAt ? txn.paidAt.toLocaleString('zh-TW') : '未支付'}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 檢查完成');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}

checkBookingStatus();

