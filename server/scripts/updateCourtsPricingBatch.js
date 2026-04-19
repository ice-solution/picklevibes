/**
 * 批次更新 A/B/C 場地價格（含紅日）
 *
 * 用法：
 *   MONGODB_URI="mongodb+srv://..." node server/scripts/updateCourtsPricingBatch.js
 *
 * 注意：
 * - 紅日判定來自 Holiday 資料表（weekendService），需要先把紅日日期加到系統假期。
 * - VIP 價格目前是「扣款時自動 8 折」，不需額外寫入 VIP 價格表。
 */

const mongoose = require('mongoose');
const Court = require('../models/Court');

const PRICING_BY_COURT_NUMBER = {
  // A 場：比賽場
  1: {
    peakHour: 480,
    offPeak: 320,
    memberDiscount: 0,
    timeSlots: [
      // 貓頭鷹：跨日 23:00–翌日 07:00（Court.js 已支援 end < start）
      { startTime: '23:00', endTime: '07:00', price: 280, name: '貓頭鷹時間' },
      { startTime: '07:00', endTime: '16:00', price: 320, name: '非繁忙時間' },
      { startTime: '16:00', endTime: '23:00', price: 480, name: '繁忙時間' },
      // 紅日（08:00-24:00 會優先套用；00:00-08:00 仍會落入時段價）
      { startTime: '08:00', endTime: '24:00', price: 600, name: '紅日' },
    ],
  },

  // B 場：訓練場
  2: {
    peakHour: 320,
    offPeak: 280,
    memberDiscount: 0,
    timeSlots: [
      { startTime: '23:00', endTime: '07:00', price: 250, name: '貓頭鷹時間' },
      { startTime: '07:00', endTime: '16:00', price: 280, name: '非繁忙時間' },
      { startTime: '16:00', endTime: '23:00', price: 320, name: '繁忙時間' },
      { startTime: '08:00', endTime: '24:00', price: 380, name: '紅日' },
    ],
  },

  // C 場：單人場（無貓頭鷹時段）
  3: {
    peakHour: 200,
    offPeak: 150,
    memberDiscount: 0,
    timeSlots: [
      { startTime: '08:00', endTime: '16:00', price: 150, name: '非繁忙時間' },
      { startTime: '16:00', endTime: '23:00', price: 200, name: '繁忙時間' },
      // 單人場一般營業到 23:00，紅日也以 23:00 結束
      { startTime: '08:00', endTime: '23:00', price: 280, name: '紅日' },
    ],
  },
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('缺少環境變數 MONGODB_URI');
  }

  await mongoose.connect(uri);
  console.log('✅ 已連線資料庫');

  for (const [numberStr, pricing] of Object.entries(PRICING_BY_COURT_NUMBER)) {
    const number = Number(numberStr);
    const court = await Court.findOneAndUpdate(
      { number },
      { $set: { pricing } },
      { new: true }
    );
    if (!court) {
      console.warn(`⚠️ 找不到場地 number=${number}，已略過`);
      continue;
    }
    console.log(`✅ 已更新 ${court.name} (number=${number})`);
  }

  console.log('🎉 批次更新完成');
}

main()
  .catch((err) => {
    console.error('❌ 更新失敗:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch (_) {}
  });

