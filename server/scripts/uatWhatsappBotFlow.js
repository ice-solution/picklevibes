#!/usr/bin/env node
/**
 * WhatsApp LLM / Bot API UAT（唔經 WhatsApp，直接打 Bot API 驗證工具鏈）
 *
 * Usage:
 *   BOT_API_BASE_URL=http://127.0.0.1:5001 \
 *   BOT_API_KEY=xxx \
 *   UAT_PHONE=91234567 \
 *   node server/scripts/uatWhatsappBotFlow.js
 *
 * Optional:
 *   UAT_STORE_Q=荔枝角
 *   UAT_DATE=2026-10-20
 *   UAT_START=18:00
 *   UAT_END=19:00
 *   UAT_DO_BOOKING=0   # 設 1 先會真係扣積分訂場（危險）
 */
const axios = require('axios');

const BASE = String(process.env.BOT_API_BASE_URL || 'http://127.0.0.1:5001').replace(/\/$/, '');
const KEY = String(process.env.BOT_API_KEY || '').trim();
const PHONE = String(process.env.UAT_PHONE || '').trim();
const STORE_Q = String(process.env.UAT_STORE_Q || '荔枝角').trim();
const DATE = String(process.env.UAT_DATE || '').trim();
const START = String(process.env.UAT_START || '18:00').trim();
const END = String(process.env.UAT_END || '19:00').trim();
const DO_BOOKING = process.env.UAT_DO_BOOKING === '1';

function tomorrowYmd() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const date = DATE || tomorrowYmd();

if (!KEY) {
  console.error('❌ 請設定 BOT_API_KEY');
  process.exit(1);
}
if (!PHONE) {
  console.error('❌ 請設定 UAT_PHONE');
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE,
  headers: { 'X-Bot-Key': KEY },
  validateStatus: () => true,
  timeout: 20000,
});

function pass(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('=== WhatsApp Bot API UAT ===');
  console.log({ BASE, PHONE, STORE_Q, date, START, END, DO_BOOKING });
  console.log('');

  let failed = 0;

  // 1) 未註冊電話
  {
    const res = await client.get('/api/bot/balance', { params: { phone: '10000000' } });
    const ok = res.status === 404 && res.data?.code === 'USER_NOT_FOUND';
    if (!pass('未註冊電話 → USER_NOT_FOUND', ok, `HTTP ${res.status} code=${res.data?.code}`)) failed += 1;
  }

  // 2) 查積分（登記用戶）
  let balanceOk = false;
  {
    const res = await client.get('/api/bot/balance', { params: { phone: PHONE } });
    balanceOk = res.status === 200 && res.data?.success;
    if (!pass('登記用戶查積分', balanceOk, `HTTP ${res.status} balance=${res.data?.data?.balance}`)) {
      failed += 1;
      console.log('   （若 USER_NOT_FOUND，請換已註冊 UAT_PHONE）');
    }
  }

  // 3) 店鋪列表 + 別名解析
  let storeId = null;
  {
    const res = await client.get('/api/bot/stores');
    const ok = res.status === 200 && Array.isArray(res.data?.data?.stores);
    if (!pass('GET /api/bot/stores', ok, `count=${res.data?.data?.stores?.length}`)) failed += 1;
  }
  {
    const res = await client.get('/api/bot/stores/resolve', { params: { q: STORE_Q } });
    const ok = res.status === 200 && res.data?.data?.id;
    storeId = res.data?.data?.id || null;
    if (!pass(`resolve store 「${STORE_Q}」`, ok, `id=${storeId} name=${res.data?.data?.name}`)) failed += 1;
  }
  {
    const res = await client.get('/api/bot/stores/resolve', { params: { q: '不存在的店xyz' } });
    const ok = res.status === 404 && res.data?.code === 'STORE_NOT_FOUND';
    if (!pass('未知店名 → STORE_NOT_FOUND', ok, `HTTP ${res.status}`)) failed += 1;
  }

  // 4) 空缺
  let courtId = null;
  let estimatedPoints = null;
  if (storeId) {
    const res = await client.get('/api/bot/availability', {
      params: { store: storeId, date, startTime: START, endTime: END },
    });
    const ok = res.status === 200 && res.data?.success;
    const available = res.data?.data?.availableCourts || [];
    courtId = available[0]?.courtId || null;
    estimatedPoints = available[0]?.pricing?.totalPrice ?? null;
    if (!pass('查空缺', ok, `available=${available.length} first=${available[0]?.courtName || 'none'}`)) {
      failed += 1;
    } else if (!available.length) {
      console.log('⚠️  該時段無空位（劇本：無空位）— 屬正常，可改 UAT_DATE/時間再試');
    }
  }

  // 5) 積分不足（若有場，用超高人數唔得；改為 dry-run 檢查 INSUFFICIENT 難以強制）
  // 改為：若不做 booking，只提示 checklist
  console.log('');
  console.log('— 手動 WhatsApp UAT checklist —');
  console.log('[ ] Echo：發 hello → 收到 Echo');
  console.log('[ ] 未註冊號：提示註冊連結');
  console.log('[ ] 「聽日 8 點荔枝角有冇場」→ 真實空缺');
  console.log('[ ] 無空位時段 → 口語提示換時間');
  console.log('[ ] 積分不足 → 口語提示充值');
  console.log('[ ] propose 後回「好」→ 唔扣積分');
  console.log('[ ] 回「確認」→ 成功訂場 + source=whatsapp_bot');
  console.log('[ ] Meta 重送同一 message.id → 唔雙重扣款');
  console.log('');

  // 6) 可選真訂場
  if (DO_BOOKING && balanceOk && courtId) {
    const res = await client.post('/api/bot/booking', {
      phone: PHONE,
      court: courtId,
      date,
      startTime: START,
      endTime: END,
      totalPlayers: 2,
      specialRequests: 'UAT WhatsApp bot flow',
      source: 'whatsapp_bot',
    });
    const ok = res.status === 201 && res.data?.success;
    if (
      !pass(
        '真實訂場（UAT_DO_BOOKING=1）',
        ok,
        `HTTP ${res.status} booking=${res.data?.data?.booking?._id} pts=${res.data?.data?.pointsDeducted}`
      )
    ) {
      failed += 1;
      console.log('   error:', res.data?.code, res.data?.message, res.data?.details || '');
    } else {
      const src = res.data?.data?.booking?.source;
      pass('booking.source === whatsapp_bot', src === 'whatsapp_bot', `source=${src}`);
      if (src !== 'whatsapp_bot') failed += 1;
    }
  } else {
    console.log('ℹ️  跳過真實訂場（設 UAT_DO_BOOKING=1 先會扣積分）');
    if (courtId) {
      console.log(`   可用 courtId=${courtId} estimatedPoints=${estimatedPoints}`);
    }
  }

  // 7) 冪等提示
  console.log('');
  console.log('冪等：n8n workflow 用 message.id 去重；可用 Meta 重送或 n8n re-run 同一 payload 驗證。');

  console.log('');
  if (failed) {
    console.error(`❌ UAT 完成，失敗 ${failed} 項`);
    process.exit(1);
  }
  console.log('✅ UAT API 部分全部通過');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
