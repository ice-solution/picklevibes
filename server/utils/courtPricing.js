const TIME_RE = /^((?:[0-1]?[0-9]|2[0-3]):[0-5][0-9]|24:00)$/;

const SLOT_NAME_OPTIONS = ['貓頭鷹時間', '非繁忙時間', '繁忙時間', '紅日'];

function normalizeTimeSlots(rawSlots) {
  if (!Array.isArray(rawSlots) || rawSlots.length === 0) {
    throw new Error('至少需要一個時段');
  }

  return rawSlots.map((slot, index) => {
    const startTime = String(slot.startTime || '').trim();
    const endTime = String(slot.endTime || '').trim();
    const name = String(slot.name || '').trim();
    const price = Number(slot.price);

    if (!TIME_RE.test(startTime)) {
      throw new Error(`第 ${index + 1} 個時段開始時間格式無效`);
    }
    if (!TIME_RE.test(endTime)) {
      throw new Error(`第 ${index + 1} 個時段結束時間格式無效`);
    }
    if (!name) {
      throw new Error(`第 ${index + 1} 個時段名稱不能為空`);
    }
    if (Number.isNaN(price) || price < 0) {
      throw new Error(`第 ${index + 1} 個時段價格不能為負數`);
    }

    return { startTime, endTime, name, price };
  });
}

/** 從 timeSlots 同步舊版 peakHour / offPeak（相容列表顯示） */
function syncLegacyPricingFromSlots(timeSlots) {
  const findFirst = (name) => timeSlots.find((s) => s.name === name)?.price;
  const peak = findFirst('繁忙時間') ?? findFirst('紅日') ?? Math.max(...timeSlots.map((s) => s.price));
  const offPeak = findFirst('非繁忙時間') ?? Math.min(...timeSlots.map((s) => s.price));
  return {
    peakHour: peak,
    offPeak: offPeak,
  };
}

function getDefaultTimeSlotsForType(courtType) {
  if (courtType === 'solo') {
    return [
      { startTime: '08:00', endTime: '16:00', price: 250, name: '非繁忙時間' },
      { startTime: '16:00', endTime: '23:00', price: 380, name: '繁忙時間' },
    ];
  }
  return [
    { startTime: '00:00', endTime: '07:00', price: 320, name: '貓頭鷹時間' },
    { startTime: '07:00', endTime: '16:00', price: 380, name: '非繁忙時間' },
    { startTime: '16:00', endTime: '23:00', price: 600, name: '繁忙時間' },
    { startTime: '23:00', endTime: '24:00', price: 320, name: '貓頭鷹時間' },
  ];
}

module.exports = {
  TIME_RE,
  SLOT_NAME_OPTIONS,
  normalizeTimeSlots,
  syncLegacyPricingFromSlots,
  getDefaultTimeSlotsForType,
};
