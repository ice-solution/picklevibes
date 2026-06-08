/**
 * Tuya 智能家居 — 獨立測試工具（CLI）
 *
 * 確認 .env 的 MONGODB_URI 指向正確環境後執行。
 *
 * 常用：
 *   node server/scripts/tuyaTest.js list
 *   node server/scripts/tuyaTest.js plan --court <courtId>
 *   node server/scripts/tuyaTest.js status --court <courtId>
 *   node server/scripts/tuyaTest.js status --store <storeId> --device <deviceId>
 *   node server/scripts/tuyaTest.js on --court <courtId> --yes
 *   node server/scripts/tuyaTest.js off --court <courtId> --yes
 *   node server/scripts/tuyaTest.js sync --court <courtId>
 *   node server/scripts/tuyaTest.js sync --all
 *   node server/scripts/tuyaTest.js logs --limit 20
 *
 * 不加 --yes 時，on/off 會要求輸入 YES 才會實際下指令。
 */
require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const Store = require('../models/Store');
const Court = require('../models/Court');
const tuyaService = require('../services/tuyaService');
const tuyaSchedulerService = require('../services/tuyaSchedulerService');
const { getStoreTuyaConfig, isTuyaConfigured } = require('../utils/storeTuyaConfig');
const { bookingsToLightWindows, isWithinLightWindows } = require('../utils/tuyaLightWindows');
const { getHKCalendarYMD } = require('../utils/bookingDateTime');
const { formatHKTime } = require('../utils/tuyaActionLog');

const TZ = 'Asia/Hong_Kong';

function parseArgs(argv) {
  const rest = argv.slice(2);
  const cmd = rest[0];
  const flags = {};
  for (let i = 1; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { cmd, flags };
}

function formatMsHK(ms) {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function printUsage() {
  console.log(`
Tuya 測試工具

指令：
  list                          列出店鋪／場地 Tuya 設定
  plan   --court <id>           預覽燈光時段 + 目前應開/關 + 設備狀態（唯讀）
  status --court <id>           讀取場地所有設備開關狀態
  status --store <id> --device <deviceId> [--switch switch_1]
  on     --court <id> [--yes]   強制開燈（場地全部設備）
  off    --court <id> [--yes]   強制關燈（場地全部設備）
  on     --store <id> --device <deviceId> [--switch switch_1] [--yes]
  off    --store <id> --device <deviceId> [--switch switch_1] [--yes]
  sync   --court <id>           依預約排程同步單一場地（reconcile）
  sync   --all                  同步所有啟用場地
  logs   [--limit N] [--court <id>]  顯示記憶體內動作日誌（需與 API 同進程才有；CLI 僅顯示本次執行產生的 log）

範例：
  node server/scripts/tuyaTest.js list
  node server/scripts/tuyaTest.js plan --court 674a1b2c3d4e5f6789012345
  node server/scripts/tuyaTest.js on --court 674a1b2c3d4e5f6789012345 --yes
`);
}

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('缺少 MONGODB_URI');
  }
  await mongoose.connect(uri);
}

async function confirmAction(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => {
    rl.question(`${message}\n輸入 YES 繼續：`, resolve);
  });
  rl.close();
  return String(answer).trim() === 'YES';
}

async function loadCourtContext(courtId) {
  const court = await Court.findById(courtId);
  if (!court) throw new Error(`找不到場地：${courtId}`);
  const store = await Store.findById(court.store);
  if (!store) throw new Error(`找不到店鋪：${court.store}`);
  return { store, court };
}

async function loadStore(storeId) {
  const store = await Store.findById(storeId);
  if (!store) throw new Error(`找不到店鋪：${storeId}`);
  return store;
}

function printStoreSummary(store) {
  const cfg = getStoreTuyaConfig(store);
  console.log(`  店鋪：${store.name} (${store._id})`);
  console.log(`    enableTuyaAutomation: ${!!store.enableTuyaAutomation}`);
  console.log(`    API 已設定: ${isTuyaConfigured(store)}`);
  console.log(`    baseUrl: ${cfg.baseUrl}`);
  console.log(`    預熱 ${cfg.preBufferMinutes} 分 · 緩衝 ${cfg.postBufferMinutes} 分 · 合併空隙 ${cfg.mergeGapMinutes} 分`);
}

async function cmdList() {
  const stores = await Store.find({}).sort({ sortOrder: 1, name: 1 });
  console.log('\n=== Tuya 店鋪／場地一覽 ===\n');
  for (const store of stores) {
    printStoreSummary(store);
    const courts = await Court.find({ store: store._id }).sort({ number: 1 });
    for (const court of courts) {
      const devices = tuyaService.getActiveCourtDevices(court);
      const ready = tuyaSchedulerService.isCourtAutomationReady(store, court);
      console.log(`    場地 #${court.number} ${court.name} (${court._id})`);
      console.log(`      enableTuyaAutomation: ${!!court.enableTuyaAutomation} · 就緒: ${ready} · 設備: ${devices.length}`);
      devices.forEach((d) => {
        console.log(`        - ${d.label || '設備'} · ${d.deviceId} · ${d.switchCode || 'switch_1'}`);
      });
    }
    console.log('');
  }
}

async function cmdPlan(courtId) {
  const { store, court } = await loadCourtContext(courtId);
  tuyaService.assertStoreTuyaReady(store);

  const cfg = getStoreTuyaConfig(store);
  const bookings = await tuyaSchedulerService.fetchCourtBookings(court._id);
  const windows = bookingsToLightWindows(bookings, cfg);
  const nowMs = Date.now();
  const shouldOn = isWithinLightWindows(windows, nowMs);

  console.log('\n=== Tuya 排程預覽 ===\n');
  printStoreSummary(store);
  console.log(`  場地：${court.name} (${court._id})`);
  console.log(`  現在 (HKT)：${formatHKTime(new Date(nowMs))}`);
  console.log(`  依預約應為：${shouldOn ? '開燈' : '關燈'}`);
  console.log(`  預約筆數：${bookings.length} · 合併後燈光時段：${windows.length}\n`);

  if (bookings.length) {
    console.log('--- 預約 ---');
    bookings.forEach((b) => {
      const ymd = getHKCalendarYMD(b.date);
      console.log(`  ${ymd} ${b.startTime}-${b.endTime} [${b.status}]`);
    });
    console.log('');
  }

  if (windows.length) {
    console.log('--- 燈光時段（含預熱／緩衝／合併）---');
    windows.forEach((w, i) => {
      const active = nowMs >= w.startMs && nowMs < w.endMs;
      console.log(`  ${i + 1}. ${formatMsHK(w.startMs)} → ${formatMsHK(w.endMs)}${active ? '  ← 現在在此時段' : ''}`);
    });
    console.log('');
  } else {
    console.log('（無有效燈光時段）\n');
  }

  const states = await tuyaService.getCourtDevicesState(store, court);
  console.log('--- 設備實際狀態 ---');
  states.forEach((s) => {
    const actual = s.isOn === null ? `讀取失敗${s.readError ? ` (${s.readError})` : ''}` : (s.isOn ? '開' : '關');
    const match = s.isOn === null ? '?' : (s.isOn === shouldOn ? '✓ 符合' : '✗ 需修正');
    console.log(`  ${s.label || s.deviceId} · ${actual} · ${match}`);
  });
  console.log('');
}

async function cmdStatusCourt(courtId) {
  const { store, court } = await loadCourtContext(courtId);
  tuyaService.assertStoreTuyaReady(store);
  const states = await tuyaService.getCourtDevicesState(store, court);
  console.log(`\n場地 ${court.name} 設備狀態：`);
  console.log(JSON.stringify(states, null, 2));
}

async function cmdStatusDevice(storeId, deviceId, switchCode) {
  const store = await loadStore(storeId);
  tuyaService.assertStoreTuyaReady(store);
  const status = await tuyaService.getDeviceStatus(store, deviceId);
  const isOn = tuyaService.parseSwitchFromStatus(status, switchCode);
  console.log(`\n設備 ${deviceId} (${switchCode})：${isOn === null ? '未知' : (isOn ? '開' : '關')}`);
  console.log(JSON.stringify(status, null, 2));
}

async function cmdSetCourt(courtId, turnOn, skipConfirm) {
  const { store, court } = await loadCourtContext(courtId);
  tuyaService.assertStoreTuyaReady(store);
  const devices = tuyaService.getActiveCourtDevices(court);
  if (!devices.length) throw new Error('場地無啟用設備');

  if (!skipConfirm) {
    const ok = await confirmAction(
      `⚠️  將對場地「${court.name}」的 ${devices.length} 個設備下達「${turnOn ? '開' : '關'}」指令`
    );
    if (!ok) {
      console.log('已取消');
      return;
    }
  }

  const results = await tuyaService.setCourtDevices(store, court, turnOn);
  console.log(`\n✅ 已${turnOn ? '開燈' : '關燈'}：`);
  console.log(JSON.stringify(results, null, 2));
}

async function cmdSetDevice(storeId, deviceId, switchCode, turnOn, skipConfirm) {
  const store = await loadStore(storeId);
  tuyaService.assertStoreTuyaReady(store);

  if (!skipConfirm) {
    const ok = await confirmAction(
      `⚠️  將對設備 ${deviceId} (${switchCode}) 下達「${turnOn ? '開' : '關'}」指令`
    );
    if (!ok) {
      console.log('已取消');
      return;
    }
  }

  const control = await tuyaService.setDeviceSwitch(store, { deviceId, switchCode, turnOn });
  console.log(`\n✅ 設備已${turnOn ? '開啟' : '關閉'}：`);
  console.log(JSON.stringify(control, null, 2));
}

async function cmdSync(flags) {
  if (flags.all) {
    const result = await tuyaSchedulerService.syncAllCourts({ reason: 'cli_manual' });
    console.log('\n=== 全店同步結果 ===');
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!flags.court) throw new Error('請指定 --court <id> 或 --all');
  const result = await tuyaSchedulerService.syncCourtById(flags.court, { reason: 'cli_manual' });
  console.log('\n=== 場地同步結果 ===');
  console.log(JSON.stringify(result, null, 2));
}

async function cmdLogs(flags) {
  const limit = Math.min(parseInt(flags.limit, 10) || 50, 500);
  const logs = tuyaSchedulerService.getTuyaActionLog({
    limit,
    courtId: flags.court,
  });
  if (!logs.length) {
    console.log('\n（無日誌 — CLI 獨立執行時僅顯示本次 sync/on/off 產生的記錄；伺服器運行中的 log 請用 GET /api/tuya/sync/logs）\n');
    return;
  }
  console.log(`\n=== 最近 ${logs.length} 筆 Tuya 日誌 ===\n`);
  logs.forEach((row) => {
    console.log(`[${row.atHK}] ${row.level} ${row.message}`);
    if (row.courtName) console.log(`  場地: ${row.courtName}`);
    if (row.action) console.log(`  action: ${row.action}`);
    if (row.error) console.log(`  error: ${row.error}`);
  });
  console.log('');
}

async function main() {
  const { cmd, flags } = parseArgs(process.argv);
  if (!cmd || cmd === 'help' || flags.help) {
    printUsage();
    process.exit(0);
  }

  await connectDb();

  try {
    switch (cmd) {
      case 'list':
        await cmdList();
        break;
      case 'plan':
        if (!flags.court) throw new Error('plan 需要 --court <id>');
        await cmdPlan(flags.court);
        break;
      case 'status':
        if (flags.court) {
          await cmdStatusCourt(flags.court);
        } else if (flags.store && flags.device) {
          await cmdStatusDevice(flags.store, flags.device, flags.switch || 'switch_1');
        } else {
          throw new Error('status 需要 --court <id> 或 --store + --device');
        }
        break;
      case 'on':
        if (flags.court) {
          await cmdSetCourt(flags.court, true, !!flags.yes);
        } else if (flags.store && flags.device) {
          await cmdSetDevice(flags.store, flags.device, flags.switch || 'switch_1', true, !!flags.yes);
        } else {
          throw new Error('on 需要 --court <id> 或 --store + --device');
        }
        break;
      case 'off':
        if (flags.court) {
          await cmdSetCourt(flags.court, false, !!flags.yes);
        } else if (flags.store && flags.device) {
          await cmdSetDevice(flags.store, flags.device, flags.switch || 'switch_1', false, !!flags.yes);
        } else {
          throw new Error('off 需要 --court <id> 或 --store + --device');
        }
        break;
      case 'sync':
        await cmdSync(flags);
        break;
      case 'logs':
        await cmdLogs(flags);
        break;
      default:
        console.error(`未知指令：${cmd}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    await mongoose.connection.close();
  }
}

main().catch((err) => {
  console.error('\n❌', err.message || err);
  process.exit(1);
});
