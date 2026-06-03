/**
 * 建立／更新 iSQUARE 店鋪與場地（6 場：2 比賽、1 VIP、2 單人、1 發球機）
 * 執行：npm run setup-isquare
 * 環境變數 DRY_RUN=1 僅預覽不寫入
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Store = require('../models/Store');
const Court = require('../models/Court');
const { syncLegacyPricingFromSlots } = require('../utils/courtPricing');

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

const STORE = {
  name: 'PickleVibes iSQUARE',
  slug: 'isquare',
  address: '銅鑼灣 iSQUARE（請於後台店鋪管理補充完整地址）',
  phone: '',
  sortOrder: 10,
  isActive: false,
  enableHikAccess: false,
};

const OPEN_10_24 = {
  monday: { start: '10:00', end: '24:00', isOpen: true },
  tuesday: { start: '10:00', end: '24:00', isOpen: true },
  wednesday: { start: '10:00', end: '24:00', isOpen: true },
  thursday: { start: '10:00', end: '24:00', isOpen: true },
  friday: { start: '10:00', end: '24:00', isOpen: true },
  saturday: { start: '10:00', end: '24:00', isOpen: true },
  sunday: { start: '10:00', end: '24:00', isOpen: true },
};

/** 平日10–16、平日16–24、假日 */
function isquareTimeSlots(weekdayOff, weekdayPeak, holiday) {
  return [
    { startTime: '10:00', endTime: '16:00', price: weekdayOff, name: '非繁忙時間' },
    { startTime: '16:00', endTime: '24:00', price: weekdayPeak, name: '繁忙時間' },
    { startTime: '10:00', endTime: '24:00', price: holiday, name: '紅日' },
  ];
}

const COMPETITION_SLOTS = isquareTimeSlots(380, 600, 680);
const SOLO_SLOTS = isquareTimeSlots(250, 320, 380);
const DINK_SLOTS = isquareTimeSlots(150, 200, 280);

/** 2 比賽場、1 VIP、2 單人場、1 發球機（場地編號 1–6） */
const COURTS = [
  {
    number: 1,
    type: 'competition',
    name: '比賽場 1',
    description: 'iSQUARE 比賽場 1',
    capacity: 8,
    slots: COMPETITION_SLOTS,
  },
  {
    number: 2,
    type: 'competition',
    name: '比賽場 2',
    description: 'iSQUARE 比賽場 2',
    capacity: 8,
    slots: COMPETITION_SLOTS,
  },
  {
    number: 3,
    type: 'training',
    name: 'VIP廂訓練場',
    description: 'iSQUARE VIP 廂訓練場',
    capacity: 6,
    slots: COMPETITION_SLOTS,
  },
  {
    number: 4,
    type: 'solo',
    name: '單人訓練場 1',
    description: 'iSQUARE 單人訓練場 1',
    capacity: 4,
    slots: SOLO_SLOTS,
  },
  {
    number: 5,
    type: 'solo',
    name: '單人訓練場 2',
    description: 'iSQUARE 單人訓練場 2',
    capacity: 4,
    slots: SOLO_SLOTS,
  },
  {
    number: 6,
    type: 'dink',
    name: '發球機單人訓練場',
    description: 'iSQUARE 發球機單人訓練場',
    capacity: 2,
    slots: DINK_SLOTS,
  },
];

const VALID_NUMBERS = COURTS.map((c) => c.number);

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/picklevibes';
  await mongoose.connect(uri);
  console.log(DRY_RUN ? '🔍 DRY RUN（不寫入）\n' : '✅ 已連接資料庫\n');

  let store = await Store.findOne({ slug: STORE.slug });
  if (!store && !DRY_RUN) {
    store = await Store.create({ ...STORE, operatingHours: OPEN_10_24 });
    console.log('✅ 已建立店鋪:', store.name, `(isActive=${store.isActive})`);
  } else if (store && !DRY_RUN) {
    Object.assign(store, STORE, { operatingHours: OPEN_10_24 });
    await store.save();
    console.log('✅ 已更新店鋪:', store.name, `(isActive=${store.isActive})`);
  } else {
    console.log('店鋪:', store ? store.name : '(將建立)', STORE);
  }

  const storeId = store?._id;
  if (!storeId && DRY_RUN) {
    console.log('\n（DRY RUN 無 storeId，略過場地寫入）');
    COURTS.forEach((def) => {
      console.log(`\n#${def.number} ${def.name} (${def.type})`);
    });
    await mongoose.disconnect();
    return;
  }

  for (const def of COURTS) {
    const timeSlots = def.slots;
    const legacy = syncLegacyPricingFromSlots(timeSlots);
    const payload = {
      store: storeId,
      number: def.number,
      type: def.type,
      name: def.name,
      description: def.description,
      capacity: def.capacity,
      amenities: ['air_conditioning', 'lighting', 'net'],
      pricing: {
        timeSlots,
        ...legacy,
        memberDiscount: 0,
      },
      operatingHours: OPEN_10_24,
      isActive: false,
    };

    if (DRY_RUN) {
      console.log(`\n#${def.number} ${def.name} (${def.type})`);
      timeSlots.forEach((s) => console.log(`  ${s.name} ${s.startTime}-${s.endTime} $${s.price}/hr`));
      continue;
    }

    const existing = await Court.findOne({ store: storeId, number: def.number });
    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      console.log(`✅ 已更新: #${def.number} ${def.name}`);
    } else {
      await Court.create(payload);
      console.log(`✅ 已建立: #${def.number} ${def.name}`);
    }
  }

  if (!DRY_RUN) {
    const orphans = await Court.find({
      store: storeId,
      number: { $nin: VALID_NUMBERS },
    });
    for (const c of orphans) {
      c.isActive = false;
      if (!c.description?.includes('已由 setup-isquare 停用')) {
        c.description = `${c.description || ''}（已由 setup-isquare 停用）`.trim();
      }
      await c.save();
      console.log(`⚠️  已停用多餘場地: #${c.number} ${c.name}`);
    }
  }

  console.log('\n完成：2 比賽場 + 1 VIP + 2 單人場 + 1 發球機（#1–#6）');
  console.log('請執行後到後台確認；需要前台顯示時再開啟 isActive。');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
