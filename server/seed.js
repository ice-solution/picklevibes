const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// 導入模型
const User = require('./models/User');
const Court = require('./models/Court');
const Booking = require('./models/Booking');

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function seedData() {
  try {
    console.log('🌱 開始種子數據...');

    // 清空現有數據
    await User.deleteMany({});
    await Court.deleteMany({});
    await Booking.deleteMany({});

    // 創建用戶 (密碼會在 User 模型的 pre('save') 中間件中自動哈希)
    const users = await User.create([
      {
        name: '張小明',
        email: 'zhang@example.com',
        password: 'password123',
        phone: '0912345678',
        role: 'user',
        membershipLevel: 'premium',
        preferences: {
          notifications: {
            email: true,
            sms: true
          },
          skillLevel: 'intermediate'
        }
      },
      {
        name: '李教練',
        email: 'coach@example.com',
        password: 'password123',
        phone: '0987654321',
        role: 'coach',
        membershipLevel: 'premium',
        preferences: {
          notifications: {
            email: true,
            sms: false
          },
          skillLevel: 'expert'
        }
      },
      {
        name: '管理員',
        email: 'admin@example.com',
        password: 'password123',
        phone: '0955555555',
        role: 'admin',
        membershipLevel: 'basic'
      }
    ]);

    console.log('✅ 用戶創建完成');

    // 創建場地
    const courts = await Court.create([
      {
        name: 'A場',
        number: 1,
        type: 'indoor',
        surface: 'synthetic',
        capacity: 8,
        amenities: ['air_conditioning', 'lighting', 'water', 'shower'],
        pricing: {
          // 使用舊的 peakHour/offPeak 結構，符合您的需求
          peakHour: 300,    // 高峰時段：週末全天 + 工作日 18:00-23:00
          offPeak: 200,     // 非高峰時段：其他時間
          memberDiscount: 20
        },
        operatingHours: {
          monday: { isOpen: true, start: '00:00', end: '24:00' },
          tuesday: { isOpen: true, start: '00:00', end: '24:00' },
          wednesday: { isOpen: true, start: '00:00', end: '24:00' },
          thursday: { isOpen: true, start: '00:00', end: '24:00' },
          friday: { isOpen: true, start: '00:00', end: '24:00' },
          saturday: { isOpen: true, start: '00:00', end: '24:00' },
          sunday: { isOpen: true, start: '00:00', end: '24:00' }
        },
        isActive: true,
        description: '室內空調場地，適合全天候使用'
      },
      {
        name: 'B場',
        number: 2,
        type: 'outdoor',
        surface: 'concrete',
        capacity: 8,
        amenities: ['lighting', 'water'],
        pricing: {
          // 使用舊的 peakHour/offPeak 結構，符合您的需求
          peakHour: 250,    // 高峰時段：週末全天 + 工作日 18:00-23:00
          offPeak: 150,     // 非高峰時段：其他時間
          memberDiscount: 15
        },
        operatingHours: {
          monday: { isOpen: true, start: '00:00', end: '24:00' },
          tuesday: { isOpen: true, start: '00:00', end: '24:00' },
          wednesday: { isOpen: true, start: '00:00', end: '24:00' },
          thursday: { isOpen: true, start: '00:00', end: '24:00' },
          friday: { isOpen: true, start: '00:00', end: '24:00' },
          saturday: { isOpen: true, start: '00:00', end: '24:00' },
          sunday: { isOpen: true, start: '00:00', end: '24:00' }
        },
        isActive: true,
        description: '戶外場地，自然光線充足'
      },
      {
        name: 'C場',
        number: 3,
        type: 'indoor',
        surface: 'wood',
        capacity: 6,
        amenities: ['air_conditioning', 'lighting', 'water', 'shower', 'paddles'],
        pricing: {
          // 使用舊的 peakHour/offPeak 結構，符合您的需求
          peakHour: 350,    // 高峰時段：週末全天 + 工作日 18:00-23:00
          offPeak: 250,     // 非高峰時段：其他時間
          memberDiscount: 25
        },
        operatingHours: {
          monday: { isOpen: true, start: '06:00', end: '23:00' },
          tuesday: { isOpen: true, start: '06:00', end: '23:00' },
          wednesday: { isOpen: true, start: '06:00', end: '23:00' },
          thursday: { isOpen: true, start: '06:00', end: '23:00' },
          friday: { isOpen: true, start: '06:00', end: '23:00' },
          saturday: { isOpen: true, start: '06:00', end: '23:00' },
          sunday: { isOpen: true, start: '06:00', end: '23:00' }
        },
        isActive: true,
        description: '高級木質地板場地，配備WiFi'
      }
    ]);

    console.log('✅ 場地創建完成');

    // 創建預約數據
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const bookings = await Booking.create([
      {
        user: users[0]._id,
        court: courts[0]._id,
        date: tomorrow,
        startTime: '09:00',
        endTime: '10:00',
        duration: 60,
        players: [
          { name: '張小明', email: 'zhang@example.com', phone: '0912345678' },
          { name: '王大明', email: 'wang@example.com', phone: '0923456789' }
        ],
        totalPlayers: 2,
        pricing: {
          basePrice: 200,
          memberDiscount: 20,
          totalPrice: 160
        },
        status: 'confirmed',
        payment: {
          status: 'paid',
          method: 'stripe',
          transactionId: 'txn_123456789',
          paidAt: new Date()
        }
      },
      {
        user: users[0]._id,
        court: courts[1]._id,
        date: nextWeek,
        startTime: '18:00',
        endTime: '19:30',
        duration: 90,
        players: [
          { name: '張小明', email: 'zhang@example.com', phone: '0912345678' },
          { name: '李教練', email: 'coach@example.com', phone: '0987654321' },
          { name: '陳小華', email: 'chen@example.com', phone: '0934567890' },
          { name: '林小美', email: 'lin@example.com', phone: '0945678901' }
        ],
        totalPlayers: 4,
        pricing: {
          basePrice: 250,
          memberDiscount: 15,
          totalPrice: 212.5
        },
        status: 'pending',
        payment: {
          status: 'pending',
          method: 'stripe'
        }
      },
      {
        user: users[1]._id,
        court: courts[2]._id,
        date: tomorrow,
        startTime: '14:00',
        endTime: '16:00',
        duration: 120,
        players: [
          { name: '李教練', email: 'coach@example.com', phone: '0987654321' },
          { name: '學員A', email: 'student1@example.com', phone: '0956789012' },
          { name: '學員B', email: 'student2@example.com', phone: '0967890123' }
        ],
        totalPlayers: 3,
        pricing: {
          basePrice: 350,
          memberDiscount: 25,
          totalPrice: 262.5
        },
        status: 'confirmed',
        payment: {
          status: 'paid',
          method: 'bank_transfer',
          transactionId: 'bank_987654321',
          paidAt: new Date()
        },
        specialRequests: '需要額外的球拍和球'
      }
    ]);

    console.log('✅ 預約數據創建完成');
    console.log(`📊 種子數據完成：${users.length} 用戶，${courts.length} 場地，${bookings.length} 預約`);

  } catch (error) {
    console.error('❌ 種子數據創建失敗:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedData();
