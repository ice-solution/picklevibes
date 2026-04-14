#!/usr/bin/env node
/**
 * 模擬「有人預約場地」的進場／開門通知電郵
 *
 * 兩種模式：
 * 1) 預設（不經門禁 API）：本機產生示範 QR + 示範密碼，只發信。
 * 2) --api（或 --hik）：走 accessControlService.processAccessControl → 取 token、Hik 臨時授權 API、真實 QR／密碼，再發信。
 *
 * 使用（專案根目錄）：
 *   node server/scripts/sendMockAccessEmail.js
 *   node server/scripts/sendMockAccessEmail.js --api
 *   node server/scripts/sendMockAccessEmail.js --api your@email.com 14:00 16:00
 *
 * 環境變數：USE_HIK_API=1 等同加 --api
 *          MOCK_BOOKING_DATE=YYYY-MM-DD 可覆寫預約日期（預設為香港時區「今天」）
 *
 * .env：GMAIL_USER / GMAIL_APP_PASSWORD；--api 另需 HIKKEY、HIKSECRET、HIKACCESSLEVELID
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const QRCode = require('qrcode');

/** 香港時區日曆上的今天 YYYY-MM-DD */
function hkTodayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
}

function resolveBookingDate() {
  const fromEnv = process.env.MOCK_BOOKING_DATE?.trim();
  if (fromEnv && /^\d{4}-\d{2}-\d{2}$/.test(fromEnv)) {
    return fromEnv;
  }
  return hkTodayYmd();
}

// ========== 請修改此處（hardcode）==========
const CONFIG = {
  toEmail: 'picklevibes1011@gmail.com',
  visitorName: '模擬訪客',
  visitorPhone: '91234567',
  startTime: '14:00',
  endTime: '16:00',
  /** 預設香港「今天」；可設環境變數 MOCK_BOOKING_DATE=YYYY-MM-DD 覆寫 */
  bookingDate: resolveBookingDate(),
  courtName: '競賽場（模擬預約）',
  courtNumber: 1,
  bookingIdPrefix: 'MOCK',
  demoPassword: '888888',
  qrPayload: 'PickleVibes-MOCK-BOOKING-ACCESS',
};

function parseArgs() {
  const raw = process.argv.slice(2);
  const useHikApi =
    raw.includes('--api') ||
    raw.includes('--hik') ||
    process.env.USE_HIK_API === '1';
  const positional = raw.filter((a) => !a.startsWith('--'));
  if (positional.length >= 3) {
    CONFIG.toEmail = positional[0];
    CONFIG.startTime = positional[1];
    CONFIG.endTime = positional[2];
    console.log('📌 命令列覆寫：', {
      toEmail: CONFIG.toEmail,
      startTime: CONFIG.startTime,
      endTime: CONFIG.endTime,
    });
  }
  return { useHikApi };
}

function bookingDateAsDate() {
  const d = new Date(`${CONFIG.bookingDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`無效的 bookingDate: ${CONFIG.bookingDate}`);
  }
  return d;
}

async function runLocalMock() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('❌ 請在專案根目錄 .env 設定 GMAIL_USER 與 GMAIL_APP_PASSWORD');
    process.exit(1);
  }

  const emailService = require('../services/emailService');
  const visitorData = {
    name: CONFIG.visitorName,
    email: CONFIG.toEmail,
    phone: CONFIG.visitorPhone,
  };
  const bookingId = `${CONFIG.bookingIdPrefix}-${Date.now()}`;
  const bookingData = {
    bookingId,
    courtName: CONFIG.courtName,
    date: CONFIG.bookingDate,
    startTime: CONFIG.startTime,
    endTime: CONFIG.endTime,
  };

  const pngBuffer = await QRCode.toBuffer(CONFIG.qrPayload, { type: 'png', width: 280, margin: 1 });
  const qrCodeBase64 = pngBuffer.toString('base64');

  console.log('📧 [本機 mock，未呼叫門禁 API] 發送至:', CONFIG.toEmail);
  await emailService.sendAccessEmail(
    visitorData,
    bookingData,
    qrCodeBase64,
    CONFIG.demoPassword
  );
  console.log('✅ 完成（二維碼／密碼為示範資料）');
}

async function runThroughHikApi() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('❌ 請設定 GMAIL_USER 與 GMAIL_APP_PASSWORD');
    process.exit(1);
  }
  if (!process.env.HIKKEY || !process.env.HIKSECRET || !process.env.HIKACCESSLEVELID) {
    console.error('❌ --api 模式需要 .env：HIKKEY、HIKSECRET、HIKACCESSLEVELID');
    process.exit(1);
  }

  const accessControlService = require('../services/accessControlService');
  const visitorData = {
    name: CONFIG.visitorName,
    email: CONFIG.toEmail,
    phone: CONFIG.visitorPhone,
  };
  const bookingData = {
    bookingId: `${CONFIG.bookingIdPrefix}-${Date.now()}`,
    date: bookingDateAsDate(),
    startTime: CONFIG.startTime,
    endTime: CONFIG.endTime,
    courtName: CONFIG.courtName,
    courtNumber: CONFIG.courtNumber,
  };

  console.log('🚪 [經門禁 API] getToken → tempauth/add → sendAccessEmail');
  console.log('   收件人:', CONFIG.toEmail, '| 日期:', CONFIG.bookingDate, '| 時段:', `${CONFIG.startTime}-${CONFIG.endTime}`);

  const result = await accessControlService.processAccessControl(visitorData, bookingData);
  console.log('✅ 門禁流程完成，已發送進場電郵（QR／密碼來自 Hik 回應）');
  if (result?.tempAuth?.password) {
    console.log('   （密碼已寫入郵件，此處不重複列印）');
  }
}

async function main() {
  const { useHikApi } = parseArgs();
  if (useHikApi) {
    await runThroughHikApi();
  } else {
    await runLocalMock();
  }
}

main().catch((err) => {
  console.error('❌ 失敗:', err.message);
  if (err.response?.data) {
    console.error('   API:', JSON.stringify(err.response.data).slice(0, 500));
  }
  process.exit(1);
});
