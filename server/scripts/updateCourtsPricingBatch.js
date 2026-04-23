/**
 * 批次更新 A / B / C 場地價格（含紅日時段）
 *
 * ── 做什麼 ──
 * - 連線 MongoDB，依場地 `number`（1=A、2=B、3=C）找到 `Court` 文件。
 * - 用 `$set: { pricing }` **整份覆寫**該場地的 `pricing`（含 timeSlots、peakHour、offPeak、memberDiscount）。
 * - 不會新增場地；找不到對應 `number` 會印警告並略過。
 *
 * ── 怎麼執行 ──
 * 在專案根目錄（picklevibes/）：
 *
 *   MONGODB_URI="你的連線字串" node server/scripts/updateCourtsPricingBatch.js
 *
 * 或先在本機 shell 匯入連線再執行（依你習慣，勿把密碼提交到 Git）：
 *
 *   export MONGODB_URI="mongodb+srv://..."
 *   node server/scripts/updateCourtsPricingBatch.js
 *
 * **請再三確認 MONGODB_URI 指向正確環境**（UAT / 正式），避免誤改正式庫。
 *
 * ── 修改價格 ──
 * - 直接改下方 `PRICING_BY_COURT_NUMBER` 內數字與 timeSlots。
 * - 貓頭鷹可寫跨日：`{ startTime: '23:00', endTime: '07:00', ... }`（後端 Court 模型需支援 end < start）。
 * - 改完存檔後再執行腳本才會寫入資料庫。
 *
 * ── 注意 ──
 * - 「紅日」實際計價仍依系統假期（Holiday）＋ Court.getPriceForTime；請先把紅日日期維護在後台假期。
 * - VIP 為扣款時 8 折邏輯，通常不必在此腳本另寫 VIP 價。
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
  // 必須透過環境變數提供連線（勿把連線字串寫死在程式裡）
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('缺少環境變數 MONGODB_URI');
  }

  await mongoose.connect(uri);
  console.log('✅ 已連線資料庫');

  // 逐場更新：key 為 Court.number（1/2/3），value 為要寫入的整份 pricing
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

// 執行完畢後關閉連線，讓 process 可正常結束
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

